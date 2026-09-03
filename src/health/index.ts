/**
 * Guards on the numbers a person can set about their own body.
 *
 * This exists because the app was happy to accept a goal of 20 kg from someone
 * who weighed 71. An app that draws a friendly progress ring toward that number
 * is not neutral — it is coaching somebody into starvation. So the rule here is
 * narrow and firm: a target below the healthy range for a person's height is
 * refused outright, not warned about, and a target that is merely aggressive is
 * allowed only after the warning has been read.
 *
 * Everything is pure and unit-tested, and — this is the important part — the
 * *store* enforces it, not the screens. A screen can forget to call a checker;
 * a store that refuses to write the value cannot be routed around by adding a
 * new screen, deep-linking, or restoring a doctored backup.
 */

/** Below this is not a person's weight; above it is not either. Kilograms. */
export const MIN_KG = 25;
export const MAX_KG = 400;

/** Heights the app will accept, in centimetres. */
export const MIN_HEIGHT_CM = 120;
export const MAX_HEIGHT_CM = 230;

/** The BMI band the app is willing to point a goal at. */
export const MIN_BMI = 18.5;
export const MAX_BMI = 27;

/**
 * The floor when no height is known: never below this in absolute terms, and
 * never a target that asks for more than a quarter of the person off. A cut of
 * 25% is already a serious, months-long project; past that the app has no
 * business drawing a progress bar.
 */
export const ABSOLUTE_FLOOR_KG = 40;
export const MAX_CUT_FRACTION = 0.25;

export function isHeightCm(cm: number): boolean {
  return Number.isFinite(cm) && cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM;
}

/** Body mass index, or null when the height is unknown or unusable. */
export function bmi(kg: number, heightCm?: number): number | null {
  if (!heightCm || !isHeightCm(heightCm) || !Number.isFinite(kg) || kg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

export type BmiBand = "under" | "healthy" | "over" | "obese";

export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return "under";
  if (value < 25) return "healthy";
  if (value < 30) return "over";
  return "obese";
}

/** The weight range that lands inside the healthy BMI band for a height. */
export function healthyRange(heightCm: number): { min: number; max: number } | null {
  if (!isHeightCm(heightCm)) return null;
  const m = heightCm / 100;
  return {
    min: Math.round(MIN_BMI * m * m),
    max: Math.round(MAX_BMI * m * m),
  };
}

/**
 * The lowest goal weight this app will accept for a person.
 *
 * With a height, that is the bottom of the healthy BMI band — the honest
 * answer. Without one, it is a floor built from what we do know: never under
 * 40 kg, and never more than a quarter below where they are now. Whichever of
 * those is higher wins, so a missing height cannot be used to slip past.
 */
export function floorGoalKg(currentKg?: number, heightCm?: number): number {
  const range = heightCm ? healthyRange(heightCm) : null;
  const byHeight = range ? range.min : 0;
  const byCurrent = currentKg && currentKg > 0 ? currentKg * (1 - MAX_CUT_FRACTION) : 0;
  return Math.max(ABSOLUTE_FLOOR_KG, byHeight, byCurrent);
}

/** The highest goal weight the app will accept — a gain has limits too. */
export function ceilingGoalKg(currentKg?: number, heightCm?: number): number {
  const range = heightCm ? healthyRange(heightCm) : null;
  const byHeight = range ? range.max * 1.15 : MAX_KG;
  const byCurrent = currentKg && currentKg > 0 ? currentKg * 1.35 : MAX_KG;
  return Math.min(MAX_KG, Math.max(byHeight, byCurrent));
}

export type GoalCheck =
  | { status: "ok" }
  | { status: "out-of-range"; min: number; max: number }
  /** Refused: the height is unknown, so the target cannot be judged at all. */
  | { status: "needs-height" }
  /** Refused: below the healthy floor. Carries the lowest the app will take. */
  | { status: "too-low"; floor: number }
  /** Refused: an implausible gain target. */
  | { status: "too-high"; ceiling: number };

/**
 * Whether a goal weight may be stored. "too-low" is a refusal, not a warning:
 * there is no second tap that makes 20 kg an acceptable target for an adult.
 */
export function checkGoalWeight(
  goalKg: number,
  currentKg?: number,
  heightCm?: number,
): GoalCheck {
  if (!Number.isFinite(goalKg) || goalKg < MIN_KG || goalKg > MAX_KG) {
    return { status: "out-of-range", min: MIN_KG, max: MAX_KG };
  }
  // Without a height there is no healthy range to check against, and the
  // fallback floor can be walked down by first logging an implausibly low
  // weigh-in. Asking for one field closes that off completely — and the app
  // needs it anyway to say anything true about a target.
  if (!heightCm || !isHeightCm(heightCm)) return { status: "needs-height" };
  const floor = Math.round(floorGoalKg(currentKg, heightCm) * 10) / 10;
  if (goalKg < floor) return { status: "too-low", floor };
  const ceiling = Math.round(ceilingGoalKg(currentKg, heightCm) * 10) / 10;
  if (goalKg > ceiling) return { status: "too-high", ceiling };
  return { status: "ok" };
}

/** The gate the store uses before writing a goal weight. */
export function isStorableGoal(goalKg: number, currentKg?: number, heightCm?: number): boolean {
  return checkGoalWeight(goalKg, currentKg, heightCm).status === "ok";
}

/**
 * A daily calorie target is a place someone can hurt themselves too, so the
 * kitchen's number is floored at a figure a person can actually live on rather
 * than whatever the arithmetic produces for a very light body.
 */
export const MIN_DAILY_KCAL = 1200;
