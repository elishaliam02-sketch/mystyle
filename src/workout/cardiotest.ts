/**
 * Tests for the cardio prescription. The point is that it truly changes with
 * the goal and with the person, and never prescribes a move the library does
 * not have.
 */
import { cardioPlan } from "./cardio";
import { EXERCISES } from "./exercises";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

const cardioIds = new Set(EXERCISES.filter((e) => e.muscle === "cardio").map((e) => e.id));
const summary = (g: "cut" | "recomp" | "maintain" | "bulk", seed = "") =>
  cardioPlan(g, seed).sessions.map((s) => `${s.exerciseId}:${s.style}:${s.minutes}`).join(",");

// --- goal shapes the volume
{
  check("cutting prescribes the most cardio", cardioPlan("cut").perWeek > cardioPlan("bulk").perWeek);
  check("bulking prescribes the least", cardioPlan("bulk").perWeek <= cardioPlan("recomp").perWeek);
  check("a cut includes intervals", cardioPlan("cut").sessions.some((s) => s.style === "interval"));
  check("a bulk is steady only", cardioPlan("bulk").sessions.every((s) => s.style === "steady"));
  check("every goal prescribes at least one session",
    (["cut", "recomp", "maintain", "bulk"] as const).every((g) => cardioPlan(g).sessions.length >= 1));
  check("the session count is sane", (["cut", "recomp", "maintain", "bulk"] as const).every((g) => {
    const p = cardioPlan(g);
    return p.sessions.length >= 1 && p.sessions.length <= 6;
  }));
}

// --- it is the person's plan, not a leaflet
{
  check("two people on the same goal get different cardio", summary("cut", "userA") !== summary("cut", "userB"));
  check("the same person gets the same cardio twice", summary("cut", "userA") === summary("cut", "userA"));
  check("changing goal changes the cardio", summary("cut", "userA") !== summary("bulk", "userA"));
  check("a week of seeds gives real variety", (() => {
    const seen = new Set<string>();
    for (let d = 0; d < 7; d++) seen.add(summary("recomp", `s|${d}`));
    return seen.size >= 3;
  })());
}

// --- it never invents an exercise, and the numbers are real
{
  check("every prescribed move is a real cardio exercise",
    (["cut", "recomp", "maintain", "bulk"] as const).every((g) =>
      cardioPlan(g, "x").sessions.every((s) => cardioIds.has(s.exerciseId))));
  check("minutes are within the goal's band",
    (["cut", "recomp", "maintain", "bulk"] as const).every((g) =>
      cardioPlan(g, "x").sessions.every((s) => s.minutes >= 15 && s.minutes <= 40)));
  check("every session names the move in both languages",
    cardioPlan("cut", "x").sessions.every((s) => s.he.length > 1 && s.en.length > 1));
  check("a plan carries a why in both languages", (() => {
    const p = cardioPlan("cut");
    return p.he.length > 10 && p.en.length > 10;
  })());
  check("a plan does not repeat the same machine when it can avoid it", (() => {
    const p = cardioPlan("cut", "userA");
    const ids = p.sessions.map((s) => s.exerciseId);
    return new Set(ids).size === ids.length;
  })());
}

// Beginners get steady cardio only, at the short end; no level changes nothing.
{
  for (const g of ["cut", "recomp", "maintain", "bulk"] as const) {
    const beg = cardioPlan(g, "s", "beginner");
    check(`a beginner's ${g} cardio has no intervals`, beg.sessions.every((x) => x.style === "steady"));
    check(`…and as many sessions as anyone's (${g})`, beg.sessions.length === cardioPlan(g, "s").sessions.length);
    check(`a plan without a level is unchanged (${g})`, JSON.stringify(cardioPlan(g, "s")) === JSON.stringify(cardioPlan(g, "s", undefined)));
  }
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
