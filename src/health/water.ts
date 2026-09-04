/**
 * How much water to drink, and how to read where you are against it.
 *
 * The recommendation is a range, not a single number, because hydration is —
 * roughly 30-40 ml per kilo of body weight, turned into cups of 250 ml, floored
 * and capped so it stays sane for a very light or very heavy person. The app
 * shows the band ("6-10 cups"), the person's own chosen goal within it, and
 * refuses a goal outside a livable range. Pure and testable.
 */

/** One cup is 250 ml — the unit the tracker counts in. */
export const CUP_ML = 250;

/** The goal a person may set for themselves, in cups. */
export const MIN_WATER_GOAL = 4;
export const MAX_WATER_GOAL = 16;

/** The recommended daily range in cups, from body weight. */
export function recommendedRange(weightKg?: number): { min: number; max: number } {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  const lowMl = w * 30;
  const highMl = w * 40;
  const min = Math.max(MIN_WATER_GOAL, Math.round(lowMl / CUP_ML));
  const max = Math.min(MAX_WATER_GOAL, Math.max(min + 1, Math.round(highMl / CUP_ML)));
  return { min, max };
}

/** The default daily goal — the middle of the recommended band, rounded. */
export function defaultWaterGoal(weightKg?: number): number {
  const { min, max } = recommendedRange(weightKg);
  return Math.round((min + max) / 2);
}

export function isStorableWaterGoal(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n >= MIN_WATER_GOAL && n <= MAX_WATER_GOAL;
}

export type WaterStatus = "empty" | "low" | "onTrack" | "met" | "over";

/**
 * Where today's intake sits against the goal and the healthy band. "over" is a
 * gentle flag, not an error — a cup too many is not a problem, but the app
 * should not silently cheer someone past a sensible ceiling either.
 */
export function waterStatus(cups: number, goal: number, weightKg?: number): WaterStatus {
  const { max } = recommendedRange(weightKg);
  const ceiling = Math.max(goal, max) + 4;
  if (cups <= 0) return "empty";
  if (cups >= ceiling) return "over";
  if (cups >= goal) return "met";
  if (cups >= Math.ceil(goal / 2)) return "onTrack";
  return "low";
}

/** How full the bottle should draw, 0..1, clamped. */
export function fillFraction(cups: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(1, cups / goal));
}
