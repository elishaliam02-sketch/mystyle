// APEX — server-side AI proxy (Supabase Edge Function, Deno).
//
// Why this exists: an API key is a real secret. Ship it in the app and it is
// extractable from the bundle, and strangers can spend your quota until the
// provider bans the key. So it never touches the client. The app sends the
// question (or the photo) here; this function holds the key, calls the model,
// and returns only the answer.
//
// Provider: Gemini first, because it has a genuine free tier that also accepts
// images — which is what makes "photograph the meal, get the calories" free.
// Anthropic is used instead when its key is the one that is set. If neither is
// configured the function says so plainly and the app falls back to its own
// on-device coach, so nothing ever breaks for the person using it.
//
// The caller chooses a task, never the instructions: the system prompt and,
// for a meal photo, the whole prompt are built here (prompts.ts).
//
// Deploy:  supabase functions deploy ai          (ships prompts.ts with it)
// Needs:   supabase/migration-006-security.sql   (the durable rate limiter)
// Secret:  supabase secrets set GEMINI_API_KEY=...
//     (or) supabase secrets set ANTHROPIC_API_KEY=...
// Web:     supabase secrets set ALLOWED_ORIGINS=https://your-web-app.example
//          (the phone apps send no Origin and need nothing here)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { coachSystemPrompt, mealPhotoPrompt, type Locale } from "./prompts.ts";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 800;
const MAX_PROMPT_CHARS = 4000;
/** A photo is ~1.4x its byte size in base64; keep well under the request cap. */
const MAX_IMAGE_CHARS = 6_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Counted in Postgres (ai_count), not in this instance's memory: an in-memory
// count reset on every cold start and was never shared between instances.
// Anonymous accounts cost nothing to create, so they get a lower daily ceiling,
// and the global ceiling bounds what any number of fresh accounts can spend.
const limit = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const PER_MINUTE = limit("AI_PER_MINUTE", 12);
const PER_DAY = limit("AI_PER_DAY", 60);
const PER_DAY_ANONYMOUS = limit("AI_PER_DAY_ANONYMOUS", 30);
const GLOBAL_PER_DAY = limit("AI_GLOBAL_PER_DAY", 2000);

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8081,http://localhost:19006")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Echoes the Origin back only when it is on the list. Native apps send none. */
function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // nosemgrep: cors-misconfiguration -- echoed only after matching ALLOWED_ORIGINS
    res.headers.set("Access-Control-Allow-Origin", origin);
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  }
  res.headers.append("Vary", "Origin");
  return res;
}

type Task = "coach" | "meal";
type Parsed =
  | { ok: true; task: Task; locale: Locale; prompt: string; image: string; mimeType: string }
  | { ok: false; error: string };

/** Every field is checked for type, not just trimmed: a number where text was
 * expected used to throw outside any handler. */
function parseBody(raw: unknown): Parsed {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "bad-body" };
  const b = raw as Record<string, unknown>;
  const str = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "string" ? v : null);

  const prompt = str(b.prompt);
  const image = str(b.imageBase64);
  const mime = str(b.mimeType);
  if (prompt === null || image === null || mime === null) return { ok: false, error: "bad-body" };

  const locale: Locale = b.locale === "en" ? "en" : "he";
  // Older app builds send no task; a photo means the meal reader.
  const task = b.task ?? (image ? "meal" : "coach");
  if (task !== "coach" && task !== "meal") return { ok: false, error: "unknown-task" };

  if (task === "meal") {
    if (!image) return { ok: false, error: "empty" };
    if (image.length > MAX_IMAGE_CHARS) return { ok: false, error: "image-too-large" };
    const mimeType = mime || "image/jpeg";
    if (!IMAGE_TYPES.includes(mimeType)) return { ok: false, error: "bad-image-type" };
    return { ok: true, task, locale, prompt: mealPhotoPrompt(locale), image, mimeType };
  }

  const text = prompt.trim();
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MAX_PROMPT_CHARS) return { ok: false, error: "too-long" };
  return { ok: true, task, locale, prompt: text, image: "", mimeType: "" };
}

Deno.serve(async (req: Request) => withCors(req, await handle(req)));

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // 1. Who is calling — the token is verified with the service key, as the
  //    admin function does; new-API-key projects do not always inject the
  //    legacy anon key this used to depend on.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^[Bb]earer\s+/, "").trim();
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const { data: userData } = await db.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  // 2. Read and check the request before spending anything on it.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const body = parseBody(raw);
  if (!body.ok) return json({ error: body.error }, body.error === "image-too-large" ? 413 : 400);

  // 3. Count it. Without the migration this fails closed, and the app falls
  //    back to its on-device coach as it does for any unavailable server.
  const anonymous = user.is_anonymous === true;
  const { data: counts, error: countErr } = await db.rpc("ai_count", {
    keys: [`user:${user.id}:minute`, `user:${user.id}:day`, "global:day"],
    seconds: [60, 86_400, 86_400],
  });
  if (countErr || !Array.isArray(counts)) return json({ error: "unconfigured" }, 503);
  const [minute, day, global] = counts as number[];
  if (minute > PER_MINUTE || day > (anonymous ? PER_DAY_ANONYMOUS : PER_DAY)) {
    return json({ error: "rate-limited" }, 429);
  }
  if (global > GLOBAL_PER_DAY) return json({ error: "quota" }, 429);

  const system = body.task === "coach" ? coachSystemPrompt(body.locale) : "";
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    if (geminiKey) return await callGemini(geminiKey, system, body.prompt, body.image, body.mimeType);
    if (anthropicKey) {
      // Anthropic has no free tier; only used when it is the configured key.
      if (body.image) return json({ error: "vision-unavailable" }, 400);
      return await callAnthropic(anthropicKey, system, body.prompt);
    }
    return json({ error: "unconfigured" }, 503);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}


async function callGemini(
  key: string,
  system: string,
  prompt: string,
  image: string,
  mimeType: string,
): Promise<Response> {
  const parts: unknown[] = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: mimeType, data: image } });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.4 },
      }),
    },
  );

  if (res.status === 429) return json({ error: "quota" }, 429);
  if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return json({ text });
}

async function callAnthropic(key: string, system: string, prompt: string): Promise<Response> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
  const data = await res.json();
  return json({ text: data?.content?.[0]?.text ?? "" });
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
