/**
 * The pure half of "continue with Google / Apple": reading what the provider
 * sent back, and deciding where to go after. No Supabase, no React Native, so
 * every rule is tested (oauthtest.ts).
 */

export type OAuthProvider = "google" | "apple";

export function isProvider(v: unknown): v is OAuthProvider {
  return v === "google" || v === "apple";
}

/** Only a path inside this app: "/profile" yes; "//evil.com", "https://…",
 * "javascript:" no. The next hop rides in a URL anyone can craft. */
export function safeNext(v: unknown): string {
  if (typeof v !== "string") return "/";
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\s:]/.test(v)) return "/";
  return v;
}

/** The in-app path the provider returns to. */
export function callbackPath(provider: OAuthProvider, next: string): string {
  return `/auth-callback?p=${provider}&next=${encodeURIComponent(safeNext(next))}`;
}

export type Callback =
  | { kind: "code"; code: string }
  /** No code and no error: the web client already redeemed it from the URL. */
  | { kind: "none" }
  /** An anonymous account tried to link a Google/Apple identity that already
   * belongs to another account — sign in to that account instead. */
  | { kind: "alreadyLinked" }
  | { kind: "cancelled" }
  | { kind: "error" };

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** What came back on the callback URL (query and fragment merged). */
export function readCallback(params: Params): Callback {
  const error = one(params.error);
  const code = one(params.error_code);
  const description = one(params.error_description).toLowerCase();
  if (error || code) {
    if (code === "identity_already_exists" || description.includes("already linked") || description.includes("already exists")) {
      return { kind: "alreadyLinked" };
    }
    if (error === "access_denied" && !description.includes("server")) return { kind: "cancelled" };
    return { kind: "error" };
  }
  const authCode = one(params.code);
  if (authCode) return { kind: "code", code: authCode };
  return { kind: "none" };
}

/** "#a=1&b=2" or "?a=1" → { a: "1", b: "2" }. */
export function paramsOf(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of fragment.replace(/^[#?]/, "").split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, " "));
    const v = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
    if (k) out[k] = v;
  }
  return out;
}

/** Whether an account can prove itself with a password (it has an email
 * identity). A Google- or Apple-only account cannot, and must sign in with its
 * provider again instead. Reads Supabase's `app_metadata`. */
export function hasPasswordIdentity(appMetadata: unknown): boolean {
  const m = (appMetadata ?? {}) as { provider?: unknown; providers?: unknown };
  const list = Array.isArray(m.providers) ? m.providers : typeof m.provider === "string" ? [m.provider] : [];
  // No record at all: an older email account — keep asking for the password.
  if (list.length === 0) return true;
  return list.includes("email");
}
