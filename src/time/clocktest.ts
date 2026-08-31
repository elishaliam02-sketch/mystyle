import { advanceHighWater, clockSuspect, toLocalDate, trustedNowMs } from "./clock";

const results: [string, boolean][] = [];
const check = (n: string, p: boolean) => results.push([n, p]);

const DAY = 86_400_000;
const t0 = Date.parse("2026-08-30T09:00:00Z");

// device ahead of the mark → device wins
check("clock moving forward is honoured", trustedNowMs(t0 + DAY, t0) === t0 + DAY);
// device set back behind the mark → the mark holds (no rewind)
check("a rewound clock cannot go back before the mark", trustedNowMs(t0 - 3 * DAY, t0) === t0);
// high-water only grows
check("high-water grows with a later instant", advanceHighWater(t0, t0 + DAY) === t0 + DAY);
check("high-water ignores an earlier instant", advanceHighWater(t0, t0 - DAY) === t0);
// suspicion
check("a 2-day gap from server is suspect", clockSuspect(t0 + 2 * DAY, t0) === true);
check("a few minutes of drift is fine", clockSuspect(t0 + 5 * 60_000, t0) === false);
// date formatting is local and stable
check("local date formats YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(toLocalDate(t0)));

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
