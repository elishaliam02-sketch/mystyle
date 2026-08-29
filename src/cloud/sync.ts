import type { AppState, CheckIn, Completion, Habit, Profile, WeighIn } from "@/store/types";

/**
 * Pushing and pulling the whole state.
 *
 * The app is offline-first: everything works from the device, and the server
 * is a copy that outlives it. So the merge rules are deliberately simple and
 * never lose a local action:
 *
 * - habits merge by id, newest `updated_at` wins
 * - completions, weigh-ins and check-ins are keyed by (habit, date) or date,
 *   so they union rather than overwrite; a day logged on either side survives
 * - the profile takes whichever side has a name, preferring local, because the
 *   only way to get a blank one is a fresh install pulling before it writes
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
};

export interface CloudPort {
  /** Everything on the server for this user. */
  pull(userId: string): Promise<Rows>;
  /** Upserts; must be safe to call with rows that already exist. */
  push(userId: string, state: AppState): Promise<void>;
}

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

export function mergeCompletions(local: Completion[], remote: Completion[]): Completion[] {
  const seen = new Set<string>();
  const out: Completion[] = [];
  for (const c of [...remote, ...local]) {
    const key = `${c.habitId}|${c.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Keyed by date; the local row wins a same-day clash because it is newer. */
export function mergeByDate<T extends { date: string }>(local: T[], remote: T[]): T[] {
  const byDate = new Map<string, T>();
  for (const row of remote) byDate.set(row.date, row);
  for (const row of local) byDate.set(row.date, row);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeProfile(local: Profile, remote: Profile | null): Profile {
  if (!remote) return local;
  return {
    ...remote,
    ...local,
    // A name only ever moves from empty to set, never back.
    name: local.name || remote.name,
    startKg: local.startKg ?? remote.startKg,
    goalKg: local.goalKg ?? remote.goalKg,
    // Onboarding done anywhere means done.
    onboarded: local.onboarded || remote.onboarded,
  };
}

export function mergeState(local: AppState, remote: Rows): AppState {
  return {
    profile: mergeProfile(local.profile, remote.profile),
    habits: mergeHabits(local.habits, remote.habits),
    completions: mergeCompletions(local.completions, remote.completions),
    weighIns: mergeByDate(local.weighIns, remote.weighIns),
    checkIns: mergeByDate(local.checkIns, remote.checkIns),
  };
}

/**
 * One round: read the server, merge it into what the device has, write the
 * result back. Returns the merged state so the caller can adopt it.
 */
export async function syncOnce(
  port: CloudPort,
  userId: string,
  local: AppState,
): Promise<AppState> {
  const remote = await port.pull(userId);
  const merged = mergeState(local, remote);
  await port.push(userId, merged);
  return merged;
}
