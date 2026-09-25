import { comparePhotos, photoDue, photoWeeks, photoWeight } from "./journey";
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
  defaultWaterGoal,
  fillFraction,
  isStorableWaterGoal,
  MAX_WATER_GOAL,
  MIN_WATER_GOAL,
  recommendedRange,
  waterStatus,
  cupMlOf,
  isStorableCupMl,
  CUP_SIZES,
} from "./water";
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
import {
  bodyFatPercent,
  bodyFatTarget,
  fatTier,
  isoWeek,
  weeklyAverages,
  weeklyChange,
} from "./composition";

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

// --- water: a range that scales with weight, a goal you can set, a fill to draw
{
  check("a heavier person is recommended more water", recommendedRange(100).max > recommendedRange(50).max);
  check("the range is always a real span", (() => {
    for (const w of [40, 60, 80, 120, undefined]) {
      const r = recommendedRange(w as number | undefined);
      if (!(r.min >= MIN_WATER_GOAL && r.max <= MAX_WATER_GOAL && r.min < r.max)) return false;
    }
    return true;
  })());
  check("no weight still gives a sensible range", (() => {
    const r = recommendedRange(undefined);
    return r.min >= 6 && r.max <= 12;
  })());
  check("the default goal sits inside the range", (() => {
    const g = defaultWaterGoal(80);
    const r = recommendedRange(80);
    return g >= r.min && g <= r.max;
  })());
  check("a goal in range is storable", isStorableWaterGoal(8));
  check("too few cups is refused", !isStorableWaterGoal(3));
  check("too many cups is refused", !isStorableWaterGoal(20));
  check("a fractional goal is refused", !isStorableWaterGoal(8.5));

  check("an empty day reads empty", waterStatus(0, 8) === "empty");
  check("halfway reads on track", waterStatus(5, 8) === "onTrack");
  check("hitting the goal reads met", waterStatus(8, 8) === "met");
  check("just under is not met", waterStatus(7, 8) !== "met");
  check("way over is flagged", waterStatus(20, 8) === "over");
  check("a low count reads low", waterStatus(1, 10) === "low");

  check("the bottle is empty at zero", fillFraction(0, 8) === 0);
  check("the bottle is half at half", fillFraction(4, 8) === 0.5);
  check("the bottle never overflows past full", fillFraction(20, 8) === 1);
  check("a zero goal cannot divide by zero", fillFraction(3, 0) === 0);
}

// --- body composition: weekly averages and a body-fat estimate
{
  // Two ISO weeks; three readings in the first, one in the second.
  const weighIns = [
    { date: "2026-03-02", kg: 80 }, // Mon, week 10
    { date: "2026-03-04", kg: 80.6 },
    { date: "2026-03-06", kg: 79.4 },
    { date: "2026-03-09", kg: 79 }, // Mon, week 11
  ];
  check("two calendar weeks collapse to two points", weeklyAverages(weighIns).length === 2);
  check("a week's average is the mean of its readings", (() => {
    const w = weeklyAverages(weighIns)[0]!;
    return w.avgKg === 80 && w.count === 3;
  })(), JSON.stringify(weeklyAverages(weighIns)[0]));
  check("weeks come out oldest first", (() => {
    const ws = weeklyAverages(weighIns);
    return ws[0]!.from < ws[1]!.from;
  })());
  check("the weekly change compares this week to last", weeklyChange(weighIns) === -1,
    String(weeklyChange(weighIns)));
  check("one week alone has no change yet", weeklyChange([{ date: "2026-03-02", kg: 80 }]) === null);
  check("days in the same week share a key", isoWeek("2026-03-02") === isoWeek("2026-03-08"));
  check("the next Monday is a new week", isoWeek("2026-03-08") !== isoWeek("2026-03-09"));
  check("an empty log has no weeks", weeklyAverages([]).length === 0);

  // body fat (RFM)
  check("a leaner waist reads a lower body fat", (() => {
    const lean = bodyFatPercent({ heightCm: 180, waistCm: 80, sex: "male" })!;
    const soft = bodyFatPercent({ heightCm: 180, waistCm: 100, sex: "male" })!;
    return lean < soft;
  })());
  check("a man at 180/85 is roughly mid-teens", (() => {
    const bf = bodyFatPercent({ heightCm: 180, waistCm: 85, sex: "male" })!;
    return bf > 10 && bf < 22;
  })(), String(bodyFatPercent({ heightCm: 180, waistCm: 85, sex: "male" })));
  check("women read higher than men at the same measures", (() => {
    const m = bodyFatPercent({ heightCm: 170, waistCm: 80, sex: "male" })!;
    const f = bodyFatPercent({ heightCm: 170, waistCm: 80, sex: "female" })!;
    return f > m;
  })());
  check("no sex means no estimate", bodyFatPercent({ heightCm: 180, waistCm: 85 }) === null);
  check("no waist means no estimate", bodyFatPercent({ heightCm: 180, sex: "male" }) === null);
  check("an absurd waist is refused", bodyFatPercent({ heightCm: 180, waistCm: 5, sex: "male" }) === null);

  // targets shift with the goal
  check("a cut targets less fat than a bulk", (() => {
    const cut = bodyFatTarget("cut", "male");
    const bulk = bodyFatTarget("bulk", "male");
    return cut.max < bulk.max;
  })());
  check("a number inside the band reads 'in'", (() => {
    const band = bodyFatTarget("recomp", "male");
    return fatTier((band.min + band.max) / 2, band) === "in";
  })());
  check("below the band reads 'below'", fatTier(6, bodyFatTarget("recomp", "male")) === "below");
  check("above the band reads 'above'", fatTier(30, bodyFatTarget("recomp", "male")) === "above");
}

// ---- cup size: a person counts in the vessel they actually drink from
{
  check("the default cup is 250 ml", cupMlOf(undefined) === 250);
  check("a chosen cup is kept", cupMlOf(500) === 500);
  check("a nonsense cup falls back to 250", cupMlOf(NaN) === 250 && cupMlOf(0) === 250 && cupMlOf(-5) === 250);
  check("an absurd cup is refused", !isStorableCupMl(5000) && !isStorableCupMl(10));
  check("a real cup is accepted", isStorableCupMl(330) && isStorableCupMl(750));
  check("every offered size is storable", CUP_SIZES.every((n) => isStorableCupMl(n)));
  // the recommended band is in cups, so a bigger cup means fewer of them
  const small = recommendedRange(80, 250);
  const big = recommendedRange(80, 500);
  check("a bigger cup lowers the recommended count", big.max <= small.max, `${big.max} vs ${small.max}`);
  check("the band is still a real range for a big cup", big.max > big.min || big.max === big.min + 1 || big.min >= 4);
  check("the default range matches the 250 ml range", (() => {
    const a = recommendedRange(80); const b = recommendedRange(80, 250);
    return a.min === b.min && a.max === b.max;
  })());
}

// --- the progress-photo journey: each photo stands beside its week's average
{
  const w = [
    { date: "2026-09-07", kg: 90.4 }, { date: "2026-09-09", kg: 89.6 }, { date: "2026-09-11", kg: 90.0 },
    { date: "2026-09-28", kg: 87.9 }, { date: "2026-09-30", kg: 88.3 },
  ];
  const weeks = weeklyAverages(w);
  const first = { id: "a", date: "2026-09-08", kg: 91 };
  const later = { id: "b", date: "2026-10-01", kg: 87 };
  check("a photo takes its week's average, not the frozen reading", photoWeight(first, weeks)?.kg === 90 && photoWeight(first, weeks)?.source === "week");
  check("a photo in a week with no weigh-ins keeps its frozen number", photoWeight({ id: "c", date: "2026-09-20", kg: 89 }, weeks)?.source === "frozen");
  check("a photo with no weight at all says so", photoWeight({ id: "d", date: "2026-09-20" }, weeks) === null);
  const c = comparePhotos(first, later, w);
  check("before vs now: the weekly averages' difference", c.deltaKg === -1.9, String(c.deltaKg));
  check("and the weeks between", c.weeks === 3 && c.days === 23, `${c.weeks}/${c.days}`);
  check("and the pace per week", c.perWeek === -0.6, String(c.perWeek));
  check("no photo yet asks for the first", photoDue([], "2026-10-01").state === "first");
  check("a week after the last photo it is due", photoDue([later], "2026-10-08").state === "due");
  const soon = photoDue([later], "2026-10-04");
  check("before that, it says when", soon.state === "soon" && soon.inDays === 4, JSON.stringify(soon));
  check("weeks with a photo are counted once each", photoWeeks([first, { ...first, id: "x" }, later]) === 2);
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
