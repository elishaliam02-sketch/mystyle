import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, cloudConfigured } from "./config";

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
      // and the data on the server becomes unreachable.
      storage: AsyncStorage,
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
