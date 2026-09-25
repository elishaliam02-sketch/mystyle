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

// ---------------------------------------------------------------- in ml
//
// The tracker stores millilitres, not cups: a cup count multiplied by
// whatever glass is chosen *now* turned yesterday's 500 ml into a litre the
// moment someone picked a bigger bottle. Cups are only a display unit.

/** Nobody drinks more than this in a day; a runaway tap stops here. */
export const MAX_DAY_ML = 8000;
/** The goal a person may set for themselves, in ml. */
export const MIN_GOAL_ML = 1000;
export const MAX_GOAL_ML = 6000;
/** The goals offered as chips. */
export const GOAL_CHOICES_ML = [1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 4000, 4500, 5000] as const;

const round50 = (n: number) => Math.round(n / 50) * 50;

/** The recommended daily band in ml: 30–40 ml per kilo, kept to 1.5–5 L. */
export function recommendedMl(weightKg?: number): { min: number; max: number } {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  const min = round50(Math.min(4750, Math.max(1500, w * 30)));
  const max = round50(Math.min(5000, Math.max(min + 250, w * 40)));
  return { min, max };
}

/** The default goal: 35 ml per kilo, inside the band. */
export function defaultGoalMl(weightKg?: number): number {
  const { min, max } = recommendedMl(weightKg);
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  return Math.max(min, Math.min(max, round50(w * 35)));
}

export function isStorableGoalMl(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_GOAL_ML && n <= MAX_GOAL_ML;
}

/** Where today's millilitres sit against the goal. "over" starts a litre past
 * the larger of the goal and the top of the healthy band. */
export function waterStatusMl(ml: number, goalMl: number, weightKg?: number): WaterStatus {
  const { max } = recommendedMl(weightKg);
  if (ml <= 0) return "empty";
  if (ml >= Math.max(goalMl, max) + 1000) return "over";
  if (ml >= goalMl) return "met";
  if (ml >= goalMl / 2) return "onTrack";
  return "low";
}

/** "2.5" litres, one decimal only when there is one. */
export function litres(ml: number): string {
  const l = Math.round(ml / 100) / 10;
  return Number.isInteger(l) ? String(l) : l.toFixed(1);
}

/**
 * The per-day ml log, from whatever the state holds: the ml record, plus any
 * day only the old cup-count record knows (an older build, or a restored
 * backup), converted at the cup size in use — the size those cups were shown
 * at.
 */
export function waterMlLog(
  s: { waterMl?: Record<string, number>; water?: Record<string, number>; cupMl?: number },
): Record<string, number> {
  const out: Record<string, number> = {};
  const cup = cupMlOf(s.cupMl);
  for (const [d, cups] of Object.entries(s.water ?? {})) {
    if (Number.isFinite(cups) && cups > 0) out[d] = Math.min(MAX_DAY_ML, Math.round(cups * cup));
  }
  for (const [d, ml] of Object.entries(s.waterMl ?? {})) {
    if (Number.isFinite(ml) && ml >= 0) out[d] = Math.min(MAX_DAY_ML, Math.round(ml));
  }
  return out;
}

/** The goal in ml: the ml goal, else an old cup goal converted, else null. */
export function goalMlOf(s: { waterGoalMl?: number; waterGoal?: number; cupMl?: number }): number | null {
  if (s.waterGoalMl !== undefined && isStorableGoalMl(s.waterGoalMl)) return Math.round(s.waterGoalMl);
  if (s.waterGoal !== undefined && isStorableWaterGoal(s.waterGoal)) {
    const ml = round50(s.waterGoal * cupMlOf(s.cupMl));
    return Math.max(MIN_GOAL_ML, Math.min(MAX_GOAL_ML, ml));
  }
  return null;
}
