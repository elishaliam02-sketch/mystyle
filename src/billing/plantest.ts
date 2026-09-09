import {
  entitlement,
  formatPrice,
  FREE_LIMITS,
  isPlanId,
  isPro,
  isTrialActive,
  monthlyEquivalent,
  planFor,
  planPrice,
  PLAN_IDS,
  PLANS,
  PRO_UNLOCKS,
  TRIAL_DAYS,
  trialAvailable,
  trialEndsAt,
  yearlyListPrice,
  yearlyPerMonth,
  yearlySavingAmount,
  yearlySavingPercent,
  type Plan,
  type PlanId,
} from "./plans";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

// --- the price list itself
{
  check("both plans are offered", PLAN_IDS.length === 2 && PLAN_IDS.includes("monthly") && PLAN_IDS.includes("yearly"));
  check("every plan id maps to its own plan",
    PLAN_IDS.every((id) => PLANS[id].id === id));
  check("a plan id from outside is checked before it is trusted",
    isPlanId("monthly") && !isPlanId("free") && !isPlanId(null) && !isPlanId(undefined));
  check("an unknown plan id buys nothing", planFor("lifetime") === null && planFor(undefined) === null);
  check("a known plan id resolves", planFor("yearly")?.price === PLANS.yearly.price);
  check("the year covers twelve months", PLANS.yearly.months === 12 && PLANS.monthly.months === 1);
  check("both plans carry the same trial", PLANS.monthly.trialDays === TRIAL_DAYS && PLANS.yearly.trialDays === TRIAL_DAYS);
  check("the yearly plan really is cheaper than twelve months",
    PLANS.yearly.price < PLANS.monthly.price * 12,
    `${PLANS.yearly.price} vs ${PLANS.monthly.price * 12}`);
}

// --- the yearly saving is computed, and computed right
{
  const list = yearlyListPrice();
  check("list price is twelve monthly payments", list === PLANS.monthly.price * 12, String(list));
  check("the saving is list minus the year price",
    yearlySavingAmount() === list - PLANS.yearly.price, String(yearlySavingAmount()));
  // 2990 * 12 = 35880; 35880 - 24900 = 10980; 10980/35880 = 30.6% → 30
  check("the badge percent is right", yearlySavingPercent() === 30, String(yearlySavingPercent()));
  check("the percent matches the amount it came from",
    yearlySavingPercent() === Math.floor((yearlySavingAmount() * 100) / yearlyListPrice()));

  // Rounded DOWN, never up: the badge may understate the saving, never oversell it.
  const nearlyHalf: Record<PlanId, Plan> = {
    monthly: { ...PLANS.monthly, price: 1000 },
    // 12 months at 1000 = 12000; 6060 saves 5940 = 49.5%
    yearly: { ...PLANS.yearly, price: 6060 },
  };
  check("a 49.5% saving is advertised as 49, not 50",
    yearlySavingPercent(nearlyHalf) === 49, String(yearlySavingPercent(nearlyHalf)));

  const backwards: Record<PlanId, Plan> = {
    monthly: { ...PLANS.monthly, price: 1000 },
    yearly: { ...PLANS.yearly, price: 20000 },
  };
  check("a yearly plan that costs more shows no saving rather than a negative one",
    yearlySavingPercent(backwards) === 0 && yearlySavingAmount(backwards) === 0);

  const free: Record<PlanId, Plan> = {
    monthly: { ...PLANS.monthly, price: 0 },
    yearly: { ...PLANS.yearly, price: 0 },
  };
  check("a zero list price does not divide by zero", yearlySavingPercent(free) === 0);
}

// --- per-month equivalent
{
  const per = monthlyEquivalent(PLANS.yearly.price);
  check("the year divides into a per-month figure", per === Math.round(24900 / 12), String(per));
  check("the per-month figure is under the monthly price", per < PLANS.monthly.price, String(per));
  check("twelve of them are within a shekel of the year price",
    Math.abs(per * 12 - PLANS.yearly.price) < 100, String(per * 12));
  check("a nonsense month count returns zero, not Infinity", monthlyEquivalent(24900, 0) === 0);
  check("a nonsense price returns zero", monthlyEquivalent(NaN) === 0);
}

// --- INTEGER ARITHMETIC: no float ever escapes this module
{
  const money = [
    PLANS.monthly.price,
    PLANS.yearly.price,
    yearlyListPrice(),
    yearlySavingAmount(),
    yearlySavingPercent(),
    monthlyEquivalent(PLANS.yearly.price),
    // the awkward divisions: a year price that does not divide by twelve
    monthlyEquivalent(9999),
    monthlyEquivalent(1),
    monthlyEquivalent(35),
    yearlySavingPercent({
      monthly: { ...PLANS.monthly, price: 333 },
      yearly: { ...PLANS.yearly, price: 1111 },
    }),
  ];
  check("every figure this module returns is a whole number of agorot",
    money.every((n) => Number.isInteger(n)), money.join(","));
  check("no figure is a NaN or an Infinity",
    money.every((n) => Number.isFinite(n)), money.join(","));
  // The classic float trap, proven not to apply: 0.1+0.2 !== 0.3, but 10+20 === 30.
  check("adding two prices is exact", PLANS.monthly.price + PLANS.yearly.price === 27890);
  check("the printed price is rebuilt from integers, not parsed back from a float",
    formatPrice(2990, "ILS", "en") === "₪29.90" && Math.round(29.9 * 100) === 2990);
}

// --- trial arithmetic
{
  const start = "2026-03-01T09:00:00.000Z";
  const ends = trialEndsAt(start, 7);
  check("a seven day trial ends seven days later", ends === "2026-03-08T09:00:00.000Z", String(ends));
  check("the default length is the app's trial", trialEndsAt(start) === trialEndsAt(start, TRIAL_DAYS));
  check("a garbage start date gives no trial end", trialEndsAt("not-a-date") === null);
  check("an empty start date gives no trial end", trialEndsAt("") === null);
  check("a zero or negative length gives no trial",
    trialEndsAt(start, 0) === null && trialEndsAt(start, -3) === null);
  check("a NaN length gives no trial", trialEndsAt(start, NaN) === null);
}

// --- is the trial running
{
  const start = "2026-03-01T09:00:00.000Z";
  const ends = trialEndsAt(start, 7)!;

  check("a trial that has not started is not active", !isTrialActive(start, null));
  check("no end date at all is not a trial",
    !isTrialActive(start, undefined) && !isTrialActive(start, ""));
  check("the day it starts, the trial is running", isTrialActive(start, ends));
  check("mid-trial it is still running", isTrialActive("2026-03-05T09:00:00.000Z", ends));
  check("one millisecond before the end it is still running",
    isTrialActive("2026-03-08T08:59:59.999Z", ends));
  // The boundary: the end instant belongs to the expired side.
  check("a trial expires exactly at its end instant", !isTrialActive(ends, ends));
  check("one millisecond after the end it is over",
    !isTrialActive("2026-03-08T09:00:00.001Z", ends));
  check("a garbage now is not a running trial", !isTrialActive("whenever", ends));
  check("a garbage end is not a running trial", !isTrialActive(start, "whenever"));
}

// --- entitlement
{
  const now = "2026-03-05T12:00:00.000Z";
  const future = "2026-04-01T00:00:00.000Z";
  const past = "2026-02-01T00:00:00.000Z";

  // The common case: signed out, nothing recorded at all.
  check("no subscription state at all reads as free", entitlement(undefined) === "free");
  check("a null state reads as free", entitlement(null) === "free");
  check("an empty record reads as free", entitlement({ nowIso: now }) === "free");
  check("status none reads as free", entitlement({ nowIso: now, status: "none" }) === "free");
  check("a broken clock reads as free",
    entitlement({ nowIso: "not-a-date", status: "active", currentPeriodEnd: future }) === "free");

  // Trial
  const trialEnds = trialEndsAt("2026-03-01T12:00:00.000Z", 7)!;
  check("inside the trial reads as trial",
    entitlement({ nowIso: now, trialEndsAt: trialEnds }) === "trial");
  check("an expired trial falls back to free",
    entitlement({ nowIso: "2026-03-20T12:00:00.000Z", trialEndsAt: trialEnds }) === "free");
  check("an expired trial does NOT fall back to pro",
    entitlement({ nowIso: "2026-03-20T12:00:00.000Z", trialEndsAt: trialEnds }) !== "pro");
  check("a trial expiring exactly now is already free",
    entitlement({ nowIso: trialEnds, trialEndsAt: trialEnds }) === "free");
  check("status trialing without an end date grants nothing",
    entitlement({ nowIso: now, status: "trialing" }) === "free");

  // Paid
  check("an active subscription in period is pro",
    entitlement({ nowIso: now, status: "active", currentPeriodEnd: future }) === "pro");
  check("an active subscription with no recorded period end is still pro",
    entitlement({ nowIso: now, status: "active" }) === "pro");
  check("an active subscription whose period has run out is not pro",
    entitlement({ nowIso: now, status: "active", currentPeriodEnd: past }) === "free");

  // Cancelled but paid up — the rule that stops the app taking money for nothing.
  check("a cancelled subscription is still pro until the period ends",
    entitlement({ nowIso: now, status: "canceled", currentPeriodEnd: future }) === "pro");
  check("and it is pro right up to the last millisecond",
    entitlement({ nowIso: "2026-03-31T23:59:59.999Z", status: "canceled", currentPeriodEnd: future }) === "pro");
  check("at the period end the cancelled subscription stops being pro",
    entitlement({ nowIso: future, status: "canceled", currentPeriodEnd: future }) === "free");
  check("after the period end it is free",
    entitlement({ nowIso: "2026-05-01T00:00:00.000Z", status: "canceled", currentPeriodEnd: future }) === "free");
  check("a cancelled subscription with no period end grants nothing",
    entitlement({ nowIso: now, status: "canceled" }) === "free");
  check("a cancelled subscription still inside its trial falls to trial, not free",
    entitlement({ nowIso: now, status: "canceled", currentPeriodEnd: past, trialEndsAt: trialEnds }) === "trial");

  // Nothing else grants anything.
  check("past_due grants nothing even inside the period",
    entitlement({ nowIso: now, status: "past_due", currentPeriodEnd: future }) === "free");
  check("expired grants nothing even inside the period",
    entitlement({ nowIso: now, status: "expired", currentPeriodEnd: future }) === "free");
  check("a status nobody recognises grants nothing",
    entitlement({ nowIso: now, status: "vip" as never, currentPeriodEnd: future }) === "free");

  check("isPro agrees with entitlement",
    isPro({ nowIso: now, status: "active", currentPeriodEnd: future }) &&
      !isPro({ nowIso: now, trialEndsAt: trialEnds }) &&
      !isPro(undefined));

  check("a signed-out person is still offered the trial", trialAvailable(undefined));
  check("someone who already used a trial is not offered it again",
    !trialAvailable({ nowIso: "2026-03-20T12:00:00.000Z", trialEndsAt: trialEnds }));
  check("a paying subscriber is not offered a trial",
    !trialAvailable({ nowIso: now, status: "active", currentPeriodEnd: future }));
}

// --- prices, written out
{
  check("hebrew puts the shekel after the number",
    formatPrice(2990, "ILS", "he") === "29.90 ₪", formatPrice(2990, "ILS", "he"));
  check("english puts the shekel in front",
    formatPrice(2990, "ILS", "en") === "₪29.90", formatPrice(2990, "ILS", "en"));
  check("the year price prints in hebrew",
    formatPrice(24900, "ILS", "he") === "249.00 ₪", formatPrice(24900, "ILS", "he"));
  check("the year price prints in english",
    formatPrice(24900, "ILS", "en") === "₪249.00", formatPrice(24900, "ILS", "en"));
  check("agorot are never dropped",
    formatPrice(2905, "ILS", "en") === "₪29.05", formatPrice(2905, "ILS", "en"));
  check("a whole shekel still shows both agorot",
    formatPrice(3000, "ILS", "en") === "₪30.00", formatPrice(3000, "ILS", "en"));
  check("under a shekel prints a leading zero",
    formatPrice(7, "ILS", "en") === "₪0.07", formatPrice(7, "ILS", "en"));
  check("free is free, not blank", formatPrice(0, "ILS", "en") === "₪0.00");
  check("thousands are grouped",
    formatPrice(123456789, "ILS", "en") === "₪1,234,567.89", formatPrice(123456789, "ILS", "en"));
  check("dollars use their own symbol",
    formatPrice(499, "USD", "en") === "$4.99" && formatPrice(499, "USD", "he") === "4.99 $");
  check("a refund reads as negative, not as a stray minus in the middle",
    formatPrice(-2990, "ILS", "en") === "-₪29.90" || formatPrice(-2990, "ILS", "en") === "₪-29.90",
    formatPrice(-2990, "ILS", "en"));
  check("a NaN price prints as zero rather than as NaN",
    formatPrice(NaN, "ILS", "he") === "0.00 ₪", formatPrice(NaN, "ILS", "he"));
  check("a float price is rounded to whole agorot before printing",
    formatPrice(2990.4, "ILS", "en") === "₪29.90", formatPrice(2990.4, "ILS", "en"));
  check("no printed price ever contains a floating point tail",
    [0, 1, 7, 2990, 24900, 99999, 123456789].every(
      (n) => /^-?[₪$]?[\d,]+\.\d{2}( [₪$])?$/.test(formatPrice(n, "ILS", "en")),
    ));

  check("planPrice prints the plan's own price and currency",
    planPrice(PLANS.monthly, "he") === "29.90 ₪" && planPrice(PLANS.yearly, "en") === "₪249.00");
  check("the per-month line is drawn from the year price",
    yearlyPerMonth("en") === formatPrice(monthlyEquivalent(PLANS.yearly.price), "ILS", "en"),
    yearlyPerMonth("en"));
  check("the per-month line reads as a price", yearlyPerMonth("he") === "20.75 ₪", yearlyPerMonth("he"));
}

// --- the free tier is real, and honest
{
  check("the free tier tracks more than one habit", FREE_LIMITS.habits >= 3);
  check("the free tier keeps a month of history", FREE_LIMITS.historyDays >= 30);
  check("every free limit is a whole number or a flag",
    Object.values(FREE_LIMITS).every((v) => typeof v === "boolean" || Number.isInteger(v)));
  check("cloud backup is the paid side of the line", FREE_LIMITS.cloudBackup === false);
  check("the paywall has something to list", PRO_UNLOCKS.length >= 4);
  check("no unlock is listed twice", new Set(PRO_UNLOCKS).size === PRO_UNLOCKS.length);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
