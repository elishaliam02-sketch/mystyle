import { check, historyDays, historyFloor, isDaily, isLastFree, type Feature } from "./gate";
import { FREE_LIMITS } from "./plans";
import { parseEntitlement } from "./entitlement";

const results: [string, boolean, string?][] = [];
const check_ = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const FEATURES: Feature[] = [
  "habits", "coach", "mealPhoto", "progressPhotos", "customExercises", "cloudBackup",
];

// A limit only ever stops the NEXT one. Nothing already there is touched.
{
  const v = check("habits", "free", FREE_LIMITS.habits - 1);
  check_("the last free habit is still allowed", v.ok && v.remaining === 1, JSON.stringify(v));
  const w = check("habits", "free", FREE_LIMITS.habits);
  check_("the one after the limit is refused", !w.ok, JSON.stringify(w));
  check_("and the refusal says the limit and the count",
    !w.ok && w.limit === FREE_LIMITS.habits && w.used === FREE_LIMITS.habits, JSON.stringify(w));
  // Someone far over the limit — an old account that stopped paying — is
  // refused the next one and told nothing else. Their habits are untouched.
  const over = check("habits", "free", 99);
  check_("an account already over the limit is only refused the next one",
    !over.ok && over.used === 99, JSON.stringify(over));
}

// Paying and trialling are never metered.
for (const f of FEATURES) {
  for (const ent of ["pro", "trial"] as const) {
    const v = check(f, ent, 10_000);
    check_(`${ent} is not counted for ${f}`, v.ok && v.remaining === null, JSON.stringify(v));
  }
}

// Free-tier ceilings match exactly what the paywall promises.
check_("habits ceiling is the promised one", (() => {
  const v = check("habits", "free", FREE_LIMITS.habits - 1);
  return v.ok && v.remaining === 1;
})());
check_("cloud backup is not on the free tier at all", !check("cloudBackup", "free", 0).ok);
check_("and stays refused at zero used", (() => {
  const v = check("cloudBackup", "free", 0);
  return !v.ok && v.limit === 0;
})());

// When the answer is not certain, the answer is yes.
for (const bad of [NaN, -1, -99, Infinity]) {
  const v = check("habits", "free", bad as number);
  check_(`a nonsense count (${bad}) does not lock anyone out`, v.ok, JSON.stringify(v));
}
check_("a fractional count is floored, not rounded up", (() => {
  const v = check("habits", "free", FREE_LIMITS.habits - 0.5);
  return v.ok;
})());

// Daily features reset; lifetime ones do not.
check_("the coach is counted per day", isDaily("coach"));
check_("meal photos are counted per day", isDaily("mealPhoto"));
check_("habits are not a daily count", !isDaily("habits"));
check_("progress photos are not a daily count", !isDaily("progressPhotos"));

// The warning before the wall.
check_("the last free one announces itself",
  isLastFree("habits", "free", FREE_LIMITS.habits - 1));
check_("the one before it does not",
  !isLastFree("habits", "free", FREE_LIMITS.habits - 2));
check_("and a refused one is not 'the last free one'",
  !isLastFree("habits", "free", FREE_LIMITS.habits));
check_("a paying account never sees the warning",
  !isLastFree("habits", "pro", FREE_LIMITS.habits - 1));

// History is a window, not a deletion.
check_("free history is the promised window", historyDays("free") === FREE_LIMITS.historyDays);
check_("paid history has no window", historyDays("pro") === null);
check_("a trial sees everything too", historyDays("trial") === null);
{
  const floor = historyFloor("free", "2026-03-31");
  // 30 days *including* today, so the floor is 29 days back.
  check_("the free window ends 30 days back, inclusive", floor === "2026-03-02", String(floor));
  check_("paid accounts have no floor", historyFloor("pro", "2026-03-31") === null);
  check_("a garbage date yields no floor rather than a wrong one",
    historyFloor("free", "not-a-date") === null);
  // A month boundary is where an off-by-one would hide.
  check_("the window crosses a month end correctly",
    historyFloor("free", "2026-01-01") === "2025-12-03", String(historyFloor("free", "2026-01-01")));
}

// Every feature answers for every entitlement, without throwing.
for (const f of FEATURES) {
  for (const ent of ["free", "trial", "pro"] as const) {
    let threw = false;
    try { check(f, ent, 0); } catch { threw = true; }
    check_(`${f} answers for ${ent}`, !threw);
  }
}

// Reading the server's answer. The app never decides its own entitlement, so
// this parser is the only door — and every unrecognised thing has to land on
// "we do not know" rather than on "pro".
{
  const good = parseEntitlement({ status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z", plan: "yearly" });
  check_("a real answer is read", good?.status === "active", JSON.stringify(good));
  check_("and keeps the period it names",
    good?.currentPeriodEnd === "2026-12-01T00:00:00Z", JSON.stringify(good));

  for (const junk of [null, undefined, 0, "", "active", [], { status: "vip" }, { status: 1 }, {}]) {
    check_(`junk (${JSON.stringify(junk)}) is not an entitlement`,
      parseEntitlement(junk) === null, JSON.stringify(parseEntitlement(junk)));
  }
  // The dangerous one: a made-up status must never come through as anything.
  check_("an invented status is refused outright",
    parseEntitlement({ status: "pro", currentPeriodEnd: "2099-01-01T00:00:00Z" }) === null);
  // Fields of the wrong type are dropped, not coerced into a fake date.
  const odd = parseEntitlement({ status: "active", currentPeriodEnd: 12345, trialEndsAt: {} });
  check_("a non-string period is dropped rather than invented",
    odd?.status === "active" && odd.currentPeriodEnd === undefined && odd.trialEndsAt === undefined,
    JSON.stringify(odd));
  check_("an empty-string period is treated as absent",
    parseEntitlement({ status: "active", currentPeriodEnd: "" })?.currentPeriodEnd === undefined);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
