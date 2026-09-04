/**
 * The transport for the full-state backup blob — one row per account in a
 * `backups` table, holding the device-local data as JSON. Kept apart from the
 * granular sync port so the two never tangle. Every call degrades to "no
 * server" rather than throwing, so the app is never worse off for trying.
 */
import type { BackupBundle } from "./backup";
import { supabase } from "./client";

export type RemoteBackup = { bundle: BackupBundle; at: string } | null;

/** Read the account's backup, or null when there is none / no server. */
export async function pullBackup(userId: string): Promise<RemoteBackup> {
  const db = supabase();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("backups")
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { data: BackupBundle | null; updated_at: string | null };
    if (!row.data || !row.updated_at) return null;
    return { bundle: row.data, at: row.updated_at };
  } catch {
    return null;
  }
}

/** Write the account's backup. Returns the stamp stored, or null on failure. */
export async function pushBackup(
  userId: string,
  bundle: BackupBundle,
  at: string,
): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  try {
    const { error } = await db
      .from("backups")
      .upsert({ user_id: userId, data: bundle, updated_at: at });
    return error ? null : at;
  } catch {
    return null;
  }
}
