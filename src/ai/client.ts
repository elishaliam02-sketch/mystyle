/**
 * The one door to Claude. Every AI feature in the app goes through here, so
 * availability, consent, failure handling and the "is it on?" signal are
 * decided in a single place.
 *
 * Transport today is the published preview's sampling runtime (window.claude).
 * In the native app that object does not exist, so `resolve()` yields null and
 * every caller falls back to written content. Phase 3 swaps this file for our
 * own server; nothing outside it changes.
 */

export type AiState =
  | "checking"
  /** Claude answered — content on screen is personalised. */
  | "ready"
  /** No Claude here at all (native app, non-viewer host). Never say "error". */
  | "unavailable"
  /** The viewer declined. Permanent for this view; do not re-ask. */
  | "declined"
  /** Something went wrong this time. A retry is worth offering. */
  | "failed";

type SampleFn = ((input: unknown, options?: unknown) => Promise<unknown>) & {
  json?: <T>(input: unknown, options?: unknown) => Promise<T>;
};

let resolved: Promise<SampleFn | null> | null = null;

function resolve(): Promise<SampleFn | null> {
  if (resolved) return resolved;
  resolved = (async () => {
    const host = globalThis as { claude?: { use?: (name: string) => Promise<unknown> } };
    if (!host.claude?.use) return null;
    try {
      const fn = (await host.claude.use("sample")) as SampleFn | null;
      return fn && typeof fn.json === "function" ? fn : null;
    } catch {
      return null;
    }
  })();
  return resolved;
}

/** True when this build can reach Claude at all. Cheap; asks the viewer nothing. */
export async function aiPossible(): Promise<boolean> {
  return (await resolve()) !== null;
}

export type AskResult<T> =
  | { ok: true; value: T }
  | { ok: false; state: Exclude<AiState, "checking" | "ready"> };

/**
 * Ask Claude for JSON and map every failure onto a state the UI can speak
 * about honestly. Callers never see an exception.
 */
export async function askJson<T>(
  prompt: string,
  opts: {
    signal?: AbortSignal;
    /** "quick" for short work, "default" when the answer needs judgement. */
    tier?: "quick" | "default";
    /** Milliseconds an answer may be replayed. Omit for a fresh answer. */
    cacheMs?: number;
    validate: (raw: unknown) => T | null;
  },
): Promise<AskResult<T>> {
  const sample = await resolve();
  if (!sample?.json) return { ok: false, state: "unavailable" };
  if (opts.signal?.aborted) return { ok: false, state: "failed" };

  try {
    const raw = await sample.json(prompt, {
      modelTier: opts.tier ?? "quick",
      signal: opts.signal,
      cache: opts.cacheMs ? { gcTime: opts.cacheMs } : false,
    });
    const value = opts.validate(raw);
    return value ? { ok: true, value } : { ok: false, state: "failed" };
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "not_granted" || code === "sampling_disabled") {
      return { ok: false, state: "declined" };
    }
    if (code === "not_declared" || code === "capability_disabled" || code === "capability_removed") {
      return { ok: false, state: "unavailable" };
    }
    // cancelled, rate_limited, refused, invalid_json, upstream_error: this
    // attempt failed, another one later may not.
    return { ok: false, state: "failed" };
  }
}

/** Shared helpers for reading Claude's JSON defensively. */
export function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
