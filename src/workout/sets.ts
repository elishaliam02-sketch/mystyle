/**
 * Set-by-set logging, the way a lifting app actually works: each set carries
 * its own weight and reps, and the screen shows what you did on that exercise
 * last time so you know what to beat. Pure functions over the stored log.
 */

export type SetEntry = { kg: number; reps: number; done: boolean };

/** date (YYYY-MM-DD) → exercise id → its sets that day. */
export type SetLog = Record<string, Record<string, SetEntry[]>>;

export const MAX_SETS = 12;

/** A fresh, empty session for an exercise the plan prescribes `n` sets of. */
export function blankSets(n: number): SetEntry[] {
  const count = Math.max(1, Math.min(MAX_SETS, Math.round(n) || 1));
  return Array.from({ length: count }, () => ({ kg: 0, reps: 0, done: false }));
}

/**
 * What this exercise looked like the last time it was trained *before* today —
 * the "previous" column. Strictly earlier dates, so re-opening today's session
 * never shows today's own numbers back as history.
 */
export function previousSets(log: SetLog, exerciseId: string, today: string): SetEntry[] | null {
  const dates = Object.keys(log)
    .filter((d) => d < today && (log[d]?.[exerciseId]?.length ?? 0) > 0)
    .sort();
  const last = dates[dates.length - 1];
  return last ? log[last][exerciseId] : null;
}

/** Total weight moved in the sets that were actually ticked off. */
export function sessionVolume(sets: SetEntry[]): number {
  return Math.round(sets.reduce((n, s) => (s.done ? n + s.kg * s.reps : n), 0));
}

/** The heaviest completed set, for a personal best. */
export function topSet(sets: SetEntry[]): SetEntry | null {
  const done = sets.filter((s) => s.done && s.kg > 0);
  if (done.length === 0) return null;
  return done.reduce((a, b) => (b.kg > a.kg ? b : a));
}

/** True once every set in the exercise is ticked. */
export function allSetsDone(sets: SetEntry[]): boolean {
  return sets.length > 0 && sets.every((s) => s.done);
}

export type Progress = {
  /** Weight moved today, in kg. */
  volume: number;
  /** Weight moved the previous time this exercise was trained. */
  prevVolume: number;
  /** Percent change against last time; null when there is nothing to compare. */
  deltaPct: number | null;
  /** True when today's heaviest set beats the previous session's. */
  personalBest: boolean;
};

/**
 * Today against last time, which is the only comparison progressive overload
 * actually needs. Volume is the honest headline — heavier bar, more reps, or an
 * extra set all move it — and the personal best is called on the top set alone,
 * because that is what people mean by a PR. Both read only ticked sets: a
 * number typed and not performed is a plan, not a lift.
 */
export function progress(sets: SetEntry[], prev: SetEntry[] | null): Progress {
  const volume = sessionVolume(sets);
  const prevVolume = prev ? sessionVolume(prev) : 0;
  const top = topSet(sets);
  const prevTop = prev ? topSet(prev) : null;
  return {
    volume,
    prevVolume,
    deltaPct: prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null,
    personalBest: !!top && (!prevTop || top.kg > prevTop.kg),
  };
}
