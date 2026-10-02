import { nextSteps, partOfDay, waterPace, type NextInput } from "./nextstep";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const base: NextInput = {
  hour: 9,
  habits: [
    { id: "h1", title: "מים בבוקר", slot: "morning", done: false },
    { id: "h2", title: "הליכה", slot: "evening", done: false },
  ],
  water: { ml: 0, goalMl: 2500, cupMl: 250 },
  meals: { count: 0, kcal: 0, targetKcal: 2000 },
  daysSinceWeighIn: 2,
  workout: { active: false, planned: true, doneToday: false, doneThisWeek: 3, perWeek: 3 },
  recapDoneToday: false,
};
const kinds = (i: Partial<NextInput>) => nextSteps({ ...base, ...i }, 10).map((s) => s.kind);

check("parts of the day", partOfDay(7) === "morning" && partOfDay(13) === "noon" && partOfDay(19) === "evening");
check("water pace is zero at waking and the whole goal at bedtime", waterPace(2500, 7) === 0 && waterPace(2500, 22) === 2500 && waterPace(2500, 14.5) === 1250);

check("morning: the morning habit leads", nextSteps(base)[0]!.kind === "habit" && nextSteps(base)[0]!.habitId === "h1");
check("the evening habit is not due in the morning", !nextSteps(base).some((s) => s.habitId === "h2"));
check("evening: the evening habit is due", nextSteps({ ...base, hour: 19, habits: [base.habits[1]!] }).some((s) => s.habitId === "h2"));
check("a morning habit left undone still shows in the evening", nextSteps({ ...base, hour: 19, habits: [base.habits[0]!] }).some((s) => s.habitId === "h1"));
check("a habit with no time of day shows in the evening", nextSteps({ ...base, hour: 18, habits: [{ id: "x", title: "x", done: false }] }).some((s) => s.habitId === "x"));
check("a done habit never shows", !kinds({ habits: [{ ...base.habits[0]!, done: true }] }).includes("habit"));

check("a running workout comes first", kinds({ workout: { ...base.workout, active: true } })[0] === "resumeWorkout");

check("water behind the pace by more than a cup shows", kinds({ hour: 15 }).includes("water"));
const water = nextSteps({ ...base, hour: 15, water: { ml: 0, goalMl: 2500, cupMl: 250 } }).find((s) => s.kind === "water");
check("and says how many cups to catch up", water?.amount === Math.ceil(waterPace(2500, 15) / 250), String(water?.amount));
check("on pace: no water nudge", !kinds({ hour: 15, water: { ml: 1500, goalMl: 2500, cupMl: 250 } }).includes("water"));
check("no water nudge at night", !kinds({ hour: 23 }).includes("water"));

check("no breakfast logged by 11: log it", nextSteps({ ...base, hour: 11 }).some((s) => s.kind === "logMeal" && s.meal === "breakfast"));
check("breakfast logged, it is 3pm, lunch is due", nextSteps({ ...base, hour: 15, meals: { count: 1, kcal: 400, targetKcal: 2000 } }).some((s) => s.kind === "logMeal" && s.meal === "lunch"));
check("nothing about meals at 8am", !kinds({ hour: 8 }).includes("logMeal"));
check("evening and far under the day's food: eat a real dinner", kinds({ hour: 19, meals: { count: 2, kcal: 700, targetKcal: 2000 } }).includes("eatMore"));
check("not when the day is on target", !kinds({ hour: 19, meals: { count: 2, kcal: 1500, targetKcal: 2000 } }).includes("eatMore"));

check("a week since the last weigh-in, in the morning: weigh in", kinds({ daysSinceWeighIn: 7 }).includes("weighIn"));
check("never weighed: weigh in", kinds({ daysSinceWeighIn: null }).includes("weighIn"));
check("weighed yesterday: no", !kinds({ daysSinceWeighIn: 1 }).includes("weighIn"));
check("8 days, afternoon: wait for the morning", !kinds({ daysSinceWeighIn: 8, hour: 15 }).includes("weighIn"));
check("10 days: any time", kinds({ daysSinceWeighIn: 10, hour: 15, habits: [], water: { ml: 9999, goalMl: 2500, cupMl: 250 }, meals: { count: 3, kcal: 1900, targetKcal: 2000 } }).includes("weighIn"));

check("the week needs sessions: today's workout", kinds({ hour: 17, workout: { ...base.workout, doneThisWeek: 1 } }).includes("workout"));
check("the week's sessions are done: no workout nudge", !kinds({ hour: 17 }).includes("workout"));
check("already trained today: no", !kinds({ hour: 17, workout: { ...base.workout, doneThisWeek: 1, doneToday: true } }).includes("workout"));
check("no plan: no workout nudge", !kinds({ hour: 17, workout: { ...base.workout, planned: false, doneThisWeek: 0 } }).includes("workout"));

check("9pm and no recap: the recap leads", nextSteps({ ...base, hour: 21, habits: [] })[0]!.kind === "recap");
check("recap done: gone", !kinds({ hour: 21, recapDoneToday: true }).includes("recap"));
check("no recap nudge in the afternoon", !kinds({ hour: 15 }).includes("recap"));

const quiet: Partial<NextInput> = { hour: 9.5, habits: [], water: { ml: 400, goalMl: 2500, cupMl: 250 }, meals: { count: 1, kcal: 400, targetKcal: 2000 } };
check("nothing pending: all done", kinds(quiet).join() === "allDone", kinds(quiet).join());
check("never more than three", nextSteps({ ...base, hour: 21, daysSinceWeighIn: null, workout: { ...base.workout, doneThisWeek: 0, active: false } }).length <= 3);
check("the same moment, the same answer", JSON.stringify(nextSteps(base)) === JSON.stringify(nextSteps(base)));
const hours = new Set([7, 10, 13, 16, 19, 22].map((h) => kinds({ hour: h, habits: base.habits }).join()));
check("the card changes through the day", hours.size >= 4, [...hours].join(" / "));

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
