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

export type AccountInfo = { userId: string; email: string | null; anonymous: boolean };

/** Who is signed in right now, or null when local-only. */
export async function currentAccount(): Promise<AccountInfo | null> {
  const db = supabase();
  if (!db) return null;
  try {
    const { data } = await db.auth.getUser();
    const u = data.user;
    if (!u) return null;
    return { userId: u.id, email: u.email ?? null, anonymous: !u.email };
  } catch {
    return null;
  }
}

export type AuthResult = { ok: true } | { ok: false; message: string };

function readableError(message: string): string {
  const m = message.toLowerCase();
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
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    // Make sure there is a session (anonymous) to upgrade, so the id is kept.
    await ensureSession();
    const { error } = await db.auth.updateUser({ email: email.trim(), password });
    if (error) {
      // A brand-new anonymous user updateUser can fail on some setups; fall
      // back to a normal sign-up so the person still gets an account.
      const signUp = await db.auth.signUp({ email: email.trim(), password });
      if (signUp.error) return { ok: false, message: readableError(signUp.error.message) };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "local" };
  }
}

/** Sign in to an existing email account on this device. */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  try {
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, message: readableError(error.message) };
    return { ok: true };
  } catch {
    return { ok: false, message: "local" };
  }
}

/** Sign out and drop back to a fresh anonymous, local-first session. */
export async function signOut(): Promise<void> {
  const db = supabase();
  if (!db) return;
  try {
    await db.auth.signOut();
  } catch {
    // best effort
  }
}
