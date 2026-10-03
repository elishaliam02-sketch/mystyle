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
import { isBirthYear, isHeightCm } from "@/health";
import { MAX_HISTORY } from "@/workout/session";
import type { AppState } from "@/store/types";

/** The state keys backed up as a blob — the ones the granular sync omits. */
export const BACKUP_KEYS = [
  "pantry",
  "training",
  "intake",
  "water",
  "waterMl",
  "waterGoal",
  "waterGoalMl",
  "cupMl",
  "measurements",
  "goal",
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
/** The profile's device-only facts. The profile itself syncs as a row that
 * holds only the name and weights, so without these a restored phone lost the
 * height (which guards the goal weight), the sex and the age. */
export type ProfileExtras = { heightCm?: number; sex?: "male" | "female"; birthYear?: number };
export type BackupBundle = Partial<Pick<AppState, BackupKey>> & { profileExtras?: ProfileExtras };

/** The bundle to upload: exactly the backed-up keys that are set. */
export function backupBundle(state: AppState): BackupBundle {
  const out: BackupBundle = {};
  for (const key of BACKUP_KEYS) {
    const v = state[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  const { heightCm, sex, birthYear } = state.profile;
  if (heightCm !== undefined || sex !== undefined || birthYear !== undefined) {
    out.profileExtras = {
      ...(heightCm !== undefined ? { heightCm } : {}),
      ...(sex !== undefined ? { sex } : {}),
      ...(birthYear !== undefined ? { birthYear } : {}),
    };
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
    has(bundle.waterMl) ||
    has(bundle.steps) ||
    has(bundle.measurements) ||
    has(bundle.favorites) ||
    (typeof bundle.pantry === "string" && bundle.pantry.trim().length > 0)
  );
}

/** Apply a restored bundle onto the local state, replacing the backed-up keys. */
/** The shape each backed-up key must have to be restored. The blob comes back
 * from the server, where another app version (or anyone holding the account)
 * may have written it; a wrong-typed value restored into state is saved
 * locally and crashes the screens that read it on every launch after. */
const isRecord = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const SHAPE: Record<BackupKey, (v: unknown) => boolean> = {
  pantry: (v) => typeof v === "string",
  training: isRecord,
  intake: isRecord,
  water: isRecord,
  waterMl: isRecord,
  waterGoal: isNum,
  waterGoalMl: isNum,
  cupMl: isNum,
  measurements: isRecord,
  goal: (v) => typeof v === "string",
  nutritionGoal: (v) => typeof v === "string",
  dietFilter: (v) => typeof v === "string",
  favorites: (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
  steps: isRecord,
  stepGoal: isNum,
  videoIds: isRecord,
  salt: (v) => typeof v === "string",
  mealShuffle: isNum,
};

/** Restores the backed-up keys whose values have the right shape; a key that
 * does not keeps what the device already has. */
export function applyBackup(state: AppState, bundle: BackupBundle): AppState {
  if (!isRecord(bundle)) return state;
  const next: AppState = { ...state };
  for (const key of BACKUP_KEYS) {
    if (!Object.hasOwn(bundle, key)) continue;
    const value = (bundle as Record<string, unknown>)[key];
    if (SHAPE[key](value)) (next as Record<string, unknown>)[key] = value;
  }
  // The logs kept day by day are merged rather than swapped: the backup's
  // version of a day wins, but a day only this device has is kept. Swapping
  // them whole meant that with two devices, the one that restored lost every
  // meal, glass and workout logged on it since the other one uploaded.
  next.intake = withLocalDays(next.intake, state.intake);
  next.waterMl = withLocalDays(next.waterMl, state.waterMl);
  next.water = withLocalDays(next.water, state.water);
  next.steps = withLocalDays(next.steps, state.steps);
  next.measurements = mergeMeasurements(next.measurements, state.measurements);
  next.training = mergeTraining(next.training, state.training);
  // The device-only profile facts fill gaps and never overwrite: what this
  // phone already knows was typed on it.
  const raw = (bundle as { profileExtras?: unknown }).profileExtras;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const extras = raw as Record<string, unknown>;
    const p = { ...next.profile };
    if (p.heightCm === undefined && typeof extras.heightCm === "number" && isHeightCm(extras.heightCm)) p.heightCm = extras.heightCm;
    if (p.sex === undefined && (extras.sex === "male" || extras.sex === "female")) p.sex = extras.sex;
    if (p.birthYear === undefined && typeof extras.birthYear === "number" && isBirthYear(extras.birthYear)) p.birthYear = extras.birthYear;
    next.profile = p;
  }
  return next;
}

function withLocalDays<T>(
  restored: Record<string, T> | undefined,
  local: Record<string, T> | undefined,
): Record<string, T> | undefined {
  if (!restored || restored === local || !isRecord(restored)) return restored ?? local;
  if (!local || !isRecord(local)) return restored;
  const out: Record<string, T> = { ...restored };
  for (const [day, value] of Object.entries(local)) {
    if (!Object.hasOwn(out, day)) out[day] = value;
  }
  return out;
}

type Readings = { date: string; cm?: number; kg?: number }[];

/** Two series of dated readings as one: the backup's reading for a date wins. */
function mergeReadings<R extends { date: string }>(restored: R[], local: R[]): R[] {
  const dates = new Set(restored.map((r) => r.date));
  return [...restored, ...local.filter((r) => !dates.has(r.date))].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeMeasurements(
  restored: AppState["measurements"],
  local: AppState["measurements"],
): AppState["measurements"] {
  if (!restored || restored === local || !isRecord(restored)) return restored ?? local;
  if (!local || !isRecord(local)) return restored;
  const out: Record<string, Readings> = { ...(restored as Record<string, Readings>) };
  for (const [part, series] of Object.entries(local)) {
    const theirs = out[part];
    out[part] = Array.isArray(theirs) && Array.isArray(series) ? mergeReadings(theirs, series) : theirs ?? series;
  }
  return out as AppState["measurements"];
}

/** Two lists of things with ids as one; the backup's copy of an id wins. */
function unionById<T extends { id: string }>(restored: T[] | undefined, local: T[] | undefined): T[] | undefined {
  if (!Array.isArray(restored)) return local;
  if (!Array.isArray(local)) return restored;
  const ids = new Set(restored.map((x) => x.id));
  return [...restored, ...local.filter((x) => x && !ids.has(x.id))];
}

/**
 * The training record from a backup, with this device's own days and sessions
 * kept. Settings (goal, days, the plan) come from the backup; the logs merge;
 * and a workout running on this phone right now is never ended by a restore.
 */
function mergeTraining(restored: AppState["training"], local: AppState["training"]): AppState["training"] {
  if (!restored || restored === local || !isRecord(restored)) return restored ?? local;
  if (!local || !isRecord(local)) return restored;
  const weights: Record<string, { date: string; kg: number }[]> = { ...(restored.weights ?? {}) };
  for (const [id, series] of Object.entries(local.weights ?? {})) {
    const theirs = weights[id];
    weights[id] = Array.isArray(theirs) && Array.isArray(series) ? mergeReadings(theirs, series) : theirs ?? series;
  }
  const history = unionById(restored.history, local.history)
    ?.slice()
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
    .slice(-MAX_HISTORY);
  return {
    ...restored,
    log: withLocalDays(restored.log, local.log) ?? {},
    setLog: withLocalDays(restored.setLog, local.setLog),
    extra: withLocalDays(restored.extra, local.extra),
    weights,
    custom: unionById(restored.custom, local.custom) ?? [],
    history,
    active: local.active ?? restored.active,
  };
}

/**
 * Both devices changed since they last agreed, and this one is newer: its
 * settings and its version of any shared day win, and the other device's days
 * are added rather than overwritten. Whether a workout is running is this
 * device's call — it is the one in the person's hand.
 */
export function combineBoth(state: AppState, remote: BackupBundle): AppState {
  if (!isRecord(remote)) return state;
  const theirs: AppState = { ...state };
  for (const key of BACKUP_KEYS) {
    if (!Object.hasOwn(remote, key)) continue;
    const value = (remote as Record<string, unknown>)[key];
    if (SHAPE[key](value)) (theirs as Record<string, unknown>)[key] = value;
  }
  const out = applyBackup(theirs, backupBundle(state));
  if (out.training) out.training = { ...out.training, active: state.training?.active };
  return out;
}
