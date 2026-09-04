/**
 * Full-state backup of the data the granular sync does not carry.
 *
 * The row-by-row sync in sync.ts keeps habits, completions, weigh-ins,
 * check-ins and the profile merged across devices. Everything else the app now
 * holds — the training plan and its set log, the food diary, water, steps,
 * measurements, goals and preferences — lived only on the device and would be
 * lost the moment the app was deleted. This backs those up as one JSON blob per
 * account, so a reinstalled or new phone gets them all back.
 *
 * The merge is last-write-wins on the whole bundle, by a single timestamp: the
 * device that saved most recently wins. That is the right rule for a backup
 * (as opposed to the field-level merge the social data gets) — simple, and it
 * never silently invents a state that was never on any device. Pure and tested;
 * the transport lives in backupPort.ts.
 */
import type { AppState } from "@/store/types";

/** The state keys backed up as a blob — the ones the granular sync omits. */
export const BACKUP_KEYS = [
  "pantry",
  "training",
  "intake",
  "water",
  "waterGoal",
  "measurements",
  "nutritionGoal",
  "dietFilter",
  "favorites",
  "steps",
  "stepGoal",
  "videoIds",
  "salt",
  "mealShuffle",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];
export type BackupBundle = Partial<Pick<AppState, BackupKey>>;

/** The bundle to upload: exactly the backed-up keys that are set. */
export function backupBundle(state: AppState): BackupBundle {
  const out: BackupBundle = {};
  for (const key of BACKUP_KEYS) {
    const v = state[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

/**
 * A stable signature of the backed-up data, so the sync can tell whether the
 * local blob actually changed since it was last uploaded and skip a needless
 * write. Order-independent enough for this: the keys are fixed and few.
 */
export function backupSignature(bundle: BackupBundle): string {
  return JSON.stringify(bundle);
}

export type BackupDecision =
  /** Nothing to do — server matches, or there is no server copy and no change. */
  | { action: "none" }
  /** Adopt the server's copy: apply these fields to local. */
  | { action: "restore"; bundle: BackupBundle }
  /** Push local up: the device's copy is newer or the server has none. */
  | { action: "upload"; bundle: BackupBundle; at: string };

/**
 * Decide what a backup round should do.
 *
 * - No remote yet → upload local (first backup).
 * - Remote strictly newer than what this device last saw → restore it, unless
 *   the device has unsynced local changes newer than the remote, in which case
 *   the local wins and is uploaded (a reinstall with fresh edits still keeps
 *   them).
 * - Otherwise, if local changed since the last upload → upload it.
 */
export function decideBackup(args: {
  local: BackupBundle;
  /** When the local data was last changed, device clock (ISO). */
  localChangedAt: string;
  /** The blob and stamp currently on the server, or null when there is none. */
  remote: { bundle: BackupBundle; at: string } | null;
  /** The server stamp this device last adopted or wrote, if any. */
  lastSeenAt?: string;
}): BackupDecision {
  const { local, localChangedAt, remote, lastSeenAt } = args;

  if (!remote) {
    // First ever backup for this account.
    return { action: "upload", bundle: local, at: localChangedAt };
  }

  const remoteIsNew = !lastSeenAt || remote.at > lastSeenAt;
  const localIsNewer = localChangedAt > remote.at;

  if (remoteIsNew && !localIsNewer) {
    return { action: "restore", bundle: remote.bundle };
  }

  // Local is the freshest — upload it if it differs from what the server holds.
  if (backupSignature(local) !== backupSignature(remote.bundle)) {
    return { action: "upload", bundle: local, at: localChangedAt };
  }

  return { action: "none" };
}

/**
 * Whether a bundle holds no real user data yet — a fresh or reinstalled device.
 * salt, goals and preferences alone do not count; only actual logged content
 * (a plan, food, water, steps, measurements, favourites, a pantry) does. This
 * is what lets a blank new phone safely *restore* the account instead of
 * uploading its emptiness over it.
 */
export function isEmptyBackup(bundle: BackupBundle): boolean {
  const has = (v: unknown) =>
    v !== undefined && v !== null && (typeof v !== "object" || Object.keys(v as object).length > 0);
  return !(
    has(bundle.training) ||
    has(bundle.intake) ||
    has(bundle.water) ||
    has(bundle.steps) ||
    has(bundle.measurements) ||
    has(bundle.favorites) ||
    (typeof bundle.pantry === "string" && bundle.pantry.trim().length > 0)
  );
}

/** Apply a restored bundle onto the local state, replacing the backed-up keys. */
export function applyBackup(state: AppState, bundle: BackupBundle): AppState {
  const next: AppState = { ...state };
  for (const key of BACKUP_KEYS) {
    if (key in bundle) {
      (next as Record<string, unknown>)[key] = (bundle as Record<string, unknown>)[key];
    }
  }
  return next;
}
