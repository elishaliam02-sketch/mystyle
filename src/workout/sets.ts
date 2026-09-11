/**
 * Set-by-set logging, the way a lifting app actually works: each set carries
 * its own weight and reps, and the screen shows what you did on that exercise
 * last time so you know what to beat. Pure functions over the stored log.
 */

export type SetEntry = { kg: number; reps: number; done: boolean };

/** date (YYYY-MM-DD) → exercise id → its sets that day. */
export type SetLog = Record<string, Record<string, SetEntry[]>>;

export const MAX_SETS = 12;

/** Sane ceilings for a single set — a bar tops out well under a tonne, and
 * nobody does a thousand reps. They stop a typo (999999) from poisoning the
 * volume total and faking a personal best. */
export const MAX_SET_KG = 1000;
export const MAX_SET_REPS = 1000;

/** A weight for one set: non-negative, at most half a tonne, one decimal. */
export function clampKg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_SET_KG, Math.round(n * 10) / 10);
}

/** Reps for one set: a non-negative whole number, capped. */
export function clampReps(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_SET_REPS, Math.round(n));
}

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

/**
 * Estimated one-rep-max from a working set, by the Epley formula
 * (1RM = kg x (1 + reps/30)). It is the number lifters actually chase: it lets
 * 60kg x 10 and 80kg x 5 be compared on one scale, so progress shows even when
 * the weight on the bar did not change. A single rep is already a max, and a
 * bodyweight-only set (kg 0) has no meaningful 1RM.
 */
export function epley1RM(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(kg * 10) / 10;
  return Math.round(kg * (1 + reps / 30) * 10) / 10;
}

/** The best estimated 1RM across a session's completed sets. */
export function bestOneRepMax(sets: SetEntry[]): number {
  return sets.reduce((m, s) => (s.done ? Math.max(m, epley1RM(s.kg, s.reps)) : m), 0);
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
  /** Best estimated one-rep-max today, 0 when nothing is done or all bodyweight. */
  oneRepMax: number;
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
    oneRepMax: bestOneRepMax(sets),
  };
}

/**
 * What a person is allowed to have typed *so far* into a weight or reps box.
 *
 * The set table used to push every keystroke through `clampKg` and render the
 * number back, which silently ate a trailing decimal point: typing "62." became
 * 62, the dot vanished, and the next key produced 625. Half of all real gym
 * weights end in .5, so the screen rejected half the weights it exists to
 * record. The fix is to keep what was typed and only interpret it when it is a
 * complete number — this decides what counts as typed.
 *
 * Both separators are accepted because a Hebrew keyboard offers a comma where
 * an English one offers a full stop; the caller normalises before parsing.
 */
export function typedNumber(text: string, decimals: boolean): string {
  const cleaned = decimals ? text.replace(/[^0-9.,]/g, "") : text.replace(/[^0-9]/g, "");
  if (!decimals) return cleaned.slice(0, 4);
  // one separator only, and at most one digit after it
  const m = /^(\d{0,4})(?:[.,](\d?))?/.exec(cleaned);
  if (!m) return "";
  const [, whole = "", frac] = m;
  const sep = /[.,]/.test(cleaned.slice(whole.length, whole.length + 1));
  return sep ? `${whole}.${frac ?? ""}` : whole;
}

/** The number a partially typed box currently means, or null while it means
 * nothing yet ("", ".", "62." — all still mid-word). */
export function typedValue(text: string): number | null {
  if (text === "" || text === "." || text.endsWith(".")) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
