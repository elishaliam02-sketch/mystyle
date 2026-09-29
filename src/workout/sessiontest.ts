import {
  activityBonus,
  elapsedSec,
  formatElapsed,
  liveStats,
  MAX_WORKOUT_SEC,
  readActive,
  readHistory,
  strengthKcal,
  summarize,
} from "./session";

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

check("clock reads m:ss", formatElapsed(247) === "4:07", formatElapsed(247));
check("clock reads h:mm:ss past an hour", formatElapsed(3729) === "1:02:09", formatElapsed(3729));
check("clock never negative", formatElapsed(-5) === "0:00");
check("elapsed counts from the stored start", elapsedSec(1_000_000, 1_000_000 + 90_500) === 90);
check("a clock set in the future reads zero", elapsedSec(2_000_000, 1_000_000) === 0);
check("a forgotten workout is capped", elapsedSec(0, 10 * 3600 * 1000) === MAX_WORKOUT_SEC);

check("an hour of lifting at 80 kg ≈ 320 kcal", strengthKcal(3600, 80) === 320, String(strengthKcal(3600, 80)));
check("no weight known falls back to 70 kg", strengthKcal(3600, 0) === 280);

const done = (kg: number, reps: number) => ({ kg, reps, done: true });
const open = (kg: number, reps: number) => ({ kg, reps, done: false });
{
  const s = liveStats({ a: [done(50, 10), open(50, 10)], b: [done(20, 12)] }, ["a", "b", "c"]);
  check("live stats: sets done / total / volume", s.sets === 2 && s.total === 3 && s.volume === 740, JSON.stringify(s));
  const p = liveStats({ a: [done(50, 10)] }, ["a", "b"], 3);
  check("an untouched exercise counts its prescribed sets", p.total === 4, JSON.stringify(p));
}
{
  const setLog = {
    "2026-09-20": { bench: [done(60, 8)], squat: [done(100, 5)] },
    "2026-09-27": { bench: [done(62.5, 8), done(62.5, 7)], squat: [done(90, 5)], row: [open(40, 10)] },
  };
  const r = summarize({
    id: "x",
    active: { day: 1, startedAt: 0, date: "2026-09-27" },
    dayType: "push",
    exerciseIds: ["bench", "squat", "row"],
    setLog,
    endedAt: 45 * 60 * 1000,
    kg: 80,
  });
  check("summary: duration from start to finish", r.durationSec === 2700);
  check("summary: only ticked sets count", r.sets === 3 && r.exercises === 2, JSON.stringify(r));
  check("summary: volume", r.volumeKg === Math.round(62.5 * 8 + 62.5 * 7 + 90 * 5), String(r.volumeKg));
  check("summary: a beaten best is a PR, a lighter day is not", r.prs === 1, String(r.prs));
  check("summary: calories from the duration", r.kcal === strengthKcal(2700, 80));
}
{
  const r = summarize({
    id: "y",
    active: { day: 0, startedAt: 0, date: "2026-09-01" },
    dayType: "legs",
    exerciseIds: ["squat"],
    setLog: { "2026-09-01": { squat: [done(100, 5)] } },
    endedAt: 60_000,
    kg: 70,
  });
  check("the first time an exercise is done is not a PR", r.prs === 0);
}

check("active: a valid one reads back", readActive({ day: 2, startedAt: 5, date: "2026-09-29" })?.day === 2);
check("active: junk is ignored", readActive({ day: "x" }) === null && readActive(null) === null);
check(
  "history: malformed rows are dropped",
  readHistory([{ id: "a", date: "2026-09-29", durationSec: 60, volumeKg: 0, sets: 0, kcal: 5 }, { id: 3 }, null]).length === 1,
);
check("history: not an array reads empty", readHistory("x").length === 0);

{
  const b = activityBonus({ workoutKcal: 320, steps: 3000, kg: 80 });
  check("a workout adds half its burn back", b.workout === 160 && b.steps === 0 && b.total === 160, JSON.stringify(b));
}
{
  const b = activityBonus({ workoutKcal: 0, steps: 15000, kg: 70 });
  check("steps above 5000 add half their burn", b.steps === 200 && b.total === 200, JSON.stringify(b));
}
check("the bonus is capped", activityBonus({ workoutKcal: 5000, steps: 60000, kg: 120 }).total === 600);
check("a quiet day adds nothing", activityBonus({ workoutKcal: 0, steps: 0, kg: 70 }).total === 0);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
