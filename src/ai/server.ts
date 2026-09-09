/**
 * The app's door to the model, through our own server.
 *
 * The key lives in the Supabase Edge Function, never here — so this file only
 * knows the function's address and the caller's session. Every call can fail,
 * and failing is normal (no key configured, the free tier's daily quota spent,
 * no signal). So nothing here throws: callers get a typed reason and fall back
 * to the on-device coach, which always works.
 */
import { supabase } from "@/cloud/client";
import { aiConsentGiven } from "@/legal";
import { SUPABASE_URL, cloudConfigured } from "@/cloud/config";

export type ServerAiFailure =
  /** No server, no key, or the project is not configured — use the local coach. */
  | "unavailable"
  /** The free tier's quota is spent for now. Worth saying out loud. */
  | "quota"
  /** Reached it and it went wrong this time; a retry is reasonable. */
  | "failed";

export type ServerAiResult =
  | { ok: true; text: string }
  | { ok: false; reason: ServerAiFailure };

const ENDPOINT = `${SUPABASE_URL}/functions/v1/ai`;
const TIMEOUT_MS = 30_000;

/**
 * Asks the model. `imageBase64` turns it into a vision call — that is what
 * reads a meal photograph.
 */
export async function askServer(opts: {
  prompt: string;
  system?: string;
  imageBase64?: string;
  mimeType?: string;
  signal?: AbortSignal;
}): Promise<ServerAiResult> {
  // The question, the numbers behind it and any meal photo are personal data
  // going to a third party, so this is gated on an explicit opt-in. Reported
  // as "unavailable" rather than a refusal: every caller already falls back to
  // the on-device coach for that reason, and the screens already say which of
  // the two the person is reading.
  if (!aiConsentGiven()) return { ok: false, reason: "unavailable" };
  if (!cloudConfigured) return { ok: false, reason: "unavailable" };
  const db = supabase();
  if (!db) return { ok: false, reason: "unavailable" };

  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: "unavailable" };

  // A model call is slow; a hung one must not leave the screen spinning.
  const timer = new AbortController();
  const cancel = setTimeout(() => timer.abort(), TIMEOUT_MS);
  const onOuter = () => timer.abort();
  opts.signal?.addEventListener("abort", onOuter);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        prompt: opts.prompt,
        system: opts.system,
        imageBase64: opts.imageBase64,
        mimeType: opts.mimeType,
      }),
      signal: timer.signal,
    });

    if (res.status === 429) return { ok: false, reason: "quota" };
    // 503 is the function saying no key is configured — that is "unavailable",
    // not an error to apologise for.
    if (res.status === 503) return { ok: false, reason: "unavailable" };
    if (!res.ok) return { ok: false, reason: "failed" };

    const body = (await res.json()) as { text?: string; error?: string };
    if (body.error === "quota") return { ok: false, reason: "quota" };
    if (body.error === "unconfigured") return { ok: false, reason: "unavailable" };
    const text = (body.text ?? "").trim();
    if (!text) return { ok: false, reason: "failed" };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(cancel);
    opts.signal?.removeEventListener("abort", onOuter);
  }
}
