import { buildPlan, EQUIP_SETS } from "./plan";
import { EXERCISES } from "./exercises";
import { bestLift, isStorableKg, lastLift } from "./lifts";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

for (const days of [2, 3, 4, 5, 6] as const) {
  const plan = buildPlan("recomp", days);
  check(`${days} days → ${days} sessions`, plan.sessions.length === days, String(plan.sessions.length));
  check(`${days} days: every session has exercises`, plan.sessions.every((s) => s.exercises.length >= 4));
  check(`${days} days: no exercise repeats within a session`,
    plan.sessions.every((s) => new Set(s.exercises.map((e) => e.id)).size === s.exercises.length));
}

// goal changes volume and how many moves per day
{
  const bulk = buildPlan("bulk", 4);
  const cut = buildPlan("cut", 4);
  check("bulk prescribes 4 sets", bulk.sets === 4);
  check("cut prescribes higher reps", cut.reps.includes("15"));
  check("bulk packs more exercises per day", bulk.sessions[0].exercises.length > cut.sessions[0].exercises.length || bulk.sessions[0].exercises.length === 6);
}

// session length drives how many exercises a day holds
{
  const short = buildPlan("recomp", 3, 30);
  const long = buildPlan("recomp", 3, 90);
  check("30-min sessions hold 4 exercises", short.sessions.every((s) => s.exercises.length === 4),
    String(short.sessions[0].exercises.length));
  check("90-min sessions hold 8 exercises", long.sessions.every((s) => s.exercises.length === 8),
    String(long.sessions[0].exercises.length));
  check("longer sessions hold more than shorter ones",
    long.sessions[0].exercises.length > short.sessions[0].exercises.length);
  check("the chosen minutes are carried on the plan", long.minutes === 90);
  check("even a long session never repeats an exercise",
    long.sessions.every((s) => new Set(s.exercises.map((e) => e.id)).size === s.exercises.length));
}

// equipment filters which moves a plan uses
{
  const bw = buildPlan("recomp", 3, 45, "bodyweight");
  const all = bw.sessions.flatMap((s) => s.exercises);
  check("a bodyweight plan uses only bodyweight moves",
    all.every((e) => e.equipment === "bodyweight"), all.map((e) => e.equipment).join());
  check("a bodyweight plan still fills every day",
    bw.sessions.every((s) => s.exercises.length >= 3), bw.sessions.map((s) => s.exercises.length).join());
  check("the chosen equipment is carried on the plan", bw.equipment === "bodyweight");

  const home = buildPlan("recomp", 3, 45, "home");
  const allowedHome = new Set(EQUIP_SETS.home);
  check("a home plan avoids barbell/machine/cable",
    home.sessions.flatMap((s) => s.exercises).every((e) => allowedHome.has(e.equipment)));

  const gym = buildPlan("recomp", 3, 45, "gym");
  const usesBarbell = gym.sessions.flatMap((s) => s.exercises).some((e) => e.equipment === "barbell");
  check("a full-gym plan can use a barbell", usesBarbell);
}

// a repeated split day is not identical
{
  const plan = buildPlan("recomp", 6); // push,pull,legs,push,pull,legs
  const push1 = plan.sessions[0].exercises.map((e) => e.id).join();
  const push2 = plan.sessions[3].exercises.map((e) => e.id).join();
  check("a repeated split day differs from the first", push1 !== push2, `${push1} vs ${push2}`);
}

// every exercise carries a demo search + bilingual how-to
{
  check("every exercise has how-to in both languages",
    EXERCISES.every((e) => e.howHe.length > 0 && e.howEn.length > 0));
  check("every exercise has a youtube search term", EXERCISES.every((e) => e.yt.length > 3));
}

// lift history: last and best drive progressive overload
{
  const series = [
    { date: "2026-02-01", kg: 60 },
    { date: "2026-01-01", kg: 50 },
    { date: "2026-03-01", kg: 57.5 },
  ];
  check("lastLift is the most recent date, not the biggest", lastLift(series)?.kg === 57.5,
    String(lastLift(series)?.kg));
  check("bestLift is the heaviest ever", bestLift(series) === 60, String(bestLift(series)));
  check("an empty history has no last lift", lastLift([]) === null);
  check("an empty history has a zero best", bestLift([]) === 0);
  check("a normal working weight is storable", isStorableKg(80));
  check("zero and absurd weights are rejected", !isStorableKg(0) && !isStorableKg(9000));
  check("NaN is rejected", !isStorableKg(Number.NaN));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
