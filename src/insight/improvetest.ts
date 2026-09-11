import { improvements, MIN_DAYS, SHORTFALL, WINDOW_DAYS } from "./improve";
import { EMPTY_STATE, type AppState, type Habit } from "@/store/types";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const TODAY = "2026-09-11";
const STAMP = "2026-09-01T00:00:00.000Z";
const day = (n: number) => {
  const d = new Date(Date.UTC(2026, 8, 11) - n * 86_400_000);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const week = Array.from({ length: WINDOW_DAYS }, (_, i) => day(i));

const habit = (id: string, createdAt = "2026-08-01"): Habit => ({
  id,
  title: id,
  createdAt,
  archived: false,
  updatedAt: STAMP,
});
const tick = (habitId: string, date: string, done = true) => ({ habitId, date, done, updatedAt: STAMP });
const stateWith = (patch: Partial<AppState>): AppState => ({ ...EMPTY_STATE, ...patch });
const area = (s: AppState, name: string) => improvements(s, TODAY).all.find((r) => r.area === name);

// --- nothing to judge
{
  const r = improvements(EMPTY_STATE, TODAY);
  check("an empty app has nothing to say", r.all.length === 0 && r.worst.length === 0);
  check("and nothing is called best either", r.best === null);
}

// --- a pillar nobody opted into is never judged
{
  const s = stateWith({ habits: [habit("h1")], completions: [tick("h1", day(0))] });
  const r = improvements(s, TODAY);
  check("no water goal, no water verdict", !r.all.some((x) => x.area === "water"));
  check("no plan, no training verdict", !r.all.some((x) => x.area === "workout"));
  check("no step goal, no step verdict", !r.all.some((x) => x.area === "steps"));
}

// --- habits: only days the habit existed count
{
  // Created three days ago, ticked every day since — that is 100%, not 3/7.
  const created = day(2);
  const s = stateWith({
    habits: [habit("h1", created)],
    completions: [tick("h1", day(0)), tick("h1", day(1)), tick("h1", day(2))],
  });
  const habits = area(s, "habits");
  check("a young habit is judged on the days it existed", habits?.fraction === 1,
    JSON.stringify(habits));
  check("and is not in the list to fix", improvements(s, TODAY).worst.length === 0);
}

// --- habits: real shortfall is caught and ranked
{
  const s = stateWith({
    habits: [habit("h1"), habit("h2")],
    completions: [tick("h1", day(0)), tick("h1", day(1))],
  });
  const habits = area(s, "habits");
  check("a half-empty board reads as a shortfall", (habits?.fraction ?? 1) < SHORTFALL,
    String(habits?.fraction));
  check("it is named as something to fix", improvements(s, TODAY).worst[0]?.area === "habits");
  check("the sentence has real numbers behind it",
    habits?.actual === 2 && habits?.target === 14, JSON.stringify(habits));
}

// --- an unticked completion is not a tick
{
  const s = stateWith({
    habits: [habit("h1")],
    completions: week.map((d) => tick("h1", d, false)),
  });
  check("unticked days count as missed", (area(s, "habits")?.fraction ?? 1) === 0);
}

// --- not enough data is not a verdict
{
  const s = stateWith({ waterGoal: 8, water: { [day(0)]: 2, [day(1)]: 3 } });
  check(`fewer than ${MIN_DAYS} days is not judged`, !area(s, "water"), JSON.stringify(area(s, "water")));
  const enough = stateWith({ waterGoal: 8, water: { [day(0)]: 2, [day(1)]: 3, [day(2)]: 1 } });
  check("three days is enough to judge", !!area(enough, "water"));
}

// --- water and steps are averaged against the daily goal
{
  const s = stateWith({
    waterGoal: 8,
    water: Object.fromEntries(week.map((d) => [d, 4])),
    stepGoal: 10000,
    steps: Object.fromEntries(week.map((d) => [d, 9000])),
  });
  const water = area(s, "water");
  const steps = area(s, "steps");
  check("half the water goal reads as half", Math.abs((water?.fraction ?? 0) - 0.5) < 0.01,
    String(water?.fraction));
  check("nine thousand of ten thousand steps is not a problem",
    (steps?.fraction ?? 0) >= SHORTFALL, String(steps?.fraction));
  check("the worse of the two is ranked first",
    improvements(s, TODAY).worst[0]?.area === "water");
}

// --- older data outside the window is ignored
{
  const s = stateWith({
    waterGoal: 8,
    water: { ...Object.fromEntries(week.map((d) => [d, 8])), "2026-01-01": 0 },
  });
  check("last January does not drag this week down", (area(s, "water")?.fraction ?? 0) === 1);
}

// --- what is going well is returned too
{
  const s = stateWith({
    habits: [habit("h1")],
    completions: week.map((d) => tick("h1", d)),
    waterGoal: 8,
    water: Object.fromEntries(week.map((d) => [d, 2])),
  });
  const r = improvements(s, TODAY);
  check("the pillar that is working is named", r.best?.area === "habits", JSON.stringify(r.best));
  check("the one that is not is named separately", r.worst[0]?.area === "water");
  check("a pillar is never in both lists",
    !r.worst.some((w) => w.area === r.best?.area));
}

// --- nothing good, nothing claimed
{
  const s = stateWith({
    habits: [habit("h1")],
    completions: [],
    waterGoal: 8,
    water: Object.fromEntries(week.map((d) => [d, 1])),
  });
  check("a bad week does not invent a success", improvements(s, TODAY).best === null);
}

// --- at most three things to fix, so it reads as a plan not a verdict
{
  const s = stateWith({
    habits: [habit("h1"), habit("h2")],
    completions: [],
    waterGoal: 8,
    water: Object.fromEntries(week.map((d) => [d, 1])),
    stepGoal: 10000,
    steps: Object.fromEntries(week.map((d) => [d, 1000])),
    training: { goal: "cut", days: 4, log: {}, custom: [] },
    intake: { "2026-01-01": [{ id: "x", label: "x", kcal: 1, protein: 1 }] },
    weighIns: [{ date: "2026-01-01", kg: 80, updatedAt: STAMP }],
    checkIns: [{ date: "2026-01-01", mood: "ok", note: "", updatedAt: STAMP }],
  });
  const r = improvements(s, TODAY);
  check("never more than three things to fix", r.worst.length <= 3, String(r.worst.length));
  check("but everything measured is still available", r.all.length > 3, String(r.all.length));
  check("the list is ordered worst first",
    r.worst.every((x, i) => i === 0 || (1 - x.fraction) * x.weight <= (1 - r.worst[i - 1].fraction) * r.worst[i - 1].weight));
}

// --- fractions stay inside 0..1 whatever the data says
{
  const s = stateWith({
    waterGoal: 8,
    water: Object.fromEntries(week.map((d) => [d, 40])),
    stepGoal: 100,
    steps: Object.fromEntries(week.map((d) => [d, 90000])),
  });
  check("beating a goal does not overflow",
    improvements(s, TODAY).all.every((r) => r.fraction >= 0 && r.fraction <= 1),
    JSON.stringify(improvements(s, TODAY).all.map((r) => r.fraction)));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
