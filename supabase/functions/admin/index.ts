// APEX — the owner console's data (Supabase Edge Function, Deno).
//
// This is the ONLY door to cross-user data, so it is built like one. It never
// runs with a customer's key: the caller proves who they are with their JWT,
// the function checks that id against the `admins` table using the service-role
// key, and only then does it read anything. A signed-in ordinary user who calls
// it gets a flat 403 — being logged in is not being an admin.
//
// What it answers (POST { action, ... }):
//   "dashboard"                         → growth, actives, retention, revenue,
//                                         moods, trajectories, who needs a look
//   "users"  { q, filter, sort, dir, page, perPage } → a searchable page of people
//   "user"   { id }                     → one person: account, subscription,
//                                         weight series, activity days, moods
//   "export" { q, filter, sort, dir }   → the matching people as CSV
//   "comp"   { id, days }               → free access for N days (testers,
//                                         goodwill); never over a Stripe plan
//   "uncomp" { id }                     → takes free access back
//   "audit"  { limit }                  → the recent audit trail
//   "overview"                          → the old console's counts (kept so a
//                                         cached copy of the old page still works)
// The numbers themselves are computed in ../_shared/adminMetrics.ts, which the
// app's unit tests run (src/admin/metricstest.ts). Recap notes are never read:
// the owner sees moods and dates, not what anyone wrote.
//
// The rules it will not bend on:
//  1. THE SERVICE-ROLE KEY NEVER LEAVES THIS PROCESS. It is read from the
//     function's environment, used to read, and never returned or logged.
//  2. ADMIN IS CHECKED ON EVERY CALL, from the verified token, against the
//     `admins` table — never from the request body.
//  3. A SECOND FACTOR ON EVERY CALL. The token must be aal2 (a TOTP code
//     entered this session); the console walks the admin through enrolling.
//  4. NO SECRET IS EVER RETURNED. Emails and subscription state are the point;
//     tokens, passwords and keys are not, and none are read or sent.
//
// Deploy:  supabase functions deploy admin
//     (JWT-verified: only a signed-in user can even reach it; the admin check
//      is the second gate, inside.)

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import {
  activityRows,
  dashboard,
  queryUsers,
  summarize,
  usersCsv,
  type Raw,
  type Summary,
} from "../_shared/adminMetrics.ts";

const cors = {
  // supabase-js sends apikey and x-client-info (and a version header) on every
  // functions.invoke call. A preflight that does not list them makes the
  // browser refuse the request — the "Failed to send a request" error — before
  // the function ever runs. List everything the client actually sends.
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// The hosted web app (and the owner console served beside it) is always let
// in; the ALLOWED_ORIGINS secret adds to it rather than replacing it. Left to
// the secret alone, a project where it was never set answered only localhost,
// so the web app's AI, checkout and console calls were all refused.
const APP_ORIGINS = ["https://mystyle.expo.app"];
const ALLOWED_ORIGINS = [
  ...APP_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8081,http://localhost:19006")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

/** Echoes the Origin back only when it is on ALLOWED_ORIGINS (a function
 * secret). Native apps send no Origin; the console must be served from a listed origin. */
function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // nosemgrep: cors-misconfiguration -- echoed only after matching ALLOWED_ORIGINS
    res.headers.set("Access-Control-Allow-Origin", origin);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  }
  res.headers.append("Vary", "Origin");
  return res;
}

type ErrorCode = "method" | "bad-json" | "unauthorized" | "forbidden" | "mfa-required" | "unknown-action" | "server";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function fail(error: ErrorCode, status: number): Response {
  return json({ error }, status);
}

/** Writes an audit row, at most one per admin and kind in AUDIT_WINDOW: the
 * console refreshes every 30 seconds, and a row per refresh would bury every
 * other event. Best effort — a failed write never blocks the console. Kinds and
 * meta follow src/admin/audit.ts: a closed set, and never a secret. */
const AUDIT_WINDOW_MS = 30 * 60_000;
type AdminKind = "admin.login" | "admin.denied" | "admin.view_user" | "admin.comp_trial";
async function record(db: SupabaseClient, kind: AdminKind, actorId: string, meta: Record<string, string | number | boolean>, targetId?: string, always = false) {
  try {
    if (!always) {
      const since = new Date(Date.now() - AUDIT_WINDOW_MS).toISOString();
      let q = db.from("audit_log").select("id").eq("kind", kind).eq("actor_id", actorId).gte("at", since);
      if (targetId) q = q.eq("target_id", targetId);
      const { data: recent } = await q.limit(1);
      if (recent && recent.length) return;
    }
    await db.from("audit_log").insert({ kind, actor_id: actorId, target_id: targetId ?? null, meta });
  } catch {
    console.error("admin: audit write failed");
  }
}

/** The payload of a token getUser has already verified. */
function claims(jwt: string): Record<string, unknown> {
  try {
    const part = jwt.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
}

/** The service-role client. Holds the one key that can read across users; it
 * exists only inside this function, only after the admin check has passed. */
function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

// ------------------------------------------------------------------- the entry

Deno.serve(async (req: Request) => withCors(req, await handle(req)));

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return fail("method", 405);

  // 1. Who is calling. The bearer token is validated directly with the service
  //    key, rather than through an anon-key client — a new-API-key project does
  //    not always inject the legacy anon key, and depending on it made every
  //    call fail as "unauthorized" even for a real admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^[Bb]earer\s+/, "").trim();
  const db = admin();
  const { data: userData, error: userErr } = await db.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) {
    console.error("admin: could not identify caller:", userErr?.message ?? "no user for token");
    return fail("unauthorized", 401);
  }

  // 2. Are they an admin? Checked with the service key against the allowlist.
  const { data: adminRow, error: adminErr } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminErr) {
    console.error("admin: allowlist read failed:", adminErr.message);
    return fail("server", 500);
  }
  if (!adminRow) {
    console.error("admin: caller is not in the allowlist:", user.id);
    await record(db, "admin.denied", user.id, { reason: "not-admin" });
    return fail("forbidden", 403);
  }

  // 3. A second factor, every call. A password alone - phished, reused,
  //    guessed - must not open every user's data. The token was verified by
  //    getUser above; its aal claim says whether this session passed a TOTP
  //    code. Checked after the allowlist, so only an admin learns it is needed.
  if (claims(jwt).aal !== "aal2") {
    await record(db, "admin.denied", user.id, { reason: "no-second-factor" });
    return fail("mfa-required", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad-json", 400);
  }

  await record(db, "admin.login", user.id, { action: String(body.action).slice(0, 40) });

  try {
    switch (body.action) {
      case "dashboard":
        return json(await buildDashboard(db));
      case "overview":
        return await overview(db);
      case "users":
        return await listUsers(db, body);
      case "export":
        return await exportUsers(db, body);
      case "user":
        return await userDetail(db, user.id, String(body.id ?? ""));
      case "comp":
        return await comp(db, user.id, String(body.id ?? ""), Number(body.days));
      case "uncomp":
        return await uncomp(db, user.id, String(body.id ?? ""));
      case "audit":
        return await listAudit(db, Math.min(200, Number(body.limit) || 100));
      default:
        return fail("unknown-action", 400);
    }
  } catch (e) {
    console.error("admin: action failed:", body.action, e instanceof Error ? e.message : "unknown");
    return fail("server", 500);
  }
}

// --------------------------------------------------------------------- reads

/** Every row a query matches. PostgREST caps each response (1000 by default),
 * and a capped response looks complete — the dashboard's counts were quietly
 * wrong past the first thousand weigh-ins. `build` must return a fresh query
 * with a stable order each time. */
async function selectAll<T>(build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> }): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error("read failed");
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length === 0) return out;
  }
}

/** Habit ticks this far back are enough for every number on the console
 * (actives, retention to day 30, the 7-day completion rate). */
const ACTIVITY_DAYS = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Everything the console's numbers are made of, read once per call. Never a
 * recap note, a password, a token or a key. */
async function loadRaw(db: SupabaseClient): Promise<Raw> {
  const users: Raw["users"] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("users read failed");
    for (const u of data.users) {
      users.push({
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at ?? new Date(0).toISOString(),
        lastSignInAt: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
        anonymous: !!(u as { is_anonymous?: boolean }).is_anonymous || !u.email,
      });
    }
    if (data.users.length < 1000) break;
  }
  const since = new Date(Date.now() - ACTIVITY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [subs, weighs, moods, habits, done, profiles, backups] = await Promise.all([
    selectAll<{ user_id: string; status: string; plan_id: string | null; current_period_end: string | null; trial_ends_at: string | null; stripe_subscription_id: string | null }>(
      () => db.from("subscriptions").select("user_id,status,plan_id,current_period_end,trial_ends_at,stripe_subscription_id").order("user_id")),
    selectAll<{ user_id: string; date: string; kg: number }>(() => db.from("weigh_ins").select("user_id,date,kg").order("user_id").order("date")),
    selectAll<{ user_id: string; date: string; mood: string }>(() => db.from("check_ins").select("user_id,date,mood").order("user_id").order("date")),
    selectAll<{ user_id: string; archived: boolean }>(() => db.from("habits").select("user_id,archived,id").order("user_id").order("id")),
    selectAll<{ user_id: string; date: string; done: boolean }>(() =>
      db.from("completions").select("user_id,date,done,habit_id").gte("date", since).order("user_id").order("date").order("habit_id")),
    selectAll<{ id: string; goal_kg: number | null }>(() => db.from("profiles").select("id,goal_kg").order("id")),
    selectAll<{ user_id: string; updated_at: string }>(() => db.from("backups").select("user_id,updated_at").order("user_id")),
  ]);
  return {
    users,
    subs: subs.map((r) => ({ userId: r.user_id, status: r.status, planId: r.plan_id, currentPeriodEnd: r.current_period_end, trialEndsAt: r.trial_ends_at, stripe: !!r.stripe_subscription_id })),
    weighIns: weighs.map((r) => ({ userId: r.user_id, date: r.date, kg: Number(r.kg) })),
    checkIns: moods.map((r) => ({ userId: r.user_id, date: r.date, mood: r.mood })),
    habits: habits.map((r) => ({ userId: r.user_id, archived: !!r.archived })),
    completions: done.map((r) => ({ userId: r.user_id, date: r.date, done: !!r.done })),
    profiles: profiles.map((r) => ({ id: r.id, goalKg: r.goal_kg === null ? null : Number(r.goal_kg) })),
    backups: backups.map((r) => ({ userId: r.user_id, date: String(r.updated_at).slice(0, 10) })),
  };
}

async function buildDashboard(db: SupabaseClient) {
  const raw = await loadRaw(db);
  const now = Date.now();
  return dashboard(summarize(raw, now), activityRows(raw), raw.checkIns, now);
}

/** The old console's counts, from the same numbers. */
async function overview(db: SupabaseClient): Promise<Response> {
  const d = await buildDashboard(db);
  return json({
    totalUsers: d.totals.users,
    paying: d.subs.paying + d.subs.trialing,
    progressing: d.trajectory["on-track"] + d.trajectory.slow + d.trajectory.fast,
    subStatus: d.subs.status,
    trajectory: d.trajectory,
    generatedAt: d.generatedAt,
  });
}

function queryOf(body: Record<string, unknown>) {
  return {
    q: typeof body.q === "string" ? body.q.slice(0, 120) : "",
    filter: typeof body.filter === "string" ? body.filter : "all",
    sort: typeof body.sort === "string" ? body.sort : "created",
    dir: body.dir === "asc" ? ("asc" as const) : ("desc" as const),
    page: Number(body.page) || 1,
    perPage: Number(body.perPage) || 50,
  };
}

async function people(db: SupabaseClient): Promise<{ all: Summary[]; attention: Set<string>; raw: Raw }> {
  const raw = await loadRaw(db);
  const now = Date.now();
  const all = summarize(raw, now);
  const d = dashboard(all, activityRows(raw), raw.checkIns, now);
  return { all, attention: new Set(d.attention.map((a) => a.id)), raw };
}

async function listUsers(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const { all, attention } = await people(db);
  return json(queryUsers(all, queryOf(body), Date.now(), attention));
}

async function exportUsers(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const { all, attention } = await people(db);
  const q = queryUsers(all, { ...queryOf(body), page: 1, perPage: 200 }, Date.now(), attention);
  // Every matching row, not one page.
  const rows = queryUsers(all, { ...queryOf(body), page: 1, perPage: Math.max(200, q.total) }, Date.now(), attention).rows;
  return json({ filename: `apex-users-${new Date().toISOString().slice(0, 10)}.csv`, csv: usersCsv(rows), count: rows.length });
}

/** One person, for the console's detail panel. Moods and dates only — the
 * text of a recap stays the person's own. */
async function userDetail(db: SupabaseClient, adminId: string, id: string): Promise<Response> {
  if (!UUID.test(id)) return fail("bad-json", 400);
  const { all, raw } = await people(db);
  const summary = all.find((u) => u.id === id);
  if (!summary) return fail("unknown-action", 404);
  await record(db, "admin.view_user", adminId, {}, id);
  const mine = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId === id);
  const { data: events } = await db
    .from("audit_log")
    .select("at,kind,meta")
    .eq("target_id", id)
    .order("at", { ascending: false })
    .limit(20);
  return json({
    summary,
    weighIns: mine(raw.weighIns).map((r) => ({ date: r.date, kg: r.kg })),
    activity: [...new Set(activityRows(raw).filter((r) => r.userId === id).map((r) => r.date))].sort(),
    moods: mine(raw.checkIns).map((r) => ({ date: r.date, mood: r.mood })).slice(-60),
    habits: { active: summary.habits, archived: mine(raw.habits).filter((h) => h.archived).length },
    events: events ?? [],
  });
}

/** Free access for a number of days: a tester, a refund turned goodwill, a
 * friend. Refused over a live Stripe subscription — two sources of truth for
 * one person's access is how someone ends up charged and locked out at once. */
async function comp(db: SupabaseClient, adminId: string, id: string, days: number): Promise<Response> {
  if (!UUID.test(id) || !Number.isInteger(days) || days < 1 || days > 365) return fail("bad-json", 400);
  const { data: existing } = await db.from("subscriptions").select("status,stripe_subscription_id").eq("user_id", id).maybeSingle();
  if (existing?.stripe_subscription_id && (existing.status === "active" || existing.status === "trialing")) {
    return json({ error: "has-stripe" }, 409);
  }
  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await db.from("subscriptions").upsert({ user_id: id, status: "active", plan_id: "comp", current_period_end: until, trial_ends_at: null, updated_at: new Date().toISOString() });
  if (error) return fail("server", 500);
  await record(db, "admin.comp_trial", adminId, { days }, id, true);
  return json({ ok: true, until });
}

async function uncomp(db: SupabaseClient, adminId: string, id: string): Promise<Response> {
  if (!UUID.test(id)) return fail("bad-json", 400);
  const { data: existing } = await db.from("subscriptions").select("plan_id").eq("user_id", id).maybeSingle();
  if (existing?.plan_id !== "comp") return json({ error: "not-comp" }, 409);
  const { error } = await db.from("subscriptions").update({ status: "none", plan_id: null, current_period_end: null, updated_at: new Date().toISOString() }).eq("user_id", id);
  if (error) return fail("server", 500);
  await record(db, "admin.comp_trial", adminId, { revoked: true }, id, true);
  return json({ ok: true });
}

/** The recent audit trail, newest first. */
async function listAudit(db: SupabaseClient, limit: number): Promise<Response> {
  const { data, error } = await db
    .from("audit_log")
    .select("id,at,kind,actor_id,target_id,meta")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) return fail("server", 500);
  return json({ count: (data ?? []).length, events: data ?? [] });
}
