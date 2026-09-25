import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, cloudConfigured } from "./config";
import { secureStorage } from "./secureStorage";

/**
 * One client for the app. Created lazily so a build that never signs in pays
 * nothing, and so a misconfigured project degrades to local-only rather than
 * throwing at import time.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // The session has to outlive the process, or every launch is a new user
      // and the data on the server becomes unreachable. It lives in the device
      // keystore (encrypted), not plain storage — see secureStorage.
      storage: secureStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Only the web has a URL to read a session out of.
      detectSessionInUrl: Platform.OS === "web",
      // PKCE: an emailed link carries a one-time code that only redeems on the
      // device that asked for it (the verifier is stored here). The implicit
      // flow put raw tokens in the link, and any link with anyone's tokens
      // would sign this device into that account.
      flowType: "pkce",
    },
  });
  return client;
}

export type CloudState =
  /** Still working out whether there is a session. */
  | "connecting"
  /** Signed in; data is being kept on the server. */
  | "synced"
  /** Working, but only on this device — no server reached. */
  | "local"
  /** Reached the server and it refused. Worth telling the user. */
  | "error";

/**
 * Signs in anonymously if there is no session yet. Anonymous accounts still
 * get their own user id, so row level security isolates them exactly like an
 * email account — the difference is only that no email was asked for.
 */
export async function ensureSession(): Promise<
  { ok: true; userId: string } | { ok: false; reason: CloudState }
> {
  const db = supabase();
  if (!db) return { ok: false, reason: "local" };

  try {
    const existing = await db.auth.getSession();
    const current = existing.data.session?.user?.id;
    if (current) return { ok: true, userId: current };

    const created = await db.auth.signInAnonymously();
    if (created.error || !created.data.user) {
      return { ok: false, reason: "error" };
    }
    return { ok: true, userId: created.data.user.id };
  } catch {
    // No network, DNS failure, a host that blocks the request: all local.
    return { ok: false, reason: "local" };
  }
}

export type AccountInfo = {
  userId: string;
  email: string | null;
  anonymous: boolean;
  /** Whether the address has been confirmed by clicking the emailed link.
   *  False while a confirmation is outstanding — the screens must not claim
   *  the data is backed up until this is true. */
  confirmed: boolean;
  /** An address the person asked to change to, not yet confirmed. */
  pendingEmail: string | null;
};

/** Who is signed in right now, or null when local-only. */
export async function currentAccount(): Promise<AccountInfo | null> {
  const db = supabase();
  if (!db) return null;
  try {
    const { data } = await db.auth.getUser();
    const u = data.user;
    if (!u) return null;
    const pending = (u as { new_email?: string | null }).new_email ?? null;
    return {
      userId: u.id,
      email: u.email ?? null,
      anonymous: !u.email,
      // Supabase only stamps this once the emailed link is clicked. When
      // confirmation is switched off in the project it is stamped at signup,
      // so this reads true for everyone and nothing below changes.
      confirmed: !!u.email_confirmed_at,
      pendingEmail: pending,
    };
  } catch {
    return null;
  }
}

/** The shortest password this app sets. Signing in still accepts the older
 * six-character ones, so no existing account is locked out; set the same
 * minimum (and leaked-password protection) under Supabase → Authentication
 * → Providers → Email so the server enforces it too. */
export const MIN_NEW_PASSWORD = 8;

export type AuthResult =
  | { ok: true; needsConfirmation?: boolean; email?: string }
  | { ok: false; message: string };

function readableError(message: string): string {
  const m = message.toLowerCase();
  // No connection is not "something went wrong": supabase hands a failed
  // fetch back as an error rather than throwing it.
  if (m.includes("fetch") || m.includes("network") || m.includes("timeout") || m.includes("timed out")) return "local";
  if (m.includes("already registered") || m.includes("already been registered")) return "exists";
  if (m.includes("invalid login")) return "badLogin";
  if (m.includes("password")) return "weakPassword";
  if (m.includes("email")) return "badEmail";
  return "generic";
}

/**
 * Turn the current (anonymous) account into a permanent email one, WITHOUT
 * losing anything: updateUser keeps the same user id, so every row already
 * synced stays the person's. This is what makes "sign up" safe — the data you
 * built up before you had an email comes with you.
 */
/** No auth call may leave the button on "connecting…" forever. */
const AUTH_TIMEOUT_MS = 15_000;
function inTime<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), AUTH_TIMEOUT_MS)),
  ]);
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  return inTime(signUpInner(email, password)).catch(() => ({ ok: false as const, message: "local" }));
}

async function signUpInner(email: string, password: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    const address = email.trim();
    // Make sure there is a session (anonymous) to upgrade, so the id is kept.
    await ensureSession();
    const { data, error } = await db.auth.updateUser({ email: address, password });
    if (error) {
      // A brand-new anonymous user updateUser can fail on some setups; fall
      // back to a normal sign-up so the person still gets an account.
      const signUp = await db.auth.signUp({ email: address, password });
      if (signUp.error) return { ok: false, message: readableError(signUp.error.message) };
      // No session back from signUp means the project requires a confirmed
      // email. Saying "signed in, backed up" here would be a plain lie: until
      // that link is clicked nothing syncs.
      return { ok: true, needsConfirmation: !signUp.data.session, email: address };
    }
    // On an upgrade the address only becomes the account's once confirmed;
    // until then Supabase parks it in new_email and the old identity stands.
    const pending = (data.user as { new_email?: string | null } | null)?.new_email ?? null;
    const changed = data.user?.email?.toLowerCase() === address.toLowerCase();
    return { ok: true, needsConfirmation: !!pending || !changed, email: address };
  } catch {
    return { ok: false, message: "local" };
  }
}

/**
 * Sends the confirmation email again.
 *
 * People mistype addresses, and mail lands in spam. Without this the only way
 * out of an unconfirmed account is to wait for a link that may never arrive,
 * which is how someone loses the data they just signed up to protect.
 */
export async function resendConfirmation(email: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    const { error } = await db.auth.resend({ type: "signup", email: email.trim() });
    if (error) return { ok: false, message: readableError(error.message) };
    return { ok: true, needsConfirmation: true, email: email.trim() };
  } catch {
    return { ok: false, message: "local" };
  }
}

/**
 * Starts a password reset: Supabase emails a link that opens the app on the
 * reset screen with a session attached.
 *
 * `redirectTo` has to be a link this app can actually receive — the scheme URL
 * on a phone, the site's own origin on the web — and the same value has to be
 * listed as a redirect URL in the Supabase dashboard, or the link lands
 * nowhere. Without this whole path, forgetting a password means losing the
 * account and every synced row with it, which makes "sign up so you never lose
 * your data" untrue.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { ok: false, message: readableError(error.message) };
    return { ok: true, email: email.trim() };
  } catch {
    return { ok: false, message: "local" };
  }
}

/** How long a sign-in or a redeemed reset link counts as fresh proof. */
const RECENT_PROOF_S = 10 * 60;

/** Did this session prove who it is in the last few minutes — a password, a
 * reset link, an emailed code? Read from the token's `amr` claim, the same
 * record the server checks before deleting an account. */
function provedRecently(accessToken: string | undefined, nowS = Date.now() / 1000): boolean {
  try {
    const part = (accessToken ?? "").split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const claims = JSON.parse(atob(b64)) as { amr?: { method?: string; timestamp?: number }[] };
    return (claims.amr ?? []).some(
      (a) => a.method !== "anonymous" && typeof a.timestamp === "number" && nowS - a.timestamp <= RECENT_PROOF_S,
    );
  } catch {
    return false;
  }
}

/**
 * Sets a new password for the session the reset link established. Fails
 * plainly when there is no such session, rather than appearing to work — and
 * when the session did not come from a fresh link or sign-in, since otherwise
 * anyone holding an unlocked phone could open the reset screen and change the
 * password without knowing it.
 */
export async function setNewPassword(password: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    const { data } = await db.auth.getSession();
    if (!data.session) return { ok: false, message: "noSession" };
    if (!provedRecently(data.session.access_token)) return { ok: false, message: "noSession" };
    const { error } = await db.auth.updateUser({ password });
    if (error) return { ok: false, message: readableError(error.message) };
    return { ok: true };
  } catch {
    return { ok: false, message: "local" };
  }
}

/**
 * Turns a password-reset link into a session.
 *
 * Only a PKCE `code` is accepted, and it only redeems on the device that
 * requested the reset. Raw tokens in a link are refused: accepting them let a
 * crafted link sign the phone into someone else's account, after which what
 * the person logged synced to that account. On the web, supabase-js redeems
 * the code from the URL itself, so the session is read back — and trusted only
 * when it proves a fresh reset or sign-in, not merely because one exists.
 */
export async function sessionFromResetLink(params: { code?: string }): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  try {
    if (params.code) await db.auth.exchangeCodeForSession(params.code);
    const { data } = await db.auth.getSession();
    return !!data.session && provedRecently(data.session.access_token);
  } catch {
    return false;
  }
}

/** Sign in to an existing email account on this device. */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    const { error } = await inTime(db.auth.signInWithPassword({ email: email.trim(), password }));
    if (error) return { ok: false, message: readableError(error.message) };
    return { ok: true };
  } catch {
    return { ok: false, message: "local" };
  }
}

/** Sign out and drop back to a fresh anonymous, local-first session. */
/**
 * Deletes the account and everything in it, server-side.
 *
 * The client cannot remove a row from auth.users — no client key may — so this
 * calls a security-definer function that deletes the caller's own user row and
 * lets the schema's cascades take the data with it. Deleting only the rows we
 * can reach from here would leave the login, the email and the backup blob
 * behind, which is not deletion in any sense a person or a regulator would
 * accept.
 *
 * An email account must sign in again with its password first: the server
 * refuses a deletion without a sign-in in the last ten minutes, so a phone
 * left unlocked or a lifted session token cannot erase anyone. An anonymous
 * account has no password to ask for.
 *
 * "none" means there is nothing to delete server-side (local-only install).
 */
export type DeleteResult = "deleted" | "none" | "wrong-password" | "failed";

export async function deleteAccount(password?: string): Promise<DeleteResult> {
  const db = supabase();
  if (!db) return "none";
  try {
    const { data } = await db.auth.getSession();
    const user = data.session?.user;
    if (!user) return "none";

    if (user.email && !user.is_anonymous) {
      if (!password) return "wrong-password";
      const again = await db.auth.signInWithPassword({ email: user.email, password });
      if (again.error) {
        return /invalid login credentials/i.test(again.error.message) ? "wrong-password" : "failed";
      }
    }

    const { error } = await db.rpc("delete_my_account");
    if (error) return "failed";
  } catch {
    return "failed";
  }

  // The session is now a token for a user that no longer exists; clearing it
  // stops the app trying to sync into a hole.
  try {
    await db.auth.signOut();
  } catch {
    // Already gone server-side — nothing to do.
  }
  return "deleted";
}

export async function signOut(): Promise<void> {
  const db = supabase();
  if (!db) return;
  try {
    await db.auth.signOut();
  } catch {
    // best effort
  }
}
