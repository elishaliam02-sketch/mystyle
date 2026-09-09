// APEX — subscriptions (Supabase Edge Function, Deno).
//
// Why this exists: money cannot be decided on the phone. A client that says
// "I paid" is a client anyone can rewrite. So the app only ever asks for two
// things — a checkout link and its own status — and every fact about what was
// actually paid arrives here from Stripe, signed, over a webhook.
//
// Three routes, one function:
//   POST { action: "checkout", planId }  → a Stripe Checkout URL for that plan
//   POST { action: "portal" }            → a Stripe Billing Portal URL
//   POST { action: "status" }            → what this user is entitled to
//   POST /webhook  (Stripe-Signature)    → Stripe telling us what happened
//
// The rules this file will not bend on:
//
//  1. NO SECRET EVER LEAVES THIS PROCESS. STRIPE_SECRET_KEY and
//     STRIPE_WEBHOOK_SECRET are read from the function's environment. They are
//     never returned, never logged, and never shipped to the app.
//  2. THE CLIENT NEVER NAMES A PRICE. It sends a plan id — "monthly" or
//     "yearly" — and the Stripe price id is looked up here, from the
//     environment. A tampered request cannot buy a year for one agora.
//  3. THE WEBHOOK VERIFIES THE SIGNATURE BEFORE IT BELIEVES A WORD. Anyone can
//     POST JSON that says "subscription active". Only Stripe can sign it.
//  4. IT IS IDEMPOTENT. Stripe retries a webhook until it gets a 2xx, so the
//     same event id will arrive more than once. Each one is recorded, and a
//     repeat is acknowledged without being applied twice.
//  5. FAILURE NEVER GRANTS ANYTHING. Every error path returns a small
//     structured code — never a stack trace, never an upstream message — and
//     leaves the entitlement exactly as it was.
//
// Deploy:  supabase functions deploy billing --no-verify-jwt
//     (the webhook is signature-verified, not JWT-verified; the app's own
//      calls check the JWT themselves, below)
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//          supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//          supabase secrets set STRIPE_PRICE_MONTHLY=price_...
//          supabase secrets set STRIPE_PRICE_YEARLY=price_...
//          supabase secrets set BILLING_RETURN_URL=https://...   (optional)
//
// See supabase/BILLING-SETUP.md — and read the store-policy warning in it
// before shipping this to Google Play or the App Store.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_API = "https://api.stripe.com/v1";

/** Days of free trial. Mirrors TRIAL_DAYS in src/billing/plans.ts. */
const TRIAL_DAYS = 7;

/**
 * The plans we sell, and the environment variable holding each one's Stripe
 * price id. The amounts live in src/billing/plans.ts for the screen to draw;
 * the authoritative amount is whatever Stripe has attached to these price ids,
 * which is the one thing the client cannot touch.
 */
const PRICE_ENV: Record<string, string> = {
  monthly: "STRIPE_PRICE_MONTHLY",
  yearly: "STRIPE_PRICE_YEARLY",
};

function isPlanId(value: unknown): value is keyof typeof PRICE_ENV {
  return typeof value === "string" && Object.hasOwn(PRICE_ENV, value);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** The error codes this function is allowed to say out loud. Anything that is
 * not on this list becomes "server", so an upstream message can never leak a
 * key, a customer id or a stack frame to the app. */
type ErrorCode =
  | "method"
  | "bad-json"
  | "unauthorized"
  | "unknown-action"
  | "unknown-plan"
  | "unconfigured"
  | "rate-limited"
  | "bad-signature"
  | "upstream"
  | "server";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function fail(error: ErrorCode, status: number): Response {
  return json({ error }, status);
}

// A tiny best-effort limiter — one instance, in memory. Checkout sessions are
// cheap but not free, and nothing about this screen needs to be pressed twelve
// times a minute.
const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const rec = hits.get(userId);
  if (!rec || now > rec.resetAt) {
    hits.set(userId, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

// ----------------------------------------------------------------- entry

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method", 405);

  const url = new URL(req.url);
  // Stripe posts to .../billing/webhook. It carries no user JWT — its identity
  // is the signature on the body, checked before anything is read out of it.
  if (url.pathname.endsWith("/webhook")) return await handleWebhook(req);

  return await handleApp(req);
});

// ------------------------------------------------------- the app's own calls

async function handleApp(req: Request): Promise<Response> {
  // 1. The caller must be a signed-in user of this project. Their id is taken
  //    from the verified token, never from the request body — otherwise one
  //    user could ask for another user's status.
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return fail("unauthorized", 401);
  if (rateLimited(user.id)) return fail("rate-limited", 429);

  let body: { action?: unknown; planId?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad-json", 400);
  }

  try {
    switch (body.action) {
      case "status":
        return await statusFor(user.id);
      case "checkout":
        return await createCheckout(user.id, user.email ?? null, body.planId);
      case "portal":
        return await createPortal(user.id);
      default:
        return fail("unknown-action", 400);
    }
  } catch {
    // Nothing about the failure travels: not the message, not the stack, and
    // certainly not the entitlement.
    return fail("server", 500);
  }
}

/** The service-role client. Only this function holds the key; it is what lets
 * the webhook write an entitlement for a user who is not making the request. */
function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

type SubRow = {
  user_id: string;
  status: string;
  plan_id: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

async function statusFor(userId: string): Promise<Response> {
  const db = admin();
  const { data, error } = await db
    .from("subscriptions")
    .select("status, plan_id, current_period_end, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  // A missing row is not an error: it is what everyone who has never paid
  // looks like. It answers "none", and the app reads that as free.
  if (error) return fail("server", 500);

  const row = (data ?? null) as Partial<SubRow> | null;
  return json({
    status: row?.status ?? "none",
    planId: row?.plan_id ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
  });
}

// -------------------------------------------------------------- Stripe calls

/** Stripe's REST API takes form encoding, not JSON. */
function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function stripe(
  path: string,
  key: string,
  params: Record<string, string>,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${key}`,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers,
    body: form(params),
  });
  const data = await res.json().catch(() => ({}));
  // Stripe's own error text can name internal objects; it is logged here for
  // the owner's function logs and never returned to the app.
  if (!res.ok) {
    console.error("stripe error", path, res.status);
    throw new Error("upstream");
  }
  return data as Record<string, unknown>;
}

/**
 * Find, or make, this user's Stripe customer. The mapping is stored on our side
 * so a second purchase attaches to the same customer instead of creating a
 * duplicate that the billing portal cannot see.
 */
async function customerFor(userId: string, email: string | null, key: string): Promise<string> {
  const db = admin();
  const { data } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const existing = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (existing) return existing;

  const params: Record<string, string> = { "metadata[user_id]": userId };
  if (email) params.email = email;
  // The idempotency key is the user id: two taps in the same second cannot
  // produce two customers.
  const customer = await stripe("/customers", key, params, `cust-${userId}`);
  const id = String(customer.id ?? "");
  if (!id) throw new Error("upstream");

  await db
    .from("subscriptions")
    .upsert({ user_id: userId, stripe_customer_id: id, status: "none" }, { onConflict: "user_id" });
  return id;
}

async function createCheckout(
  userId: string,
  email: string | null,
  planId: unknown,
): Promise<Response> {
  // The client sent a plan id and nothing else that matters. The price is
  // resolved here, from the environment — never from the request.
  if (!isPlanId(planId)) return fail("unknown-plan", 400);
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  const price = Deno.env.get(PRICE_ENV[planId]);
  if (!key || !price) return fail("unconfigured", 503);

  const returnUrl = Deno.env.get("BILLING_RETURN_URL") ?? "mystyle://paywall";
  const customer = await customerFor(userId, email, key);

  const session = await stripe("/checkout/sessions", key, {
    mode: "subscription",
    customer,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "subscription_data[trial_period_days]": String(TRIAL_DAYS),
    "subscription_data[metadata][user_id]": userId,
    "subscription_data[metadata][plan_id]": planId,
    "metadata[user_id]": userId,
    "metadata[plan_id]": planId,
    // Stripe appends its own session id; the app only needs to land somewhere.
    success_url: `${returnUrl}?checkout=done`,
    cancel_url: `${returnUrl}?checkout=cancelled`,
    allow_promotion_codes: "true",
  });

  const url = typeof session.url === "string" ? session.url : null;
  if (!url) return fail("upstream", 502);
  return json({ url });
}

async function createPortal(userId: string): Promise<Response> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return fail("unconfigured", 503);

  const db = admin();
  const { data } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  const customer = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  // Nothing to manage means nothing to open — and no reason to create a
  // customer record for someone who has never bought anything.
  if (!customer) return fail("unknown-plan", 404);

  const returnUrl = Deno.env.get("BILLING_RETURN_URL") ?? "mystyle://paywall";
  const session = await stripe("/billing_portal/sessions", key, {
    customer,
    return_url: returnUrl,
  });
  const url = typeof session.url === "string" ? session.url : null;
  if (!url) return fail("upstream", 502);
  return json({ url });
}

// ------------------------------------------------------------- the webhook

/**
 * Verify Stripe's `Stripe-Signature` header against the raw body.
 *
 * This is the whole security model of the webhook, so it is done by hand
 * rather than pulled from a library: the header carries a timestamp and one or
 * more v1 HMACs; the signed payload is `timestamp.body`; the secret is
 * whsec_… . A stale timestamp is rejected so a captured request cannot be
 * replayed a week later, and the comparison is constant-time so the signature
 * cannot be guessed a byte at a time.
 */
async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "t") timestamp = v ?? "";
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - sent);
  if (age > toleranceSeconds) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Stripe statuses mapped onto the four this app stores. Anything unrecognised
 * becomes "none", which grants nothing. */
function mapStatus(stripeStatus: unknown, cancelAtPeriodEnd: boolean): string {
  const s = String(stripeStatus ?? "");
  if (s === "trialing") return "trialing";
  if (s === "active") return cancelAtPeriodEnd ? "canceled" : "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  if (s === "canceled" || s === "incomplete_expired") return "expired";
  return "none";
}

function isoFromUnix(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

async function handleWebhook(req: Request): Promise<Response> {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return fail("unconfigured", 503);

  // The RAW body, read once, before anything is parsed out of it: the
  // signature covers the exact bytes Stripe sent, so re-serialising the JSON
  // would break it.
  const raw = await req.text();
  const ok = await verifyStripeSignature(raw, req.headers.get("Stripe-Signature"), secret);
  // Nothing below this line runs for an unsigned body.
  if (!ok) return fail("bad-signature", 400);

  let event: { id?: unknown; type?: unknown; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return fail("bad-json", 400);
  }

  const eventId = typeof event.id === "string" ? event.id : "";
  const type = typeof event.type === "string" ? event.type : "";
  if (!eventId) return fail("bad-json", 400);

  const db = admin();

  // IDEMPOTENCY. Stripe retries until it gets a 2xx, and it can deliver the
  // same event more than once even on success. Claiming the event id first
  // means a repeat is acknowledged without being applied a second time; the
  // primary key on event_id is what makes the claim atomic.
  const claim = await db.from("billing_events").insert({ event_id: eventId, type });
  if (claim.error) {
    // Already recorded (unique violation) — or the table is unreachable. Either
    // way, do not apply it twice. A 200 stops Stripe retrying a duplicate.
    const duplicate = String(claim.error.code ?? "") === "23505";
    if (duplicate) return json({ received: true, duplicate: true });
    console.error("billing_events insert failed", claim.error.code);
    // Not a duplicate: something is wrong on our side. A non-2xx asks Stripe to
    // try again later, which is exactly what we want.
    return fail("server", 500);
  }

  try {
    await applyEvent(db, type, event.data?.object ?? {});
  } catch (err) {
    console.error("apply failed", type, String(err).slice(0, 120));
    // Release the claim so Stripe's retry can apply it properly.
    await db.from("billing_events").delete().eq("event_id", eventId);
    return fail("server", 500);
  }

  return json({ received: true });
}

async function applyEvent(
  db: ReturnType<typeof admin>,
  type: string,
  object: Record<string, unknown>,
): Promise<void> {
  // Only subscription lifecycle events change what somebody may use. Everything
  // else Stripe sends is acknowledged and ignored.
  const interesting =
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted" ||
    type === "checkout.session.completed";
  if (!interesting) return;

  if (type === "checkout.session.completed") {
    // Checkout only tells us the customer is now attached to this user; the
    // subscription events carry the dates. Recording the customer id here means
    // the billing portal works even if a subscription event is delayed.
    const userId = readUserId(object);
    const customer = typeof object.customer === "string" ? object.customer : null;
    if (!userId || !customer) return;
    const { error } = await db
      .from("subscriptions")
      .upsert({ user_id: userId, stripe_customer_id: customer }, { onConflict: "user_id" });
    if (error) throw new Error("db");
    return;
  }

  const userId = readUserId(object);
  if (!userId) return; // A subscription we cannot attribute grants nobody anything.

  const cancelAtPeriodEnd = object.cancel_at_period_end === true;
  const status =
    type === "customer.subscription.deleted"
      ? "expired"
      : mapStatus(object.status, cancelAtPeriodEnd);

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const planId = isPlanId(metadata.plan_id) ? metadata.plan_id : null;

  const row = {
    user_id: userId,
    status,
    plan_id: planId,
    current_period_end: isoFromUnix(object.current_period_end),
    trial_ends_at: isoFromUnix(object.trial_end),
    stripe_customer_id: typeof object.customer === "string" ? object.customer : null,
    stripe_subscription_id: typeof object.id === "string" ? object.id : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error("db");
}

/** The user id Stripe is carrying for us. It is written into metadata when the
 * checkout session is created, which is the only place it can come from — a
 * subscription with no user id belongs to nobody and is dropped. */
function readUserId(object: Record<string, unknown>): string | null {
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const id = metadata.user_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
