import { historyOf, increment, nextTarget, repRange, weekReview } from "./coach";
import type { WorkoutRecord } from "./session";

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);
const S = (kg: number, ...reps: number[]) => reps.map((r) => ({ kg, reps: r, done: true }));

check("rep range is read", JSON.stringify(repRange("8–12")) === '{"lo":8,"hi":12}' && repRange("10").hi === 10);
check("heavy compound adds 5, light adds 2.5, isolation 1–2.5", increment(100, true) === 5 && increment(40, true) === 2.5 && increment(10, false) === 1 && increment(25, false) === 2.5);

{
  const t = nextTarget([], "8–12", true);
  check("first time: start at the bottom of the range", t.kind === "first" && t.reps === 8 && t.last === null);
}
{
  const t = nextTarget([S(60, 12, 12, 12)], "8–12", true);
  check("every set at the top: add weight, back to the bottom", t.kind === "addWeight" && t.kg === 62.5 && t.reps === 8, JSON.stringify(t));
}
{
  const t = nextTarget([S(60, 10, 9, 8)], "8–12", true);
  check("in the range: same weight, one more rep than the weakest set", t.kind === "moreReps" && t.kg === 60 && t.reps === 9, JSON.stringify(t));
  check("says what last time was", t.last?.kg === 60 && t.last?.reps === 8);
}
{
  const t = nextTarget([S(60, 6, 5, 5)], "8–12", true);
  check("below the range: repeat the weight", t.kind === "repeat" && t.kg === 60 && t.reps === 8, JSON.stringify(t));
}
{
  const t = nextTarget([S(0, 15, 15, 14)], "12–15", false);
  check("bodyweight in range: more reps", t.kind === "moreReps" && t.kg === 0 && t.reps === 15, JSON.stringify(t));
  const u = nextTarget([S(0, 15, 15, 15)], "12–15", false);
  check("bodyweight past the range: keep adding reps (harder variation hint)", u.kind === "addWeight" && u.kg === 0 && u.reps === 16, JSON.stringify(u));
}
{
  const stuck = [S(80, 10, 10, 9), S(80, 9, 9, 8), S(80, 9, 8, 8), S(80, 8, 8, 8)];
  const t = nextTarget(stuck, "6–10", true);
  check("three sessions without progress: deload 10%", t.kind === "deload" && t.kg === 72.5 && t.reps === 10, JSON.stringify(t));
  const moving = [S(80, 8, 8, 8), S(80, 9, 8, 8), S(80, 9, 9, 8), S(80, 10, 9, 9)];
  check("steady progress is not a deload", nextTarget(moving, "6–10", true).kind !== "deload");
}
{
  const withEmpty = [[{ kg: 50, reps: 10, done: true }, { kg: 0, reps: 0, done: false }]];
  const t = nextTarget(withEmpty, "8–10", true);
  check("unticked empty rows are ignored", t.kind === "addWeight" && t.kg === 52.5, JSON.stringify(t));
}
{
  const log = { "2026-09-01": { bench: S(50, 8) }, "2026-09-05": { bench: S(52.5, 8) }, "2026-09-10": { bench: S(55, 8) } };
  const h = historyOf(log, "bench", "2026-09-10");
  check("history is earlier sessions, oldest first", h.length === 2 && h[1]![0]!.kg === 52.5);
}

const rec = (date: string, prs = 0, min = 45): WorkoutRecord => ({ id: date, date, day: 0, dayType: "push", startedAt: 0, durationSec: min * 60, volumeKg: 1000, sets: 12, exercises: 4, prs, kcal: 200 });
{
  const w = weekReview({}, [], 3, "2026-09-30");
  check("never trained: start", w.mood === "start" && w.sinceLast === null);
}
{
  const log = { "2026-09-28": ["a"], "2026-09-29": ["a"], "2026-09-30": ["a"] };
  const w = weekReview(log, [rec("2026-09-30", 1)], 3, "2026-09-30");
  check("plan met with a PR: crushing it", w.done === 3 && w.mood === "crushing", JSON.stringify(w));
  check("minutes of the week", w.minutes === 45);
}
{
  const log = { "2026-09-20": ["a"] };
  const w = weekReview(log, [], 3, "2026-09-30");
  check("ten days off: a comeback", w.mood === "comeback" && w.sinceLast === 10, JSON.stringify(w));
}
{
  const log = { "2026-09-29": ["a"] };
  const w = weekReview(log, [], 3, "2026-09-30");
  check("one done, time left: on track", w.mood === "onTrack", JSON.stringify(w));
}
{
  const log: Record<string, string[]> = {};
  for (const d of ["2026-09-09", "2026-09-11", "2026-09-13", "2026-09-16", "2026-09-18", "2026-09-20", "2026-09-23", "2026-09-25", "2026-09-27"]) log[d] = ["a"];
  const w = weekReview(log, [], 3, "2026-09-30");
  check("weeks in a row at the plan", w.streakWeeks >= 2, JSON.stringify(w));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
