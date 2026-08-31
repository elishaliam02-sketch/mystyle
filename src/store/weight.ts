/**
 * Guards on weight entry.
 *
 * Two different jobs, kept apart. A hard range rejects the physically
 * impossible — a typo like 6666, a stray zero — and nothing outside it is ever
 * stored. A soft sanity check flags a jump too large to be real between two
 * weigh-ins (water, a scale in kilos vs pounds, a fat finger), but does not
 * block it: people do lose or gain, and the app should warn, not refuse, when
 * it looks off.
 *
 * Pure, so both can be tested without a store or a screen.
 */

/** Below this is not a person; above it is not either. Kilograms. */
export const MIN_KG = 25;
export const MAX_KG = 400;

/** A change larger than this between two entries is worth a second look. */
export const BIG_JUMP_KG = 12;

export type WeightCheck =
  | { status: "ok" }
  | { status: "out-of-range"; min: number; max: number }
  | { status: "big-jump"; from: number; to: number; delta: number };

export function checkWeight(kg: number, previousKg?: number): WeightCheck {
  if (!Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) {
    return { status: "out-of-range", min: MIN_KG, max: MAX_KG };
  }
  if (previousKg !== undefined && Math.abs(kg - previousKg) > BIG_JUMP_KG) {
    return {
      status: "big-jump",
      from: previousKg,
      to: kg,
      delta: Math.round((kg - previousKg) * 10) / 10,
    };
  }
  return { status: "ok" };
}

/** In range, ignoring the soft jump check — the gate for actually storing. */
export function isStorableWeight(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
}
