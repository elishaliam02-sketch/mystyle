import {
  isProgressing,
  readTrajectory,
  summariseCohort,
  type Trajectory,
  type WeighPoint,
} from "./trajectory";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const NOW = "2026-09-18T12:00:00.000Z";
const day = (d: string) => `2026-09-${d}T08:00:00.000Z`;

// A steady loser toward a goal below them.
{
  const pts: WeighPoint[] = [
    { date: day("01"), kg: 90 },
    { date: day("08"), kg: 89 },
    { date: day("15"), kg: 88 },
  ];
  const r = readTrajectory(pts, 80, NOW);
  check("steady loss toward goal is on-track", r.trajectory === "on-track", JSON.stringify(r));
  check("perWeek is negative and about a kilo", r.perWeek! < 0 && Math.abs(r.perWeek! + 1) < 0.2, String(r.perWeek));
  check("changeKg is the two kilos lost", r.changeKg === -2, String(r.changeKg));
  check("toGoalKg is the eight still to go", r.toGoalKg === 8, String(r.toGoalKg));
}

// Not enough readings.
check("a single weigh-in is no-data",
  readTrajectory([{ date: day("15"), kg: 88 }], 80, NOW).trajectory === "no-data");
check("no weigh-ins is no-data", readTrajectory([], 80, NOW).trajectory === "no-data");

// Enough readings but too short a span to trust a trend.
{
  const r = readTrajectory([{ date: day("14"), kg: 90 }, { date: day("15"), kg: 88 }], 80, NOW);
  check("two readings a day apart is still no-data", r.trajectory === "no-data", JSON.stringify(r));
}

// Flat over a real span.
{
  const r = readTrajectory([{ date: day("01"), kg: 88 }, { date: day("15"), kg: 88.0 }], 80, NOW);
  check("a flat fortnight is stalled", r.trajectory === "stalled", JSON.stringify(r));
}

// Drifting the wrong way.
{
  const r = readTrajectory([{ date: day("01"), kg: 88 }, { date: day("15"), kg: 91 }], 80, NOW);
  check("gaining while the goal is below is off-track", r.trajectory === "off-track", JSON.stringify(r));
}

// Barely moving = slow.
{
  const r = readTrajectory([{ date: day("01"), kg: 88 }, { date: day("15"), kg: 87.7 }], 80, NOW);
  check("a very small loss is slow", r.trajectory === "slow", JSON.stringify(r));
}

// Crash pace = fast (still toward goal, but flagged).
{
  const r = readTrajectory([{ date: day("01"), kg: 90 }, { date: day("15"), kg: 84 }], 80, NOW);
  check("losing very fast is fast", r.trajectory === "fast", JSON.stringify(r));
  check("fast still counts as progressing", isProgressing(r.trajectory));
}

// A goal ABOVE the current weight (someone bulking) reads symmetrically.
{
  const r = readTrajectory([{ date: day("01"), kg: 60 }, { date: day("15"), kg: 61 }], 70, NOW);
  check("gaining toward a higher goal is on-track", r.trajectory === "on-track", JSON.stringify(r));
}

// No goal set: losing is still read as progress.
{
  const r = readTrajectory([{ date: day("01"), kg: 90 }, { date: day("15"), kg: 88.5 }], undefined, NOW);
  check("with no goal, steady loss is on-track", r.trajectory === "on-track", JSON.stringify(r));
  check("with no goal, toGoalKg is null", r.toGoalKg === null, String(r.toGoalKg));
}

// Days since the last weigh-in.
{
  const r = readTrajectory([{ date: day("01"), kg: 90 }, { date: day("11"), kg: 88 }], 80, NOW);
  check("days since last weigh-in is measured", r.daysSinceWeighIn === 7, String(r.daysSinceWeighIn));
}

// Robust to junk points.
{
  const r = readTrajectory(
    [{ date: day("01"), kg: 90 }, { date: "", kg: NaN } as WeighPoint, { date: day("15"), kg: 88 }],
    80,
    NOW,
  );
  check("junk points are dropped, the real trend survives", r.trajectory === "on-track" && r.points === 2, JSON.stringify(r));
}

// isProgressing is exact about which states count.
check("stalled and off-track are not progressing",
  !isProgressing("stalled") && !isProgressing("off-track") && !isProgressing("no-data"));

// Cohort rollup.
{
  const cohort: Trajectory[] = ["on-track", "on-track", "slow", "stalled", "off-track", "fast", "no-data"];
  const s = summariseCohort(cohort);
  check("cohort total counts everyone", s.total === 7, JSON.stringify(s));
  check("progressing = on-track + slow + fast", s.progressing === 4, JSON.stringify(s));
  check("each bucket counted", s["on-track"] === 2 && s.stalled === 1 && s["off-track"] === 1, JSON.stringify(s));
}
check("an empty cohort is all zeros", (() => {
  const s = summariseCohort([]);
  return s.total === 0 && s.progressing === 0 && s["on-track"] === 0;
})());

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
