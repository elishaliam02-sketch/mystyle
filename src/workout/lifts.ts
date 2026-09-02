/**
 * Lift history — the weight actually moved on each exercise.
 *
 * Progressive overload is the whole game in the gym: what matters next session
 * is what you lifted last session. This is a pure module over a series of
 * readings, so the screen only has to render "last" and "best".
 */

export type Lift = { date: string; kg: number };

/** A plate-loaded lift lives between half a kilo and half a tonne. */
export const MIN_KG = 0.5;
export const MAX_KG = 500;

export function isStorableKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
}

/** The most recent reading by date, or null when nothing is logged yet. */
export function lastLift(series: Lift[]): Lift | null {
  if (series.length === 0) return null;
  return [...series].sort((a, b) => a.date.localeCompare(b.date))[series.length - 1];
}

/** The heaviest weight ever logged for this exercise. */
export function bestLift(series: Lift[]): number {
  return series.reduce((m, l) => Math.max(m, l.kg), 0);
}
