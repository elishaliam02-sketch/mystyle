/**
 * How much water to drink, and how to read where you are against it.
 *
 * The recommendation is a range, not a single number, because hydration is —
 * roughly 30-40 ml per kilo of body weight, turned into cups of 250 ml, floored
 * and capped so it stays sane for a very light or very heavy person. The app
 * shows the band ("6-10 cups"), the person's own chosen goal within it, and
 * refuses a goal outside a livable range. Pure and testable.
 */

/** One cup is 250 ml by default — the unit the tracker counts in. A person can
 * change it to match the glass or bottle they actually drink from. */
export const CUP_ML = 250;

/** The cup sizes offered, in ml — a small glass through a large sports bottle. */
export const CUP_SIZES = [200, 250, 330, 500, 750] as const;

export const MIN_CUP_ML = 100;
export const MAX_CUP_ML = 1500;

/** A stored cup size is sane: a real vessel, not a typo. */
export function isStorableCupMl(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_CUP_ML && n <= MAX_CUP_ML;
}

/** The cup size to count in, defaulting to 250 ml when none is chosen or the
 * stored one makes no sense. */
export function cupMlOf(stored?: number): number {
  return stored && isStorableCupMl(stored) ? Math.round(stored) : CUP_ML;
}

/** The goal a person may set for themselves, in cups. */
export const MIN_WATER_GOAL = 4;
export const MAX_WATER_GOAL = 16;

/** The recommended daily range in cups, from body weight. */
export function recommendedRange(
  weightKg?: number,
  cupMl: number = CUP_ML,
): { min: number; max: number } {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  const cup = isStorableCupMl(cupMl) ? cupMl : CUP_ML;
  const lowMl = w * 30;
  const highMl = w * 40;
  // The band is in cups, so a bigger cup means fewer of them for the same ml.
  const min = Math.max(MIN_WATER_GOAL, Math.round(lowMl / cup));
  const max = Math.min(MAX_WATER_GOAL, Math.max(min + 1, Math.round(highMl / cup)));
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
