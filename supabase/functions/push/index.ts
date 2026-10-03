// APEX — reminders for the web app, by Web Push (Supabase Edge Function, Deno).
//
// A browser cannot wake itself at 15:00 to say "water". A phone app schedules
// its reminders on the device; the web app, installed on an iPhone's home
// screen, can only be woken by a push from a server. So:
//
//   POST { action: "key" }                       → the VAPID public key
//   POST { action: "subscribe", subscription }   → keep this browser's address (signed in)
//   POST { action: "unsubscribe" }               → forget this person's browsers and queue
//   POST { action: "schedule", items }           → this person's next reminders: id + time
//   POST { action: "send" }                      → send what is due (pg_cron, every minute)
//
// What the server learns is deliberately thin: the push address of a browser,
// and the ids and times of the reminders ("water@2026-10-03", 15:00). The
// words — habit names included — stay on the device; the service worker reads
// them from the browser's own storage when the push arrives. The message
// itself is encrypted for that one browser (RFC 8291), so the push service
// in between sees nothing but an opaque id.
//
// Secret: VAPID_PRIVATE_JWK (made once by the deploy workflow; never logged,
// never returned — only its public half is).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import { sendPush, vapidKeys } from "../_shared/webpush.ts";
import { cleanSchedule, cleanSubscription } from "../_shared/pushPlan.ts";

const SUBJECT = "https://mystyle.expo.app";

const cors = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const APP_ORIGINS = ["https://mystyle.expo.app"];
const ALLOWED_ORIGINS = [
  ...APP_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8081,http://localhost:19006")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

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

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

const fail = (error: string, status: number) => json({ error }, status);

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let keysPromise: Promise<{ signing: CryptoKey; publicKey: string }> | null = null;
function keys() {
  const raw = Deno.env.get("VAPID_PRIVATE_JWK");
  if (!raw) return null;
  keysPromise ??= vapidKeys(JSON.parse(raw) as JsonWebKey);
  return keysPromise;
}

const hits = new Map<string, { n: number; resetAt: number }>();
function rateLimited(key: string, max = 30): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.resetAt) {
    hits.set(key, { n: 1, resetAt: now + 60_000 });
    return false;
  }
  rec.n += 1;
  return rec.n > max;
}

Deno.serve(async (req: Request) => withCors(req, await handle(req)));

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return fail("method", 405);
  let body: { action?: unknown; subscription?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad-json", 400);
  }
  try {
    switch (body.action) {
      case "key": {
        const k = keys();
        if (!k) return fail("unconfigured", 503);
        return json({ publicKey: (await k).publicKey });
      }
      case "send":
        return await sendDue();
      case "subscribe":
      case "unsubscribe":
      case "schedule":
        return await forUser(req, body);
      default:
        return fail("unknown-action", 400);
    }
  } catch {
    return fail("server", 500);
  }
}

async function forUser(req: Request, body: { action?: unknown; subscription?: unknown; items?: unknown }) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^[Bb]earer\s+/, "").trim();
  if (!jwt) return fail("unauthorized", 401);
  const db = admin();
  const { data } = await db.auth.getUser(jwt);
  const user = data?.user;
  if (!user) return fail("unauthorized", 401);
  if (rateLimited(user.id)) return fail("rate-limited", 429);

  if (body.action === "subscribe") {
    const sub = cleanSubscription(body.subscription);
    if (!sub) return fail("bad-subscription", 400);
    // An address belongs to one browser; if it was someone else's (a shared
    // device, signed in afresh), it is theirs no longer.
    const { error } = await db
      .from("push_subscriptions")
      .upsert({ endpoint: sub.endpoint, user_id: user.id, p256dh: sub.p256dh, auth: sub.auth }, { onConflict: "endpoint" });
    if (error) return fail("server", 500);
    // A person keeps a handful of browsers at most.
    const { data: mine } = await db
      .from("push_subscriptions")
      .select("endpoint, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const extra = (mine ?? []).slice(5).map((r) => r.endpoint as string);
    if (extra.length) await db.from("push_subscriptions").delete().in("endpoint", extra);
    return json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    await db.from("push_subscriptions").delete().eq("user_id", user.id);
    await db.from("push_queue").delete().eq("user_id", user.id);
    return json({ ok: true });
  }

  // schedule: replace what is still waiting with what the phone now wants.
  const items = cleanSchedule(body.items, Date.now());
  if (!items) return fail("bad-schedule", 400);
  const del = await db.from("push_queue").delete().eq("user_id", user.id).is("sent_at", null);
  if (del.error) return fail("server", 500);
  if (items.length) {
    const { error } = await db
      .from("push_queue")
      .upsert(items.map((i) => ({ user_id: user.id, reminder: i.reminder, at: i.at, sent_at: null })), {
        onConflict: "user_id,reminder",
        // A reminder already sent keeps its sent mark, so it is never sent twice.
        ignoreDuplicates: true,
      });
    if (error) return fail("server", 500);
  }
  return json({ ok: true, queued: items.length });
}

/**
 * Sends everything due. Called every minute by pg_cron; anyone else calling it
 * can only make due reminders go out on time, and a run is skipped when one
 * started under 45 seconds ago, so it cannot be turned into load.
 */
async function sendDue(): Promise<Response> {
  const db = admin();
  const k = keys();
  if (!k) return fail("unconfigured", 503);
  const now = new Date();
  const claimed = await db
    .from("push_runs")
    .update({ last_run: now.toISOString() })
    .eq("id", 1)
    .lt("last_run", new Date(now.getTime() - 45_000).toISOString())
    .select("id");
  if (claimed.error || !claimed.data?.length) return json({ skipped: true });

  // Claim what is due by marking it sent first, so a run that overlaps this
  // one cannot send the same reminder again. A reminder over six hours late
  // is dropped rather than delivered at the wrong time of day.
  const due = await db
    .from("push_queue")
    .update({ sent_at: now.toISOString() })
    .is("sent_at", null)
    .lte("at", now.toISOString())
    .gt("at", new Date(now.getTime() - 6 * 3_600_000).toISOString())
    .select("user_id, reminder");
  if (due.error) return fail("server", 500);

  const rows = due.data ?? [];
  const users = [...new Set(rows.map((r) => r.user_id as string))];
  let sent = 0;
  if (users.length) {
    const { data: subs } = await db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth").in("user_id", users);
    const signer = await k;
    const gone: string[] = [];
    await Promise.all(
      rows.map(async (row) => {
        for (const s of (subs ?? []).filter((x) => x.user_id === row.user_id)) {
          const outcome = await sendPush(
            { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
            { id: row.reminder },
            signer,
            SUBJECT,
          );
          if (outcome === "sent") sent += 1;
          if (outcome === "gone") gone.push(s.endpoint as string);
        }
      }),
    );
    if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", [...new Set(gone)]);
  }

  // Housekeeping: sent rows are kept two days (so a re-sent schedule cannot
  // send them twice), and anything left behind longer than that goes.
  await db.from("push_queue").delete().lt("at", new Date(now.getTime() - 2 * 86_400_000).toISOString());
  return json({ due: rows.length, sent });
}
