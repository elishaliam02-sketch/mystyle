import type { AppState, CheckIn, Completion, Habit, Profile, WeighIn } from "@/store/types";

/**
 * Pushing and pulling state.
 *
 * The app is offline-first: everything works from the device, and the server
 * is a copy that outlives it. Two properties matter, and everything here
 * exists to hold them:
 *
 * 1. **Nothing the user did is lost.** Every row carries `updatedAt`, and a
 *    clash is settled by whichever side wrote last — never by whichever side
 *    happened to be read first. That is what lets unticking a habit survive:
 *    it is a newer write of `done: false`, not a missing row.
 * 2. **A sync costs about what changed.** After the first one, only rows
 *    touched since the last sync move in either direction. A user with two
 *    years of history and one tick today sends one row, not seven hundred.
 *
 * The transport is passed in rather than imported, which is what lets the
 * whole merge be tested without a network.
 */

export type Rows = {
  profile: Profile | null;
  habits: Habit[];
  completions: Completion[];
  weighIns: WeighIn[];
  checkIns: CheckIn[];
  /**
   * The server's own clock, read at the moment of the pull. This — not the
   * device's clock — is what the next pull asks from, and the difference is
   * not academic: a phone that was offline for three days pushes rows the
   * device stamped three days ago, and any device filtering by its own clock
   * would step straight over them and never see that week of history.
   */
  cursor?: string;
};

export interface CloudPort {
  /**
   * Rows for this user. `since` is a cursor from a previous pull's `cursor`:
   * when given, the server returns only what it recorded after it. Returning
   * everything is still correct, just slower — the merge does not care.
   */
  pull(userId: string, since?: string): Promise<Rows>;
  /** Upserts; must be safe to call with rows that already exist. */
  push(userId: string, changes: Changes): Promise<void>;
}

/** The subset of a state that a push actually has to carry. */
export type Changes = {
  profile: Profile | null;
  habits: Habit[];
  completions: Completion[];
  weighIns: WeighIn[];
  checkIns: CheckIn[];
};

/** True only when both sides are timed and `a` is strictly newer. */
function newest(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a > b;
}

export function mergeHabits(local: Habit[], remote: Habit[]): Habit[] {
  const byId = new Map<string, Habit>();
  for (const habit of remote) byId.set(habit.id, habit);

  for (const habit of local) {
    const existing = byId.get(habit.id);
    if (!existing) {
      byId.set(habit.id, habit);
      continue;
    }
    // The device is where the user just acted, so the local row is kept unless
    // the server's copy is demonstrably newer — an edit from another device.
    // An untimed local row therefore wins: it was written before habits
    // carried timestamps, and it is still the more recent truth here.
    byId.set(habit.id, newest(existing.updatedAt, habit.updatedAt) ? existing : habit);
  }

  return [...byId.values()];
}

/**
 * Keyed by (habit, date), settled by time. Unioning the two sides — the old
 * rule — could not express unticking: the row the device had deleted came
 * straight back from the server. Now both sides always have a row, and the
 * newer one wins whether it says done or not.
 */
export function mergeCompletions(local: Completion[], remote: Completion[]): Completion[] {
  const byKey = new Map<string, Completion>();
  for (const c of remote) byKey.set(`${c.habitId}|${c.date}`, c);

  for (const c of local) {
    const key = `${c.habitId}|${c.date}`;
    const existing = byKey.get(key);
    // Ties go to the device: the user is holding it.
    byKey.set(key, existing && existing.updatedAt > c.updatedAt ? existing : c);
  }

  return [...byKey.values()];
}

/** Keyed by date, settled the same way: the newer write of that day wins. */
export function mergeByDate<T extends { date: string; updatedAt: string }>(
  local: T[],
  remote: T[],
): T[] {
  const byDate = new Map<string, T>();
  for (const row of remote) byDate.set(row.date, row);
  for (const row of local) {
    const existing = byDate.get(row.date);
    byDate.set(row.date, existing && existing.updatedAt > row.updatedAt ? existing : row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeProfile(local: Profile, remote: Profile | null): Profile {
  if (!remote) return local;
  const remoteNewer = newest(remote.updatedAt, local.updatedAt);
  const winner = remoteNewer ? remote : local;
  const loser = remoteNewer ? local : remote;

  return {
    ...loser,
    ...winner,
    // A name only ever moves from empty to set, never back — a blank profile
    // is what a fresh install has before it writes, not a decision.
    name: winner.name || loser.name,
    startKg: winner.startKg ?? loser.startKg,
    goalKg: winner.goalKg ?? loser.goalKg,
    // Onboarding done anywhere means done.
    onboarded: local.onboarded || remote.onboarded,
  };
}

export function mergeState(local: AppState, remote: Rows): AppState {
  return {
    ...local,
    profile: mergeProfile(local.profile, remote.profile),
    habits: mergeHabits(local.habits, remote.habits),
    completions: mergeCompletions(local.completions, remote.completions),
    // A weigh-in deleted here stays deleted: the server's copy of that day is
    // dropped unless it was written after the deletion (a new reading).
    weighIns: mergeByDate(local.weighIns, remote.weighIns).filter((w) => {
      const gone = local.weighInsRemoved?.[w.date];
      return !gone || w.updatedAt > gone;
    }),
    checkIns: mergeByDate(local.checkIns, remote.checkIns),
  };
}

/**
 * What this device has to send.
 *
 * A row goes out only when both are true: the device wrote it after the last
 * sync, and the server's copy is not already that same write. The second
 * condition is what stops a sync from echoing back everything it just pulled;
 * the first is what stops it from re-sending years of untouched history, which
 * the server already has and did not ask about.
 *
 * With no cursor — a first sync, or a fresh install — everything qualifies,
 * which is exactly right, because the server has none of it.
 */
export function outgoingChanges(merged: AppState, remote: Rows, sincePush?: string): Changes {
  const touched = (t?: string) => !sincePush || !t || t > sincePush;
  /** The server already holds this exact write. */
  const settled = (mine?: string, theirs?: string) => theirs !== undefined && theirs === mine;

  const profileSettled =
    remote.profile !== null && settled(merged.profile.updatedAt, remote.profile.updatedAt);

  const remoteHabits = new Map(remote.habits.map((h) => [h.id, h.updatedAt]));
  const remoteCompletions = new Map(
    remote.completions.map((c) => [`${c.habitId}|${c.date}`, c.updatedAt]),
  );
  const remoteWeighIns = new Map(remote.weighIns.map((w) => [w.date, w.updatedAt]));
  const remoteCheckIns = new Map(remote.checkIns.map((c) => [c.date, c.updatedAt]));

  return {
    profile:
      touched(merged.profile.updatedAt) && !profileSettled ? merged.profile : null,
    habits: merged.habits.filter(
      (h) => touched(h.updatedAt) && !settled(h.updatedAt, remoteHabits.get(h.id)),
    ),
    completions: merged.completions.filter(
      (c) =>
        touched(c.updatedAt) &&
        !settled(c.updatedAt, remoteCompletions.get(`${c.habitId}|${c.date}`)),
    ),
    weighIns: merged.weighIns.filter(
      (w) => touched(w.updatedAt) && !settled(w.updatedAt, remoteWeighIns.get(w.date)),
    ),
    checkIns: merged.checkIns.filter(
      (c) => touched(c.updatedAt) && !settled(c.updatedAt, remoteCheckIns.get(c.date)),
    ),
  };
}

export function isEmptyChanges(c: Changes): boolean {
  return (
    c.profile === null &&
    c.habits.length === 0 &&
    c.completions.length === 0 &&
    c.weighIns.length === 0 &&
    c.checkIns.length === 0
  );
}

/**
 * One round: ask the server for what it recorded since last time, merge that
 * into what the device has, send back only what the device changed. Returns
 * the merged state with both cursors advanced, so the caller can adopt it
 * wholesale.
 *
 * There are two cursors because there are two clocks, and conflating them is
 * how rows go missing. What to *ask* for is the server's business, so it is
 * kept in server time. What to *send* is this device's own recent work, so it
 * is kept in device time and compared only against this device's own stamps.
 *
 * The push cursor is taken before the pull, not after the push: anything the
 * user writes while the sync is in flight then falls after it and goes next
 * time, rather than being silently skipped.
 */
export async function syncOnce(
  port: CloudPort,
  userId: string,
  local: AppState,
): Promise<AppState> {
  const startedAt = new Date().toISOString();

  const remote = await port.pull(userId, local.lastSyncAt);
  const merged = mergeState(local, remote);

  const outgoing = outgoingChanges(merged, remote, local.lastPushAt);
  if (!isEmptyChanges(outgoing)) await port.push(userId, outgoing);

  return {
    ...merged,
    // Only advance the pull cursor on a server that actually gave us one;
    // guessing here would skip whatever it did not send.
    lastSyncAt: remote.cursor ?? local.lastSyncAt,
    lastPushAt: startedAt,
  };
}
