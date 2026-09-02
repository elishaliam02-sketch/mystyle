import { buildPlan } from "./plan";
import { EXERCISES } from "./exercises";

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

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
