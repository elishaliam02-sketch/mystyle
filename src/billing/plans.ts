/**
 * What APEX charges for, what it gives away, and who is entitled to what.
 *
 * This module is the single source of truth for the paid/free line. The paywall
 * screen renders it, the tests measure it, and nothing else in the app is
 * allowed to invent a price or a limit of its own. It is pure: no React, no
 * network, no clock — every function that needs "now" is handed it, so the same
 * inputs always give the same answer and a trial boundary can be tested to the
 * millisecond.
 *
 * MONEY IS AN INTEGER. Every price here is in the currency's minor unit —
 * agorot for shekels, cents for dollars. 0.1 + 0.2 is not 0.3 in binary
 * floating point, and a subscription that drifts by an agora a month is a
 * support ticket. Nothing in this file ever divides into a float and keeps it:
 * `monthlyEquivalent` rounds back to a whole agora before returning, and
 * `formatPrice` is the only place a decimal point is ever drawn.
 *
 * The yearly saving is COMPUTED, never written down. A hardcoded "save 30%!"
 * becomes a lie the first time a price moves; `yearlySavingPercent` derives it
 * from the two prices and rounds DOWN, so the badge can only ever understate
 * what the person actually saves.
 */

export type PlanId = "monthly" | "yearly";

/** The currencies the app can price in. Both use 100 minor units. */
export type Currency = "ILS" | "USD";

/** The languages a price can be written in — mirrors `Locale` in `@/i18n`,
 * repeated here so this module stays free of React and Expo imports. */
export type PriceLocale = "he" | "en";

export type Plan = {
  id: PlanId;
  /** Price per billing period, in minor units (agorot). Always an integer. */
  price: number;
  currency: Currency;
  /** How many months one payment covers. */
  months: number;
  /** Days of free trial before the first charge. */
  trialDays: number;
};

/** How long the free trial runs. One week is long enough to log a real
 * training week, which is the thing that decides whether the app is worth
 * paying for. */
export const TRIAL_DAYS = 7;

/** Minor units in one major unit, per currency. */
const MINOR: Record<Currency, number> = { ILS: 100, USD: 100 };

const SYMBOL: Record<Currency, string> = { ILS: "₪", USD: "$" };

/**
 * The price list. Two plans only: a monthly one anybody can leave, and a yearly
 * one that is cheaper per month. More options would not sell more
 * subscriptions, it would just make the screen harder to read.
 */
export const PLANS: Record<PlanId, Plan> = {
  monthly: { id: "monthly", price: 2990, currency: "ILS", months: 1, trialDays: TRIAL_DAYS },
  yearly: { id: "yearly", price: 24900, currency: "ILS", months: 12, trialDays: TRIAL_DAYS },
};

/** The order the plans are offered in — cheapest commitment first. */
export const PLAN_IDS = ["monthly", "yearly"] as const;

export function isPlanId(value: unknown): value is PlanId {
  return value === "monthly" || value === "yearly";
}

/** The plan for an id, or null if the id is not one we sell. Used anywhere an
 * id arrives from outside — a deep link, a stored choice, a request body. */
export function planFor(id: unknown, plans: Record<PlanId, Plan> = PLANS): Plan | null {
  return isPlanId(id) ? plans[id] : null;
}

// ---------------------------------------------------------------- the maths

/**
 * What a year of monthly payments would have cost, in minor units.
 */
export function yearlyListPrice(plans: Record<PlanId, Plan> = PLANS): number {
  return plans.monthly.price * plans.yearly.months;
}

/**
 * How much the yearly plan saves against paying monthly, in minor units.
 * Never negative: if someone ever prices the year above twelve months, the
 * badge disappears rather than showing a "saving" of minus anything.
 */
export function yearlySavingAmount(plans: Record<PlanId, Plan> = PLANS): number {
  return Math.max(0, yearlyListPrice(plans) - plans.yearly.price);
}

/**
 * The saving as whole percent, rounded DOWN. A claim on a pricing screen is a
 * promise; rounding down means the number on the badge is never larger than
 * the truth.
 */
export function yearlySavingPercent(plans: Record<PlanId, Plan> = PLANS): number {
  const list = yearlyListPrice(plans);
  if (list <= 0) return 0;
  return Math.floor((yearlySavingAmount(plans) * 100) / list);
}

/**
 * What the yearly plan works out to per month, in minor units, rounded to a
 * whole agora. This is the honest "₪20.75 / month" line under the year price —
 * it is derived from the year price, so it cannot drift away from it.
 */
export function monthlyEquivalent(
  yearlyPrice: number,
  months: number = PLANS.yearly.months,
): number {
  if (!Number.isFinite(yearlyPrice) || !Number.isFinite(months) || months <= 0) return 0;
  return Math.round(yearlyPrice / months);
}

// ------------------------------------------------------------------- trials

/**
 * When a trial started at `startIso` runs out. Returns null for a start date
 * that is not a real instant or a nonsense length, because "no end" is the one
 * answer that cannot accidentally hand somebody a free year — `isTrialActive`
 * reads null as "not on trial".
 */
export function trialEndsAt(startIso: string, days: number = TRIAL_DAYS): string | null {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return null;
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(start + Math.floor(days) * 86_400_000).toISOString();
}

/**
 * Whether a trial is still running at `nowIso`.
 *
 * The end instant is EXCLUSIVE: at exactly the end the trial is over. A
 * boundary has to fall on one side, and the side that expires is the one that
 * cannot give away a subscription — the same reason every check in this file
 * defaults to "no".
 */
export function isTrialActive(nowIso: string, endsIso: string | null | undefined): boolean {
  if (!endsIso) return false;
  const now = Date.parse(nowIso);
  const ends = Date.parse(endsIso);
  if (!Number.isFinite(now) || !Number.isFinite(ends)) return false;
  return now < ends;
}

// -------------------------------------------------------------- entitlement

export type Entitlement = "free" | "trial" | "pro";

/**
 * The subscription statuses this app records. They are the subset of Stripe's
 * that actually change what a person may do; anything else the webhook sees is
 * stored as "none", which grants nothing.
 */
export type SubStatus = "none" | "trialing" | "active" | "canceled" | "past_due" | "expired";

/**
 * Everything needed to decide what someone may use, and nothing else. All of it
 * optional but `nowIso`, because the common case is a signed-out person with no
 * subscription record at all — and that case has to answer "free" rather than
 * throw.
 */
export type EntitlementState = {
  /** The instant to judge against. */
  nowIso: string;
  status?: SubStatus | null;
  /** The end of the period already paid for. */
  currentPeriodEnd?: string | null;
  /** The end of the free trial, if one was started. */
  trialEndsAt?: string | null;
};

/**
 * What this person may use right now.
 *
 * Two rules carry the whole thing:
 *
 * 1. A CANCELLED SUBSCRIPTION IS STILL PAID FOR. Cancelling in Stripe stops the
 *    renewal, it does not refund the month. Somebody who cancels on the 2nd
 *    keeps everything until the period ends — cutting them off early is taking
 *    money for nothing.
 * 2. AN EXPIRED TRIAL FALLS TO FREE, NEVER TO PRO. Every unknown, missing or
 *    malformed value lands on "free" as well. The failure direction of this
 *    function is "you get less", always.
 */
export function entitlement(state: EntitlementState | null | undefined): Entitlement {
  if (!state) return "free";
  const { nowIso, status, currentPeriodEnd, trialEndsAt: endsAt } = state;

  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return "free";

  const periodEnd = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN;
  const paidPeriodOpen = Number.isFinite(periodEnd) && now < periodEnd;

  if (status === "active") {
    // A live subscription with no recorded period end still counts: the server
    // said it is active, and locking out a paying customer over a missing
    // timestamp is worse than a day of grace.
    if (!currentPeriodEnd || paidPeriodOpen) return "pro";
  }
  // Cancelled, but the period they already paid for has not run out yet.
  if (status === "canceled" && paidPeriodOpen) return "pro";

  if (isTrialActive(nowIso, endsAt)) return "trial";

  return "free";
}

/** True when this person is inside a paid period rather than a trial. */
export function isPro(state: EntitlementState | null | undefined): boolean {
  return entitlement(state) === "pro";
}

/** True when the app should still be offering the trial — nobody has used it
 * and nothing is being paid for. */
export function trialAvailable(state: EntitlementState | null | undefined): boolean {
  if (!state) return true;
  if (state.trialEndsAt) return false;
  return entitlement(state) === "free";
}

// ------------------------------------------------------------- the free tier

/**
 * What the app does for nothing. This is deliberately generous: the free tier
 * has to be a usable habit tracker on its own, or the paywall is a demo screen
 * with a price on it. What is paid for is the coaching, the cloud and the
 * history — the parts that cost money to run or took the longest to build.
 */
export const FREE_LIMITS = {
  /** Habits you may track at once. */
  habits: 3,
  /** Days of history the charts look back over. */
  historyDays: 30,
  /** Coach answers per day. */
  coachRepliesPerDay: 3,
  /** Meal photos read by the AI per day — each one costs a real API call. */
  mealPhotoScansPerDay: 1,
  /** Progress photos kept on the device. */
  progressPhotos: 5,
  /** Exercises you may add to the library yourself. */
  customExercises: 3,
  /** Backup and multi-device sync are paid: they are the server bill. */
  cloudBackup: false,
} as const;

export type FreeLimits = typeof FREE_LIMITS;

/**
 * What paying actually unlocks, as ids. The words live in the screen so they
 * can be written in both languages; the list lives here so the screen cannot
 * promise something the limits above do not give.
 */
export const PRO_UNLOCKS = [
  "habits",
  "coach",
  "mealPhoto",
  "history",
  "cloud",
  "support",
] as const;

export type ProUnlock = (typeof PRO_UNLOCKS)[number];

// ----------------------------------------------------------------- printing

/**
 * A price, written out. The only place in the app that turns minor units into
 * something with a decimal point in it.
 *
 * Hebrew puts the shekel sign after the number ("29.90 ₪"), English puts the
 * symbol in front ("₪29.90") — the same convention `Intl` uses for he-IL and
 * en-IL, done by hand so the output is identical on Hermes, on Node and in a
 * browser. A price that formats differently on one phone is a bug report.
 */
export function formatPrice(
  amount: number,
  currency: Currency = "ILS",
  locale: PriceLocale = "he",
): string {
  const minor = MINOR[currency] ?? 100;
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);

  const whole = Math.trunc(abs / minor);
  const frac = abs % minor;
  const digits = String(minor - 1).length;
  const body = `${group(whole)}.${String(frac).padStart(digits, "0")}`;
  const symbol = SYMBOL[currency] ?? "";
  const signed = negative ? `-${body}` : body;

  return locale === "he" ? `${signed} ${symbol}` : `${symbol}${signed}`;
}

/** Thousands separators, without Intl. */
function group(n: number): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}

/** A plan's price, written out in the caller's language. */
export function planPrice(plan: Plan, locale: PriceLocale = "he"): string {
  return formatPrice(plan.price, plan.currency, locale);
}

/** The yearly plan's per-month figure, written out. */
export function yearlyPerMonth(
  locale: PriceLocale = "he",
  plans: Record<PlanId, Plan> = PLANS,
): string {
  return formatPrice(
    monthlyEquivalent(plans.yearly.price, plans.yearly.months),
    plans.yearly.currency,
    locale,
  );
}
