/**
 * What a free account may do, and what it may not.
 *
 * The paywall promises limits; this is the only place that decides whether one
 * has been reached. Keeping it pure and in one file is what stops the app from
 * promising "up to three habits" on one screen and allowing four on another —
 * and it means the rules can be tested without a phone, a server, or a card.
 *
 * Two principles run through it, and neither is negotiable:
 *
 *  - A limit stops something being *added*. It never hides, deletes, or breaks
 *    what is already there. Someone who used the app free for a year and then
 *    stopped paying keeps every habit they wrote; they simply cannot add the
 *    next one until they do.
 *  - When the answer is not certain, the answer is yes. A missing count, a
 *    subscription that has not loaded yet, a clock that makes no sense: all of
 *    them allow. Wrongly letting someone log a meal costs nothing. Wrongly
 *    blocking a paying customer costs the customer.
 */
import { FREE_LIMITS } from "./plans";
import type { Entitlement } from "./plans";

/** The things a free account is limited on. */
export type Feature =
  | "habits"
  | "coach"
  | "mealPhoto"
  | "progressPhotos"
  | "customExercises"
  | "cloudBackup";

/** How many of each a free account gets. `false` means "not on the free tier
 * at all"; a number is a ceiling. */
const CEILING: Record<Feature, number | false> = {
  habits: FREE_LIMITS.habits,
  coach: FREE_LIMITS.coachRepliesPerDay,
  mealPhoto: FREE_LIMITS.mealPhotoScansPerDay,
  progressPhotos: FREE_LIMITS.progressPhotos,
  customExercises: FREE_LIMITS.customExercises,
  cloudBackup: FREE_LIMITS.cloudBackup ? Number.POSITIVE_INFINITY : false,
};

/** Features counted per day rather than for the life of the account. */
const DAILY: Feature[] = ["coach", "mealPhoto"];

export function isDaily(f: Feature): boolean {
  return DAILY.includes(f);
}

export type Verdict =
  /** Allowed. `remaining` is null when nothing is counting. */
  | { ok: true; remaining: number | null }
  /** Refused, with the numbers to explain why. */
  | { ok: false; limit: number; used: number };

/**
 * May this account do one more of `feature`, having already done `used`?
 *
 * `used` is how many exist now (or how many were used today, for the daily
 * ones) — not counting the one being asked about.
 */
export function check(feature: Feature, ent: Entitlement, used: number): Verdict {
  // Paying and trialling accounts are never counted. The trial is the product:
  // metering it would be showing someone a locked door during the tour.
  if (ent !== "free") return { ok: true, remaining: null };

  const ceiling = CEILING[feature];
  if (ceiling === false) return { ok: false, limit: 0, used };
  if (!Number.isFinite(ceiling)) return { ok: true, remaining: null };

  // A count that is missing or nonsensical is not evidence of overuse.
  const n = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  if (n >= ceiling) return { ok: false, limit: ceiling, used: n };
  return { ok: true, remaining: ceiling - n };
}

/** True when this is the last one before the wall — worth saying so before
 * they spend it, rather than after. */
export function isLastFree(feature: Feature, ent: Entitlement, used: number): boolean {
  const v = check(feature, ent, used);
  return v.ok && v.remaining === 1;
}

/** How far back the charts may look. Paid accounts see everything. */
export function historyDays(ent: Entitlement): number | null {
  return ent === "free" ? FREE_LIMITS.historyDays : null;
}

/**
 * The earliest date a free account's charts include, given today. Anything
 * before it is still stored and still theirs — it is simply not drawn until
 * they subscribe, which is the difference between a limit and a deletion.
 */
export function historyFloor(ent: Entitlement, todayIso: string): string | null {
  const days = historyDays(ent);
  if (days === null) return null;
  const t = Date.parse(`${todayIso}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t - (days - 1) * 86_400_000).toISOString().slice(0, 10);
}
