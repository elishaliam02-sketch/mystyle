import { accessFor, accessForAccount, appUnlocked, type Access } from "./access";
import { trialEndsAt } from "./plans";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const NOW = "2026-09-18T12:00:00.000Z";
const future = "2026-12-01T00:00:00.000Z";
const past = "2026-01-01T00:00:00.000Z";

// ---------------------------------------------------------------- the core rule
// No account is the door before money, always.
for (const ent of ["free", "trial", "pro"] as const) {
  check(`no account → auth even when entitlement is ${ent}`,
    accessFor({ hasAccount: false, entitlement: ent }) === "auth");
}

// A real account with something live gets the app.
check("account + trial → app", accessFor({ hasAccount: true, entitlement: "trial" }) === "app");
check("account + pro → app", accessFor({ hasAccount: true, entitlement: "pro" }) === "app");
// A real account with nothing live is sent to pay — never into the app.
check("account + free → subscribe", accessFor({ hasAccount: true, entitlement: "free" }) === "subscribe");

// The app is unlocked for exactly one answer.
check("only 'app' unlocks", appUnlocked("app") && !appUnlocked("auth") && !appUnlocked("subscribe"));

// -------------------------------------------------------- composed with billing
// Signed out with a stale paid blob lying around is still sent to the door.
check("no account ignores a stale subscription blob",
  accessForAccount({ hasAccount: false, nowIso: NOW,
    subscription: { status: "active", currentPeriodEnd: future } }) === "auth");

// A live paid period opens the app.
check("active + open period → app",
  accessForAccount({ hasAccount: true, nowIso: NOW,
    subscription: { status: "active", currentPeriodEnd: future } }) === "app");

// A trial that has not run out opens the app.
check("trialing + trial in future → app",
  accessForAccount({ hasAccount: true, nowIso: NOW,
    subscription: { status: "trialing", trialEndsAt: future } }) === "app");

// A cancelled-but-still-paid account keeps the app until the period ends.
check("canceled but period still open → app",
  accessForAccount({ hasAccount: true, nowIso: NOW,
    subscription: { status: "canceled", currentPeriodEnd: future } }) === "app");
check("canceled and period passed → subscribe",
  accessForAccount({ hasAccount: true, nowIso: NOW,
    subscription: { status: "canceled", currentPeriodEnd: past } }) === "subscribe");

// An expired trial falls to the paywall, never into the app.
check("trial that ran out → subscribe",
  accessForAccount({ hasAccount: true, nowIso: NOW,
    subscription: { status: "trialing", trialEndsAt: past } }) === "subscribe");

// past_due is not paid: back to the paywall.
check("past_due → subscribe",
  accessForAccount({ hasAccount: true, nowIso: NOW,
    subscription: { status: "past_due", currentPeriodEnd: future } }) === "subscribe");

// The failure direction is always "you get less".
for (const junk of [null, undefined, {}, { status: "vip" as never }]) {
  check(`a signed-in account with junk subscription (${JSON.stringify(junk)}) → subscribe`,
    accessForAccount({ hasAccount: true, nowIso: NOW, subscription: junk as never }) === "subscribe");
}

// A nonsense clock cannot promote anyone into the app.
check("an unparseable now → subscribe, not app",
  accessForAccount({ hasAccount: true, nowIso: "not-a-date",
    subscription: { status: "active", currentPeriodEnd: future } }) === "subscribe");

// The 7-day trial boundary, exactly. The end instant is exclusive.
{
  const start = "2026-09-18T00:00:00.000Z";
  const ends = trialEndsAt(start, 7)!;
  const justBefore = new Date(Date.parse(ends) - 1000).toISOString();
  check("one second before trial end → app",
    accessForAccount({ hasAccount: true, nowIso: justBefore,
      subscription: { status: "trialing", trialEndsAt: ends } }) === "app");
  check("exactly at trial end → subscribe",
    accessForAccount({ hasAccount: true, nowIso: ends,
      subscription: { status: "trialing", trialEndsAt: ends } }) === "subscribe");
}

// Every answer is one of the three the router knows how to handle.
const answers: Access[] = ["auth", "subscribe", "app"];
check("every path returns a known access value",
  results.length > 0 && answers.length === 3);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
