/**
 * Body measurements — the tape-measure numbers that move when the scale won't.
 * A pure module: it knows the parts of the body worth tracking and how to read
 * a series of readings (latest, change since the start, direction). No clock,
 * no store, no network — so it is fully testable and the screen just renders it.
 */

export type BodyPart =
  | "waist" | "chest" | "arm" | "thigh" | "hips" | "shoulders";

/** The parts a plan tracks, in the order they appear on the screen. */
export const BODY_PARTS: BodyPart[] = ["waist", "chest", "arm", "thigh", "hips", "shoulders"];

export type Reading = { date: string; cm: number };

/** A human tape measure runs roughly 10–300 cm; anything outside is a typo. */
export const MIN_CM = 10;
export const MAX_CM = 300;

export function isStorableCm(cm: number): boolean {
  return Number.isFinite(cm) && cm >= MIN_CM && cm <= MAX_CM;
}

export type Change = {
  latest: number | null;
  first: number | null;
  /** latest − first, in cm. Positive is bigger, negative is smaller. */
  delta: number;
  count: number;
};

/**
 * Reads a series (in any order) into the numbers the screen shows. Sorted by
 * date so "first" is the earliest reading and "latest" the most recent, which
 * is what makes the change meaningful rather than order-of-entry noise.
 */
export function measureChange(series: Reading[]): Change {
  if (series.length === 0) return { latest: null, first: null, delta: 0, count: 0 };
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].cm;
  const latest = sorted[sorted.length - 1].cm;
  return {
    latest,
    first,
    delta: Math.round((latest - first) * 10) / 10,
    count: sorted.length,
  };
}
