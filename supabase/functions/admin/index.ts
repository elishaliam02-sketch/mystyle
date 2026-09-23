// APEX — the owner console's data (Supabase Edge Function, Deno).
//
// This is the ONLY door to cross-user data, so it is built like one. It never
// runs with a customer's key: the caller proves who they are with their JWT,
// the function checks that id against the `admins` table using the service-role
// key, and only then does it read anything. A signed-in ordinary user who calls
// it gets a flat 403 — being logged in is not being an admin.
//
// It is read-only for now: it answers three questions and changes nothing.
//   POST { action: "overview" }            → the top-of-dashboard counts
//   POST { action: "users", page? }        → a page of users with their state
//   POST { action: "audit", limit? }       → the recent audit trail
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

const cors = {
  // supabase-js sends apikey and x-client-info (and a version header) on every
  // functions.invoke call. A preflight that does not list them makes the
  // browser refuse the request — the "Failed to send a request" error — before
  // the function ever runs. List everything the client actually sends.
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8081,http://localhost:19006")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

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
async function record(db: SupabaseClient, kind: "admin.login" | "admin.denied", actorId: string, meta: Record<string, string>) {
  try {
    const since = new Date(Date.now() - AUDIT_WINDOW_MS).toISOString();
    const { data: recent } = await db
      .from("audit_log")
      .select("id")
      .eq("kind", kind)
      .eq("actor_id", actorId)
      .gte("at", since)
      .limit(1);
    if (recent && recent.length) return;
    await db.from("audit_log").insert({ kind, actor_id: actorId, meta });
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

// ------------------------------------------------------------------ trajectory
// A compact mirror of src/admin/trajectory.ts — the tested spec lives there;
// this is the same rule, run server-side over the weigh-ins the client synced.

const DAY = 86_400_000;
type Point = { date: string; kg: number };
type Traj = "no-data" | "on-track" | "slow" | "stalled" | "fast" | "off-track";

function readTrajectory(points: Point[], goalKg: number | null, nowMs: number): {
  trajectory: Traj;
  perWeek: number | null;
  daysSinceWeighIn: number | null;
  points: number;
} {
  const clean = points
    .filter((p) => p && typeof p.date === "string" && Number.isFinite(p.kg))
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = clean[clean.length - 1];
  const daysSinceWeighIn = last ? Math.max(0, Math.floor((nowMs - Date.parse(last.date)) / DAY)) : null;
  const base = { trajectory: "no-data" as Traj, perWeek: null as number | null, daysSinceWeighIn, points: clean.length };
  if (clean.length < 2) return base;

  const first = clean[0];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / DAY;
  if (!(days >= 7)) return base;

  const perWeek = Math.round(((last.kg - first.kg) / days) * 7 * 100) / 100;
  const toGo = goalKg !== null ? goalKg - last.kg : -1;
  const towardIsNegative = toGo < 0;
  const magnitude = Math.abs(perWeek);
  const toward = perWeek === 0 ? false : perWeek < 0 === towardIsNegative;

  let trajectory: Traj;
  if (magnitude < 0.1) trajectory = "stalled";
  else if (!toward) trajectory = "off-track";
  else if (magnitude < 0.2) trajectory = "slow";
  else if (magnitude > 1.5) trajectory = "fast";
  else trajectory = "on-track";
  return { trajectory, perWeek, daysSinceWeighIn, points: clean.length };
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

  let body: { action?: unknown; page?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad-json", 400);
  }

  await record(db, "admin.login", user.id, { action: String(body.action).slice(0, 40) });

  try {
    switch (body.action) {
      case "overview":
        return await overview(db);
      case "users":
        return await listUsers(db, Number(body.page) || 1);
      case "audit":
        return await listAudit(db, Math.min(200, Number(body.limit) || 100));
      default:
        return fail("unknown-action", 400);
    }
  } catch {
    return fail("server", 500);
  }
}

// --------------------------------------------------------------------- reads

type SubRow = { user_id: string; status: string; plan_id: string | null; current_period_end: string | null; trial_ends_at: string | null };
type WeighRow = { user_id: string; date: string; kg: number };
type ProfileRow = { id: string; goal_kg: number | null };

/** The counts at the top of the dashboard: how many people, how many paying,
 * and how the cohort is doing on the one thing the app is for. */
async function overview(db: SupabaseClient): Promise<Response> {
  const nowMs = Date.now();

  // Every auth user (paged through, so a growing base still reports whole).
  const users: { id: string }[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return fail("server", 500);
    users.push(...data.users.map((u) => ({ id: u.id })));
    if (data.users.length < 1000) break;
  }
  const ids = users.map((u) => u.id);

  const [{ data: subs }, { data: weighs }, { data: profiles }] = await Promise.all([
    db.from("subscriptions").select("user_id,status,current_period_end,trial_ends_at"),
    db.from("weigh_ins").select("user_id,date,kg"),
    db.from("profiles").select("id,goal_kg"),
  ]);

  const subByUser = new Map<string, SubRow>();
  for (const s of (subs ?? []) as SubRow[]) subByUser.set(s.user_id, s);
  const goalByUser = new Map<string, number | null>();
  for (const p of (profiles ?? []) as ProfileRow[]) goalByUser.set(p.id, p.goal_kg);
  const weighsByUser = new Map<string, Point[]>();
  for (const w of (weighs ?? []) as WeighRow[]) {
    const arr = weighsByUser.get(w.user_id) ?? [];
    arr.push({ date: w.date, kg: Number(w.kg) });
    weighsByUser.set(w.user_id, arr);
  }

  const subStatus: Record<string, number> = { none: 0, trialing: 0, active: 0, past_due: 0, canceled: 0, expired: 0 };
  const traj: Record<Traj, number> = { "no-data": 0, "on-track": 0, slow: 0, stalled: 0, fast: 0, "off-track": 0 };
  let paying = 0;
  let progressing = 0;

  for (const id of ids) {
    const s = subByUser.get(id);
    const status = s?.status ?? "none";
    subStatus[status] = (subStatus[status] ?? 0) + 1;
    if (status === "active" || status === "trialing") paying += 1;

    const t = readTrajectory(weighsByUser.get(id) ?? [], goalByUser.get(id) ?? null, nowMs).trajectory;
    traj[t] += 1;
    if (t === "on-track" || t === "slow" || t === "fast") progressing += 1;
  }

  return json({
    totalUsers: ids.length,
    paying,
    progressing,
    subStatus,
    trajectory: traj,
    generatedAt: new Date(nowMs).toISOString(),
  });
}

/** A page of users, each with the facts the console shows in a row. */
async function listUsers(db: SupabaseClient, page: number): Promise<Response> {
  const perPage = 50;
  const nowMs = Date.now();
  const { data, error } = await db.auth.admin.listUsers({ page, perPage });
  if (error) return fail("server", 500);

  const ids = data.users.map((u) => u.id);
  const [{ data: subs }, { data: weighs }, { data: profiles }] = await Promise.all([
    db.from("subscriptions").select("user_id,status,plan_id,current_period_end,trial_ends_at").in("user_id", ids),
    db.from("weigh_ins").select("user_id,date,kg").in("user_id", ids),
    db.from("profiles").select("id,goal_kg").in("id", ids),
  ]);

  const subByUser = new Map<string, SubRow>();
  for (const s of (subs ?? []) as SubRow[]) subByUser.set(s.user_id, s);
  const goalByUser = new Map<string, number | null>();
  for (const p of (profiles ?? []) as ProfileRow[]) goalByUser.set(p.id, p.goal_kg);
  const weighsByUser = new Map<string, Point[]>();
  for (const w of (weighs ?? []) as WeighRow[]) {
    const arr = weighsByUser.get(w.user_id) ?? [];
    arr.push({ date: w.date, kg: Number(w.kg) });
    weighsByUser.set(w.user_id, arr);
  }

  const rows = data.users.map((u) => {
    const s = subByUser.get(u.id) ?? null;
    const t = readTrajectory(weighsByUser.get(u.id) ?? [], goalByUser.get(u.id) ?? null, nowMs);
    return {
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      lastSignInAt: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
      subscription: s ? { status: s.status, planId: s.plan_id, currentPeriodEnd: s.current_period_end, trialEndsAt: s.trial_ends_at } : { status: "none" },
      weighIns: t.points,
      lastWeighInDaysAgo: t.daysSinceWeighIn,
      perWeek: t.perWeek,
      trajectory: t.trajectory,
    };
  });

  return json({ page, perPage, count: rows.length, users: rows });
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
