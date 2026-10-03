/**
 * Tests for what the app decides to remind someone about. The judgement being
 * checked is mostly restraint: a person who has never used a feature must not
 * be nudged about it, and nobody gets a phone full of notifications.
 */
import {
  datedReminders, diffSchedule, HORIZON_DAYS, ID_PREFIX, identifierOf, localKey, MAX_DAILY, MAX_PENDING,
  planReminders, routeOf, trainingWeekdays, whenLabel, type ReminderCopy,
} from "./plan";
import { EMPTY_STATE, type AppState } from "@/store/types";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

const copy: ReminderCopy = {
  slotTitle: "{count} things", slotOneTitle: "one thing", recapTitle: "recap", recapBody: "how was it",
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
  check("a single habit is not called \"1 things\"",
    planReminders({ ...base, habits: [habit("x", "noon")] }, copy)[0]!.title === "one thing");
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


// --- the dated schedule: today's list knows what is already done
{
  // Saturday 3 Oct 2026, 10:00 local
  const now = new Date(2026, 9, 3, 10, 0);
  const date = localKey(now);
  const user: AppState = {
    ...base,
    habits: [habit("read", "evening"), habit("walk", "evening"), habit("stretch", "morning")],
    waterMl: { "2026-09-30": 1000 },
    waterGoalMl: 2000,
    intake: { "2026-09-30": [] as never[] } as AppState["intake"],
    steps: { "2026-09-30": 5000 },
    training: { goal: "cut", days: 7, log: {}, custom: [] },
  };
  const todays = (s: AppState) => datedReminders(s, copy, now).filter((r) => r.id.endsWith(`@${date}`));
  const todayIds = (s: AppState) => todays(s).map((r) => r.id.split("@")[0]);

  check("a reminder whose time already passed today is not written",
    !todayIds(user).includes("habits-8"), todayIds(user).join());
  check("tomorrow's morning one is",
    datedReminders(user, copy, now).some((r) => r.id === "habits-8@2026-10-04"));
  check("today's water is reminded while the bottle is not full", todayIds(user).includes("water"));
  check("and not once it is", !todayIds({ ...user, waterMl: { ...user.waterMl, [date]: 2000 } }).includes("water"));
  check("water still reminds tomorrow after a full today",
    datedReminders({ ...user, waterMl: { [date]: 2000 } }, copy, now).some((r) => r.id === "water@2026-10-04"));
  check("no food reminder once something is logged today",
    !todayIds({ ...user, intake: { [date]: [{ id: "1", label: "x", kcal: 100, protein: 5 }] } }).includes("food"));
  check("the food reminder stays on an empty diary", todayIds(user).includes("food"));
  check("steps reached means no steps reminder",
    !todayIds({ ...user, steps: { [date]: 9000 } }).includes("steps"));
  check("a personal step goal is the bar",
    todayIds({ ...user, steps: { [date]: 9000 }, stepGoal: 12000 }).includes("steps"));
  check("a recap written means no recap reminder",
    !todayIds({ ...user, checkIns: [{ date, mood: "good", note: "", updatedAt: "x" }] }).includes("recap"));
  check("a workout logged means no training reminder today",
    !todayIds({ ...user, training: { ...user.training!, log: { [date]: ["squat"] } } }).some((id) => id!.startsWith("train-")));
  check("so does a set ticked in the set log",
    !todayIds({ ...user, training: { ...user.training!, setLog: { [date]: { squat: [{ kg: 50, reps: 8, done: true }] } } } })
      .some((id) => id!.startsWith("train-")));
  check("an unticked set does not count as training",
    todayIds({ ...user, training: { ...user.training!, setLog: { [date]: { squat: [{ kg: 50, reps: 8, done: false }] } } } })
      .some((id) => id!.startsWith("train-")));

  const evening = todays(user).find((r) => r.id.startsWith("habits-19"))!;
  check("the evening group names both habits at first", evening.title === "2 things" && evening.body === "read · walk",
    `${evening.title} / ${evening.body}`);
  const oneDone = { ...user, completions: [{ habitId: "read", date, done: true, updatedAt: "x" }] };
  const after = todays(oneDone).find((r) => r.id.startsWith("habits-19"))!;
  check("ticking one leaves only the other in today's reminder", after.title === "one thing" && after.body === "walk",
    `${after.title} / ${after.body}`);
  check("an unticked completion still counts as not done",
    todays({ ...user, completions: [{ habitId: "read", date, done: false, updatedAt: "x" }] })
      .find((r) => r.id.startsWith("habits-19"))!.body === "read · walk");
  const bothDone = { ...user, completions: ["read", "walk"].map((habitId) => ({ habitId, date, done: true, updatedAt: "x" })) };
  check("both ticked means no evening reminder today", !todayIds(bothDone).includes("habits-19"));
  check("but tomorrow's still names both",
    datedReminders(bothDone, copy, now).find((r) => r.id === "habits-19@2026-10-04")?.body === "read · walk");
  check("yesterday's ticks do not silence today",
    todayIds({ ...user, completions: [{ habitId: "read", date: "2026-10-02", done: true, updatedAt: "x" }] }).includes("habits-19"));

  const all = datedReminders(user, copy, now);
  check("never more pending than the phone keeps", all.length <= MAX_PENDING, String(all.length));
  check("in the order they fire", all.every((r, i) => i === 0 || r.at >= all[i - 1]!.at));
  check("nothing in the past", all.every((r) => r.at > now));
  check("ids are unique", new Set(all.map((r) => r.id)).size === all.length);
  check("a light user is covered for the whole horizon", (() => {
    const light = datedReminders(base, copy, now);
    return light.length === HORIZON_DAYS - 0 && light.every((r) => r.id.startsWith("recap@"));
  })(), String(datedReminders(base, copy, now).length));
  check("weekly reminders land on their weekday", (() => {
    const weigh = datedReminders({ ...base, profile: { ...base.profile, goalKg: 70 } }, copy, now)
      .filter((r) => r.id.startsWith("weigh@"));
    return weigh.length >= 2 && weigh.every((r) => r.at.getDay() === 0 && r.at.getHours() === 8);
  })());
  check("a date is local, not UTC", localKey(new Date(2026, 9, 3, 23, 30)) === "2026-10-03");
  check("the month rolls over", datedReminders(base, copy, new Date(2026, 9, 31, 22, 0))[0]!.id === "recap@2026-11-01");
}

// --- writing the schedule to the phone touches only the difference
{
  const now = new Date(2026, 9, 3, 10, 0);
  const want = datedReminders({ ...base, waterMl: { "2026-09-30": 1 } }, copy, now);
  const pending = want.map(identifierOf);
  const same = diffSchedule(pending, want);
  check("an unchanged schedule changes nothing", same.cancel.length === 0 && same.add.length === 0);
  const fresh = diffSchedule([], want);
  check("an empty phone gets everything", fresh.add.length === want.length && fresh.cancel.length === 0);
  const old = diffSchedule(["5f2c1e9a-old-daily-uuid", ...pending], want);
  check("repeating reminders from an older build are cleared", old.cancel.join() === "5f2c1e9a-old-daily-uuid");
  const drunk = want.filter((r) => r.id !== "water@2026-10-03");
  const tick = diffSchedule(pending, drunk);
  check("finishing the water cancels exactly one", tick.cancel.length === 1 && tick.add.length === 0,
    `${tick.cancel.length}/${tick.add.length}`);
  const renamed = want.map((r) => (r.id === "recap@2026-10-04" ? { ...r, body: "new words" } : r));
  const changed = diffSchedule(pending, renamed);
  check("changed words rewrite that one reminder", changed.cancel.length === 1 && changed.add.length === 1);
  check("every identifier is ours", pending.every((id) => id.startsWith(ID_PREFIX)));
}

// --- tapping one opens what it is about
{
  check("water opens the water screen", routeOf("water@2026-10-03") === "/water");
  check("the recap opens the recap", routeOf("recap@2026-10-03") === "/checkin");
  check("training opens the workout", routeOf("train-3@2026-10-03") === "/workout");
  check("habits open home", routeOf("habits-19@2026-10-03") === "/");
  check("food opens the kitchen", routeOf("food@2026-10-03") === "/kitchen");
  check("anything unknown opens home", routeOf("mystery@2026-10-03") === "/");
  const names = { today: "today", tomorrow: "tomorrow", weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
  const now = new Date(2026, 9, 3, 10, 0);
  check("later today reads as today", whenLabel(new Date(2026, 9, 3, 15, 0), now, names) === "today 15:00");
  check("tomorrow reads as tomorrow", whenLabel(new Date(2026, 9, 4, 8, 30), now, names) === "tomorrow 08:30");
  check("further reads as the weekday", whenLabel(new Date(2026, 9, 6, 9, 0), now, names) === "Tue 09:00");
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
