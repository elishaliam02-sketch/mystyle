/**
 * What the push function accepts from a phone, decided without Deno so it is
 * tested in Node (src/push/pushplantest.ts).
 *
 * The server is told only *when* and *which*: an id like "water@2026-10-03"
 * and a time. The words of the reminder never leave the device — the browser
 * reads them from its own storage when the push arrives.
 */

export const MAX_ITEMS = 60;
export const HORIZON_MS = 21 * 86_400_000;
/** A reminder this far in the past is still sent (the phone was slow to say). */
export const GRACE_MS = 5 * 60_000;

export type QueueItem = { reminder: string; at: string };

const ID = /^[a-z0-9-]{1,40}@\d{4}-\d{2}-\d{2}$/;

/** The schedule a phone sent, cleaned: well-formed, unique, near, and capped. */
export function cleanSchedule(input: unknown, nowMs: number): QueueItem[] | null {
  if (!Array.isArray(input) || input.length > 500) return null;
  const seen = new Set<string>();
  const out: QueueItem[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const { id, at } = raw as { id?: unknown; at?: unknown };
    if (typeof id !== "string" || !ID.test(id) || seen.has(id)) continue;
    const t = typeof at === "string" || typeof at === "number" ? new Date(at).getTime() : NaN;
    if (!Number.isFinite(t) || t < nowMs - GRACE_MS || t > nowMs + HORIZON_MS) continue;
    seen.add(id);
    out.push({ reminder: id, at: new Date(t).toISOString() });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, MAX_ITEMS);
}

/** A subscription as the browser hands it over, checked before it is kept. */
export function cleanSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!input || typeof input !== "object") return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  // Only a real push service over HTTPS — never a private address the server
  // could be tricked into calling.
  if (url.protocol !== "https:" || !isPushHost(url.hostname)) return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh)) return null;
  if (typeof auth !== "string" || !/^[A-Za-z0-9_-]{16,40}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/** The push services browsers use: Apple, Google (Chrome, Edge via WNS too), Mozilla. */
export function isPushHost(host: string): boolean {
  return [
    /^web\.push\.apple\.com$/,
    /(^|\.)push\.apple\.com$/,
    /^fcm\.googleapis\.com$/,
    /^android\.googleapis\.com$/,
    /(^|\.)push\.services\.mozilla\.com$/,
    /(^|\.)notify\.windows\.com$/,
  ].some((re) => re.test(host));
}
