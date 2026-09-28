import { adaptiveTarget } from "./adaptive";
import { dailyTarget } from "./index";

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.UTC(2026, 8, 1) + d * DAY).toISOString().slice(0, 10);
/** Weigh-ins every other day for `days`, moving `perWeek` kg a week from `start`. */
function series(start: number, perWeek: number, days: number) {
  const out = [];
  for (let d = 0; d <= days; d += 2) out.push({ date: iso(d), kg: Math.round((start + (perWeek * d) / 7) * 10) / 10 });
  return out;
}

{
  const t = adaptiveTarget({ weighIns: [], goal: "cut", fallbackKg: 80, today: iso(0) });
  check("no weigh-ins: the formula's target, learning", t.status === "learning" && t.kcal === dailyTarget(80, "cut").kcal && t.daysToGo === 14);
}
{
  const t = adaptiveTarget({ weighIns: series(80, -0.4, 6), goal: "cut", today: iso(6) });
  check("under two weeks: still learning, with days to go", t.status === "learning" && t.daysToGo === 8, JSON.stringify(t));
}
{
  // Cutting, but the weight is flat: the target comes down.
  const t = adaptiveTarget({ weighIns: series(80, 0, 21), goal: "cut", today: iso(21) });
  check("cut, weight not moving: the target is lowered", t.status === "lowered" && t.kcal < t.base, JSON.stringify(t));
  check("by at most 150 a week", t.adjust >= -300 && t.last!.step >= -150);
}
{
  // Cutting at the goal's pace (0.5% of 80 = 0.4 kg a week): no change.
  const t = adaptiveTarget({ weighIns: series(80, -0.4, 21), goal: "cut", today: iso(21) });
  check("cut on pace: the target holds", t.status === "onTrack" && t.adjust === 0, JSON.stringify(t.last));
}
{
  // Cutting far too fast (1.2 kg a week): more food.
  const t = adaptiveTarget({ weighIns: series(80, -1.2, 21), goal: "cut", today: iso(21) });
  check("cut too fast: the target is raised", t.status === "raised" && t.kcal > t.base);
}
{
  // Bulking but not gaining: more food.
  const t = adaptiveTarget({ weighIns: series(70, 0, 21), goal: "bulk", today: iso(21) });
  check("bulk, not gaining: the target is raised", t.status === "raised" && t.kcal > t.base);
}
{
  // Bulking far too fast (0.8 kg a week, mostly fat): less food.
  const t = adaptiveTarget({ weighIns: series(70, 0.8, 21), goal: "bulk", today: iso(21) });
  check("bulk too fast: the target is lowered", t.status === "lowered" && t.kcal < t.base);
}
{
  // Months of a stalled cut: the drift is capped.
  const t = adaptiveTarget({ weighIns: series(80, 0, 120), goal: "cut", today: iso(120) });
  check("the total change is capped at 500 a day", t.adjust === -500, String(t.adjust));
  check("and never below 1200", t.kcal >= 1200);
}
{
  // A switch to bulk starts over, whatever the cut learned.
  const w = series(80, 0, 60);
  const t = adaptiveTarget({ weighIns: w, goal: "bulk", goalSince: iso(55), today: iso(60) });
  check("a new goal starts learning again", t.status === "learning" && t.adjust === 0, JSON.stringify(t));
}
{
  // Noisy weigh-ins around a flat line do not move a maintain goal.
  const w = series(75, 0, 28).map((p, i) => ({ ...p, kg: p.kg + (i % 2 ? 0.3 : -0.3) }));
  const t = adaptiveTarget({ weighIns: w, goal: "maintain", today: iso(28) });
  check("day-to-day noise does not move the target", t.adjust === 0, JSON.stringify(t.last));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
