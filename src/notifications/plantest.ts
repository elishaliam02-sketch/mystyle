/**
 * Tests for what the app decides to remind someone about. The judgement being
 * checked is mostly restraint: a person who has never used a feature must not
 * be nudged about it, and nobody gets a phone full of notifications.
 */
import { MAX_DAILY, planReminders, trainingWeekdays, type ReminderCopy } from "./plan";
import { EMPTY_STATE, type AppState } from "@/store/types";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

const copy: ReminderCopy = {
  slotTitle: "{count} things", recapTitle: "recap", recapBody: "how was it",
  trainTitle: "train", trainBody: "train body",
  waterTitle: "water", waterBody: "water body",
  foodTitle: "food", foodBody: "food body",
  stepsTitle: "steps", stepsBody: "steps body",
  weighTitle: "weigh", weighBody: "weigh body",
  measureTitle: "measure", measureBody: "measure body",
};

const base: AppState = { ...EMPTY_STATE, habits: [], weighIns: [] };
const ids = (s: AppState) => planReminders(s, copy).map((r) => r.id);
const habit = (id: string, slot?: "morning" | "noon" | "evening") => ({
  id, title: id, slot, createdAt: "2026-01-01", archived: false, updatedAt: "2026-01-01T00:00:00.000Z",
});

// --- nothing used, nothing nagged
{
  const list = ids(base);
  check("a brand-new install gets only the recap", list.join() === "recap", list.join());
  check("no water reminder without a glass logged", !ids(base).includes("water"));
  check("no food reminder without a meal logged", !ids(base).includes("food"));
  check("no steps reminder without a step logged", !ids(base).includes("steps"));
  check("no training reminder without a plan", !ids(base).includes("train"));
  check("no measuring reminder without a measurement", !ids(base).includes("measure"));
}

// --- each feature switches its own reminder on, and only its own
{
  check("logging water earns a water reminder",
    ids({ ...base, water: { "2026-03-01": 4 } }).includes("water"));
  check("logging a meal earns a food reminder",
    ids({ ...base, intake: { "2026-03-01": [] as never[] } as AppState["intake"] }).includes("food"));
  check("logging steps earns a steps reminder",
    ids({ ...base, steps: { "2026-03-01": 9000 } }).includes("steps"));
  check("having a plan earns a training reminder on each training day", (() => {
    const list = ids({ ...base, training: { goal: "cut", days: 3, log: {}, custom: [] } });
    return list.filter((id) => id.startsWith("train-")).length === 3;
  })());
  check("and none on the rest days", (() => {
    const list = planReminders({ ...base, training: { goal: "cut", days: 3, log: {}, custom: [] } }, copy);
    const trains = list.filter((r) => r.id.startsWith("train-"));
    // Every one is pinned to a weekday; a daily "go and train" on a rest day
    // is what teaches people to swipe the notification away unread.
    return trains.every((r) => typeof r.weekday === "number");
  })());
  check("a measurement earns the tape reminder",
    ids({ ...base, measurements: { waist: [{ date: "2026-03-01", cm: 90 }] } }).includes("measure"));
  check("a weigh-in earns the weekly weigh reminder",
    ids({ ...base, weighIns: [{ date: "2026-03-01", kg: 80, updatedAt: "x" }] }).includes("weigh"));
  check("a goal weight alone earns it too",
    ids({ ...base, profile: { ...base.profile, goalKg: 75 } }).includes("weigh"));
  check("water does not drag in the others", (() => {
    const list = ids({ ...base, water: { "2026-03-01": 4 } });
    return !list.includes("food") && !list.includes("steps") && !list.includes("train");
  })());
}

// --- habits are grouped, not one each
{
  const many = { ...base, habits: [habit("a", "morning"), habit("b", "morning"), habit("c", "evening")] };
  const list = planReminders(many, copy).filter((r) => r.id.startsWith("habits-"));
  check("two morning habits share one reminder", list.length === 2, String(list.length));
  check("the group says how many", list[0]!.title === "2 things", list[0]!.title);
  check("both habits are named in the body", list[0]!.body === "a · b", list[0]!.body);
  check("a habit with no slot still gets a time",
    planReminders({ ...base, habits: [habit("x")] }, copy).some((r) => r.id === "habits-9"));
  check("an archived habit is not reminded about",
    planReminders({ ...base, habits: [{ ...habit("x"), archived: true }] }, copy)
      .every((r) => !r.id.startsWith("habits-")));
}

// --- the day never gets crowded
{
  const everything: AppState = {
    ...base,
    habits: [habit("a", "morning"), habit("b", "noon"), habit("c", "evening")],
    water: { "2026-03-01": 4 },
    intake: { "2026-03-01": [] as never[] } as AppState["intake"],
    steps: { "2026-03-01": 9000 },
    training: { goal: "cut", days: 3, log: {}, custom: [] },
    measurements: { waist: [{ date: "2026-03-01", cm: 90 }] },
    weighIns: [{ date: "2026-03-01", kg: 80, updatedAt: "x" }],
  };
  const all = planReminders(everything, copy);
  const daily = all.filter((r) => r.weekday === undefined);
  check("a heavy user is still capped", daily.length <= MAX_DAILY, String(daily.length));
  check("the recap survives the cap", daily.some((r) => r.id === "recap"));
  check("the weekly ones are not counted against the daily cap",
    all.filter((r) => r.weekday !== undefined).length === 2 + trainingWeekdays(3).length,
    String(all.filter((r) => r.weekday !== undefined).length));
  check("daily reminders are in the order they fire", (() => {
    for (let i = 1; i < daily.length; i++) {
      const a = daily[i - 1]!, b = daily[i]!;
      if (a.hour * 60 + a.minute > b.hour * 60 + b.minute) return false;
    }
    return true;
  })(), daily.map((r) => `${r.id}@${r.hour}:${r.minute}`).join(" "));
  check("no two reminders fire at the same minute",
    new Set(daily.map((r) => `${r.hour}:${r.minute}`)).size === daily.length,
    daily.map((r) => `${r.id}@${r.hour}:${r.minute}`).join(" "));
  check("nothing fires in the middle of the night",
    all.every((r) => r.hour >= 7 && r.hour <= 22));
  check("every reminder says something",
    all.every((r) => r.title.trim().length > 0 && r.body.trim().length > 0));
  check("every id is unique", new Set(all.map((r) => r.id)).size === all.length);
  check("the same state always plans the same schedule",
    JSON.stringify(planReminders(everything, copy)) === JSON.stringify(planReminders(everything, copy)));
  check("weekly reminders name a real weekday",
    all.filter((r) => r.weekday !== undefined).every((r) => r.weekday! >= 1 && r.weekday! <= 7));
}

// --- which days a plan's sessions land on
{
  for (let days = 1; days <= 7; days++) {
    const week = trainingWeekdays(days);
    check(`a ${days}-day plan yields ${days} training days`, week.length === days, week.join(","));
    check(`a ${days}-day plan names real weekdays`, week.every((d) => d >= 1 && d <= 7), week.join(","));
    check(`a ${days}-day plan never repeats a day`, new Set(week).size === week.length, week.join(","));
    check(`a ${days}-day plan is in order`, week.every((d, i) => i === 0 || d > week[i - 1]!), week.join(","));
  }
  check("three days a week are spread, not stacked", (() => {
    const week = trainingWeekdays(3);
    // Gaps of at least one day between sessions is the whole point of
    // spreading them: three in a row is not a three-day-a-week plan.
    return week.every((d, i) => i === 0 || d - week[i - 1]! >= 2);
  })(), trainingWeekdays(3).join(","));
  check("a nonsense day count is still handled",
    trainingWeekdays(0).length >= 1 && trainingWeekdays(99).length === 7);
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
