/**
 * Tests for the body-number guards. The headline case is the real one that
 * started this: someone weighing 71 kg setting a target of 20 kg, and the app
 * accepting it. Most of what follows is an attempt to get that value in
 * anyway — no height, an absurd height, a goal set before any weigh-in, a goal
 * nudged down one kilo at a time.
 */
import {
  ABSOLUTE_FLOOR_KG,
  bmi,
  bmiBand,
  ceilingGoalKg,
  checkGoalWeight,
  floorGoalKg,
  healthyRange,
  isHeightCm,
  isStorableGoal,
  MAX_KG,
  MIN_KG,
} from "./index";
import {
  averageSteps,
  clampSteps,
  isStorableGoal as isStorableStepGoal,
  isStorableSteps,
  MAX_STEPS,
  recentSteps,
  stepStreak,
  stepsKcal,
  stepsKm,
  stepsOn,
} from "./steps";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

// --- the case that started this
{
  check("71 kg cannot target 20 kg", !isStorableGoal(20, 71, undefined));
  check("71 kg cannot target 20 kg even at 171 cm", !isStorableGoal(20, 71, 171));
  check("20 kg is refused as physically out of range", checkGoalWeight(20, 71, 171).status === "out-of-range");
  check("a goal inside the hard range but under the healthy floor names that floor", (() => {
    const r = checkGoalWeight(30, 71, 171);
    return r.status === "too-low" && r.floor >= 53;
  })(), JSON.stringify(checkGoalWeight(30, 71, 171)));
  check("even 52 kg is refused at 171 cm", !isStorableGoal(52, 71, 171));
  check("71 kg targeting 65 kg is fine", isStorableGoal(65, 71, 171));
  check("71 kg targeting 60 kg is fine", isStorableGoal(60, 71, 171));
}

// --- trying to get round it
{
  check("no height does not open the door", !isStorableGoal(20, 71));
  check("no height refuses even a sane-looking target", !isStorableGoal(65, 71));
  check("the refusal without a height asks for one",
    checkGoalWeight(65, 71).status === "needs-height");
  check("logging an absurdly low weight cannot walk the floor down", (() => {
    // the old hole: weigh in at the minimum, then set a 40 kg target
    return !isStorableGoal(40, 25);
  })());
  check("no current weight does not open the door", !isStorableGoal(20, undefined, 171));
  check("a low weigh-in still cannot beat the height's floor", !isStorableGoal(40, 25, 171));
  check("neither one known still refuses 20", !isStorableGoal(20));
  check("nothing at all still refuses 25", !isStorableGoal(25));
  check("an absurd height is not a loophole", !isStorableGoal(20, 71, 999));
  check("a tiny height is not a loophole", !isStorableGoal(20, 71, 10));
  check("a negative height is not a loophole", !isStorableGoal(20, 71, -180));
  check("a zero goal is refused", !isStorableGoal(0, 71, 171));
  check("a negative goal is refused", !isStorableGoal(-5, 71, 171));
  check("NaN is refused", !isStorableGoal(Number.NaN, 71, 171));
  check("Infinity is refused", !isStorableGoal(Number.POSITIVE_INFINITY, 71, 171));
  check("a goal of 39.9 is refused with nothing known", !isStorableGoal(39.9));
  check("walking it down one kilo at a time still hits the floor", (() => {
    // each step re-reads the *current* weight, so the floor moves with them —
    // but never below the healthy band for the height
    let current = 71;
    for (let i = 0; i < 40; i++) {
      const target = Math.round((current - 1) * 10) / 10;
      if (!isStorableGoal(target, current, 171)) break;
      current = target;
    }
    return current >= 53; // BMI 18.5 at 171 cm
  })(), "");
  check("a very short person still cannot go under the absolute floor",
    !isStorableGoal(35, 45, 130));
}

// --- the honest cases still work
{
  check("a heavy person can set a serious but sane target", isStorableGoal(95, 120, 180));
  check("a bulk target is allowed", isStorableGoal(85, 75, 180));
  check("an absurd bulk is not", !isStorableGoal(300, 75, 180));
  check("the ceiling is reported", (() => {
    const r = checkGoalWeight(300, 75, 180);
    return r.status === "too-high" && r.ceiling < 300;
  })());
  check("out-of-range is reported separately from too-low", (() => {
    const r = checkGoalWeight(10, 71, 171);
    return r.status === "out-of-range" && r.min === MIN_KG && r.max === MAX_KG;
  })());
}

// --- the pieces underneath
{
  check("bmi of 70 kg at 175 cm is about 22.9", bmi(70, 175) === 22.9, String(bmi(70, 175)));
  check("bmi with no height is null", bmi(70) === null);
  check("bmi with an absurd height is null", bmi(70, 5) === null);
  check("bmi of zero weight is null", bmi(0, 175) === null);
  check("22 is a healthy band", bmiBand(22) === "healthy");
  check("17 is under", bmiBand(17) === "under");
  check("27 is over", bmiBand(27) === "over");
  check("33 is obese", bmiBand(33) === "obese");
  check("a healthy range at 175 cm brackets 70 kg", (() => {
    const r = healthyRange(175)!;
    return r.min < 70 && r.max > 70;
  })());
  check("a healthy range needs a real height", healthyRange(15) === null);
  check("120 cm is a height", isHeightCm(120));
  check("119 cm is not", !isHeightCm(119));
  check("231 cm is not", !isHeightCm(231));
  check("the floor is never under the absolute floor", (() => {
    for (const h of [120, 150, 171, 190, 230]) {
      for (const c of [undefined, 40, 71, 120, 300]) {
        if (floorGoalKg(c, h) < ABSOLUTE_FLOOR_KG) return false;
      }
    }
    return true;
  })());
  check("the ceiling never exceeds the hard maximum", (() => {
    for (const h of [120, 171, 230]) {
      for (const c of [undefined, 40, 120, 399]) {
        if (ceilingGoalKg(c, h) > MAX_KG) return false;
      }
    }
    return true;
  })());
  check("a floor is always below its ceiling", (() => {
    for (const h of [120, 150, 171, 190, 230]) {
      for (const c of [undefined, 45, 71, 120, 200]) {
        if (floorGoalKg(c, h) >= ceilingGoalKg(c, h)) return false;
      }
    }
    return true;
  })());
}

// --- the step log
{
  const log = { "2026-03-10": 9000, "2026-03-11": 11000, "2026-03-12": 4000, "2026-03-13": 8200 };
  check("today's steps are read back", stepsOn(log, "2026-03-13") === 8200);
  check("an unlogged day is zero, not undefined", stepsOn(log, "2026-03-14") === 0);
  check("a window includes the zero days", (() => {
    const rows = recentSteps(log, "2026-03-14", 5);
    return rows.length === 5 && rows.at(-1)!.steps === 0 && rows[0]!.date === "2026-03-10";
  })());
  check("a window is oldest first", (() => {
    const rows = recentSteps(log, "2026-03-13", 4);
    return rows[0]!.date === "2026-03-10" && rows.at(-1)!.date === "2026-03-13";
  })());
  check("a window crosses a month boundary", (() => {
    const rows = recentSteps({ "2026-02-28": 5 }, "2026-03-02", 4);
    return rows.map((r) => r.date).join(",") === "2026-02-27,2026-02-28,2026-03-01,2026-03-02";
  })());
  check("the average is over the whole window, zeros included",
    averageSteps(log, "2026-03-13", 4) === Math.round((9000 + 11000 + 4000 + 8200) / 4),
    String(averageSteps(log, "2026-03-13", 4)));
  check("an empty log averages zero", averageSteps({}, "2026-03-13", 7) === 0);

  check("a streak counts days that met the target", stepStreak(log, "2026-03-13", 8000) === 1);
  check("a day logged below target breaks the streak", stepStreak(log, "2026-03-12", 8000) === 0);
  check("but the good days before it still counted", stepStreak(log, "2026-03-11", 8000) === 2);
  check("two good days in a row count as two",
    stepStreak({ "2026-03-12": 9000, "2026-03-13": 9000 }, "2026-03-13", 8000) === 2);
  check("an unlogged today does not break yesterday's streak",
    stepStreak({ "2026-03-12": 9000, "2026-03-13": 9000 }, "2026-03-14", 8000) === 2);
  check("an empty log has no streak", stepStreak({}, "2026-03-13", 8000) === 0);
  check("a zero goal falls back to the default rather than counting everything",
    stepStreak({ "2026-03-13": 10 }, "2026-03-13", 0) === 0);

  check("steps are validated", isStorableSteps(8000) && !isStorableSteps(-1) && !isStorableSteps(200000));
  check("a fractional step count is refused", !isStorableSteps(1.5));
  check("NaN steps are refused", !isStorableSteps(Number.NaN));
  check("junk clamps to zero", clampSteps(Number.NaN) === 0 && clampSteps(-9) === 0);
  check("an absurd count clamps to the cap", clampSteps(1e9) === MAX_STEPS);
  check("a goal below the minimum is refused", !isStorableStepGoal(500));
  check("a goal above the maximum is refused", !isStorableStepGoal(99999));
  check("a sane goal passes", isStorableStepGoal(10000));

  check("calories scale with body weight", stepsKcal(10000, 100) > stepsKcal(10000, 60));
  check("no weight still gives an estimate", stepsKcal(10000) > 0);
  check("zero steps burn nothing", stepsKcal(0, 80) === 0);
  check("distance is about 7 km for 10000 steps", stepsKm(10000) === 7.2, String(stepsKm(10000)));
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
