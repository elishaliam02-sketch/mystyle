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
// Deploy:  supabase functions deploy ai
// Secret:  supabase secrets set GEMINI_API_KEY=...
//     (or) supabase secrets set ANTHROPIC_API_KEY=...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 800;
/** A photo is ~1.4x its byte size in base64; keep well under the request cap. */
const MAX_IMAGE_CHARS = 6_000_000;

// A tiny in-memory limiter — one instance, best-effort. The free tier's daily
// quota is shared by everyone using the app, so this is what stops one device
// from spending it all.
const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

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

  // 2. Read the request. The client sends text and, for a meal photo, an image.
  //    The model, token budget and safety framing are decided here, not there.
  let body: { system?: string; prompt?: string; imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const prompt = (body.prompt ?? "").slice(0, 4000);
  const system = (body.system ?? "").slice(0, 4000);
  const image = body.imageBase64 ?? "";
  const mimeType = body.mimeType ?? "image/jpeg";
  if (!prompt) return json({ error: "empty" }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "image-too-large" }, 413);

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    if (geminiKey) return await callGemini(geminiKey, system, prompt, image, mimeType);
    if (anthropicKey) {
      // Anthropic has no free tier; only used when it is the configured key.
      if (image) return json({ error: "vision-unavailable" }, 400);
      return await callAnthropic(anthropicKey, system, prompt);
    }
    return json({ error: "unconfigured" }, 503);
  } catch {
    return json({ error: "upstream" }, 502);
  }
});

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
    headers: { ...cors, "content-type": "application/json" },
  });
}
