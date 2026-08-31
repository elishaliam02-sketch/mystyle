// APEX — server-side AI proxy (Supabase Edge Function, Deno).
//
// Why this exists: the Anthropic key is a real secret. Ship it in the app and
// it is extractable from the bundle, and anyone can spend against it. So it
// never touches the client. The app sends the prompt here; this function holds
// the key, calls Claude, and returns only the text. The key lives in the
// function's environment (`supabase secrets set ANTHROPIC_API_KEY=...`) and is
// never in git or the app.
//
// Every call is authenticated: the caller's Supabase JWT is verified, so only
// signed-in users of this project can reach it, and abuse is rate-limited per
// user. This is the "critical logic on the server" the client cannot expose.
//
// Deploy:  supabase functions deploy ai --no-verify-jwt=false
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;

// A tiny in-memory limiter — one instance, best-effort. For hard limits, back
// this with a table; this stops a runaway client cheaply.
const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // 1. Verify the caller is a signed-in user of this project.
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "unauthorized" }, 401);
  if (rateLimited(user.id)) return json({ error: "rate-limited" }, 429);

  // 2. Read the prompt. The client sends system + user text, nothing else — the
  //    model, token budget and safety framing are decided here, not there.
  let body: { system?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const prompt = (body.prompt ?? "").slice(0, 4000);
  const system = (body.system ?? "").slice(0, 4000);
  if (!prompt) return json({ error: "empty" }, 400);

  // 3. Call Claude with the server-held key.
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "unconfigured" }, 500);

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  return json({ text });
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
