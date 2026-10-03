/**
 * Tests for habit days: what is owed when, and what a streak is once some
 * days are rest days.
 */
import { addDays, dueCount, dueOn, dueWeekday, longestStreakOf, normalizeDays, streakOf, weekdayOf } from "./schedule";

const results: [string, boolean, string?][] = [];
const check = (name: string, pass: boolean, detail?: string) => results.push([name, pass, detail]);

// 2026-10-04 is a Sunday.
check("Sunday is 0", weekdayOf("2026-10-04") === 0, String(weekdayOf("2026-10-04")));
check("Saturday is 6", weekdayOf("2026-10-03") === 6);
check("a month boundary moves cleanly", addDays("2026-10-31", 1) === "2026-11-01" && addDays("2026-03-01", -1) === "2026-02-28");
check("a year boundary too", addDays("2026-12-31", 1) === "2027-01-01");

check("no days means every day", normalizeDays(undefined) === undefined && normalizeDays([]) === undefined);
check("all seven means every day", normalizeDays([6, 5, 4, 3, 2, 1, 0]) === undefined);
check("days are sorted and unique", normalizeDays([5, 1, 3, 1])?.join() === "1,3,5");
check("nonsense is dropped", normalizeDays([1, 9, -1, 2.5, "3", null])?.join() === "1");
check("a non-list is every day", normalizeDays("1,3") === undefined);

const daily = { createdAt: "2026-09-01" };
const mwf = { createdAt: "2026-09-01", days: [1, 3, 5] }; // Mon, Wed, Fri
check("a daily habit is due every day", dueOn(daily, "2026-10-03") && dueOn(daily, "2026-10-04"));
check("a Mon/Wed/Fri habit is due on Monday", dueOn(mwf, "2026-10-05"));
check("and not on Tuesday", !dueOn(mwf, "2026-10-06"));
check("nothing is due before the habit existed", !dueOn(daily, "2026-08-31"));
check("dueWeekday reads the list", dueWeekday([1, 3], 3) && !dueWeekday([1, 3], 4) && dueWeekday(undefined, 4));
check("only the due ones are counted", dueCount([daily, mwf], "2026-10-06") === 1 && dueCount([daily, mwf], "2026-10-05") === 2);

// --- streaks
{
  // Mon 28/9, Wed 30/9, Fri 2/10 done; today Sat 3/10 (rest day).
  const done = new Set(["2026-09-28", "2026-09-30", "2026-10-02"]);
  check("rest days do not break a streak", streakOf(mwf, done, "2026-10-03") === 3, String(streakOf(mwf, done, "2026-10-03")));
  check("the same ticks on a daily habit are a streak of one", streakOf(daily, done, "2026-10-03") === 1,
    String(streakOf(daily, done, "2026-10-03")));
  // Monday 5/10, not ticked yet: still open, the run stands.
  check("an unticked due today is not yet a miss", streakOf(mwf, done, "2026-10-05") === 3);
  // Tuesday 6/10 with Monday missed: broken.
  check("a missed due day breaks it", streakOf(mwf, done, "2026-10-06") === 0);
  const bonus = new Set([...done, "2026-10-01"]); // a Thursday tick too
  check("a tick on a rest day changes nothing", streakOf(mwf, bonus, "2026-10-03") === 3);
  const dailyRun = new Set(["2026-10-01", "2026-10-02", "2026-10-03"]);
  check("a daily habit counts as before", streakOf(daily, dailyRun, "2026-10-03") === 3);
  check("and a daily habit unticked today keeps yesterday's run", streakOf(daily, dailyRun, "2026-10-04") === 3);
  check("a gap breaks a daily habit", streakOf(daily, new Set(["2026-10-01", "2026-10-03"]), "2026-10-03") === 1);
  check("no ticks, no streak", streakOf(mwf, new Set(), "2026-10-03") === 0);
}

// --- the longest run
{
  const done = new Set(["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-14", "2026-09-21"]); // M W F M, gap, M
  check("the record runs over rest days", longestStreakOf(mwf, done, "2026-10-03") === 4, String(longestStreakOf(mwf, done, "2026-10-03")));
  check("a daily habit's record is plain consecutive days",
    longestStreakOf(daily, new Set(["2026-09-02", "2026-09-03", "2026-09-05"]), "2026-10-03") === 2);
  check("nothing done, no record", longestStreakOf(mwf, new Set(), "2026-10-03") === 0);
  check("today unticked does not end the record", longestStreakOf(daily, new Set(["2026-10-02"]), "2026-10-03") === 1);
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
