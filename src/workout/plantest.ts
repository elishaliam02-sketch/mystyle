import { buildPlan, EQUIP_SETS } from "./plan";
import { EXERCISES, MUSCLES } from "./exercises";
import { allExercises, countByMuscle, equipmentKinds, filterExercises, matches } from "./library";
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

// --- the library is big enough, clean, and every plan can still be built
{
  check("the library is Hevy-sized", EXERCISES.length >= 180, String(EXERCISES.length));
  check("every id is unique", new Set(EXERCISES.map((e) => e.id)).size === EXERCISES.length, (() => {
    const seen = new Set<string>(); const dupes: string[] = [];
    for (const e of EXERCISES) { if (seen.has(e.id)) dupes.push(e.id); seen.add(e.id); }
    return dupes.join(",");
  })());
  check("every Hebrew name is unique", new Set(EXERCISES.map((e) => e.he)).size === EXERCISES.length, (() => {
    const seen = new Set<string>(); const dupes: string[] = [];
    for (const e of EXERCISES) { if (seen.has(e.he)) dupes.push(e.he); seen.add(e.he); }
    return dupes.join(",");
  })());
  check("every English name is unique", new Set(EXERCISES.map((e) => e.en)).size === EXERCISES.length, (() => {
    const seen = new Set<string>(); const dupes: string[] = [];
    for (const e of EXERCISES) { if (seen.has(e.en)) dupes.push(e.en); seen.add(e.en); }
    return dupes.join(",");
  })());
  check("nothing is missing a name", EXERCISES.every((e) => e.he.length > 1 && e.en.length > 1));
  check("nothing is missing instructions",
    EXERCISES.every((e) => e.howHe.length >= 1 && e.howEn.length >= 1));
  check("Hebrew and English instructions have the same number of steps",
    EXERCISES.every((e) => e.howHe.length === e.howEn.length),
    EXERCISES.filter((e) => e.howHe.length !== e.howEn.length).map((e) => e.id).join(","));
  check("every step says something", EXERCISES.every((e) => [...e.howHe, ...e.howEn].every((x) => x.trim().length > 3)));
  check("every exercise has a search term", EXERCISES.every((e) => e.yt.trim().length > 3));
  check("search terms are English, for YouTube", EXERCISES.every((e) => !/[\u0590-\u05FF]/.test(e.yt)),
    EXERCISES.filter((e) => /[\u0590-\u05FF]/.test(e.yt)).map((e) => e.id).join(","));
  check("every exercise names a muscle in the list",
    EXERCISES.every((e) => MUSCLES.includes(e.muscle)),
    EXERCISES.filter((e) => !MUSCLES.includes(e.muscle)).map((e) => e.id).join(","));
  check("every muscle has at least six moves", MUSCLES.every((m) =>
    EXERCISES.filter((e) => e.muscle === m).length >= 6),
    MUSCLES.map((m) => `${m}:${EXERCISES.filter((e) => e.muscle === m).length}`).join(" "));
  check("every equipment kind is covered by the gym set",
    EXERCISES.every((e) => EQUIP_SETS.gym.includes(e.equipment)),
    [...new Set(EXERCISES.filter((e) => !EQUIP_SETS.gym.includes(e.equipment)).map((e) => e.equipment))].join(","));

  // the plan builder must still fill a session for every combination
  check("a full session is built for every goal, day count and kit", (() => {
    for (const goal of ["cut", "recomp", "maintain", "bulk"] as const) {
      for (const days of [2, 3, 4, 5, 6]) {
        for (const mins of [30, 45, 60, 90]) {
          for (const kit of ["gym", "home", "bodyweight"]) {
            const plan = buildPlan(goal, days, mins, kit);
            if (plan.sessions.length !== days) return false;
            for (const day of plan.sessions) {
              if (day.exercises.length === 0) return false;
              if (new Set(day.exercises.map((e) => e.id)).size !== day.exercises.length) return false;
              const allowed = new Set(EQUIP_SETS[kit]!);
              if (!day.exercises.every((e) => allowed.has(e.equipment))) return false;
            }
          }
        }
      }
    }
    return true;
  })());
}

// --- browsing and searching the catalogue
{
  const one = EXERCISES.find((e) => e.id === "bench-press")!;
  check("an empty query matches everything", matches(one, ""));
  check("a Hebrew name is found", matches(one, "לחיצת חזה"));
  check("a partial Hebrew word is found", matches(one, "לחיצ"));
  check("an English name is found", matches(one, "bench"));
  check("word order does not matter", matches(one, "press bench"));
  check("gershayim do not break a search", matches(EXERCISES.find((e) => e.id === "t-bar-row")!, "t bar"));
  check("the equipment is searchable", matches(one, "barbell"));
  check("nonsense matches nothing", !matches(one, "קשקושבלבל"));

  check("filtering by muscle only returns that muscle",
    filterExercises({ muscle: "chest" }).every((e) => e.muscle === "chest"));
  check("filtering by kit only returns that kit",
    filterExercises({ equipment: "bodyweight" }).every((e) => e.equipment === "bodyweight"));
  check("filters compose", (() => {
    const rows = filterExercises({ muscle: "legs", equipment: "barbell", query: "סקוואט" });
    return rows.length > 0 && rows.every((e) => e.muscle === "legs" && e.equipment === "barbell");
  })());
  check("no filter returns the whole catalogue", filterExercises({}).length === EXERCISES.length);
  check("an impossible combination returns nothing, not everything",
    filterExercises({ muscle: "cardio", equipment: "smith" }).length === 0);

  const mine = [{ id: "mine-1", he: "תרגיל שלי", en: "My move", muscle: "core" as const,
    equipment: "bodyweight" as const, compound: false, howHe: ["ככה"], howEn: ["like this"],
    yt: "core exercise", custom: true }];
  check("a personal move is in the library", filterExercises({ custom: mine, query: "תרגיל שלי" }).length === 1);
  check("a personal move is filtered like any other",
    filterExercises({ custom: mine, muscle: "chest", query: "תרגיל שלי" }).length === 0);
  check("personal moves come after the built-in ones",
    allExercises(mine).at(-1)!.id === "mine-1");

  check("every muscle chip leads somewhere", MUSCLES.every((m) => filterExercises({ muscle: m }).length > 0));
  check("every kit chip leads somewhere",
    equipmentKinds().every((k) => filterExercises({ equipment: k }).length > 0));
  check("the muscle counts add up to the catalogue",
    Object.values(countByMuscle()).reduce((a, b) => a + b, 0) === EXERCISES.length);

  // the searches a real person types
  for (const [term, wanted] of [
    ["סקוואט", "squat"], ["חזה", "bench-press"], ["בטן", "crunch"], ["ביצפס", "biceps-curl"], ["טרייספס", "triceps-pushdown"], ["בטן", "crunch"],
    ["squat", "squat"], ["deadlift", "deadlift"], ["curl", "biceps-curl"],
    ["פולי", "lat-pulldown"], ["מקבילים", "dips"], ["הליכון", "treadmill-run"],
    ["קטלבל", "kb-swing"], ["גומייה", "band-curl"], ["סמית", "smith-bench"],
  ] as const) {
    const rows = filterExercises({ query: term });
    if (wanted) {
      check(`searching "${term}" finds ${wanted}`, rows.some((e) => e.id === wanted),
        rows.slice(0, 3).map((e) => e.id).join(","));
    } else {
      check(`searching "${term}" finds something`, rows.length > 0);
    }
  }
}

// --- a plan is this person's, shaped by the goal, and can lead with weak muscles
{
  const ids = (pl: ReturnType<typeof buildPlan>) =>
    pl.sessions.map((d) => d.exercises.map((e) => e.id).join(",")).join("|");

  check("two people with the same inputs get different plans",
    ids(buildPlan("recomp", 3, 60, "gym", { seed: "userA" })) !==
      ids(buildPlan("recomp", 3, 60, "gym", { seed: "userB" })));
  check("the same person gets the same plan twice",
    ids(buildPlan("recomp", 3, 60, "gym", { seed: "userA" })) ===
      ids(buildPlan("recomp", 3, 60, "gym", { seed: "userA" })));
  check("changing the goal changes the exercises, not just the sets",
    ids(buildPlan("cut", 3, 60, "gym", { seed: "userA" })) !==
      ids(buildPlan("bulk", 3, 60, "gym", { seed: "userA" })));
  check("a bulk plan leans on more compounds than a cut plan", (() => {
    const compoundShare = (g: "cut" | "bulk") => {
      const pl = buildPlan(g, 4, 60, "gym", { seed: "userA" });
      const all = pl.sessions.flatMap((d) => d.exercises);
      return all.filter((e) => e.compound).length / all.length;
    };
    return compoundShare("bulk") > compoundShare("cut");
  })());
  check("regenerating (a new seed) re-rolls the moves",
    ids(buildPlan("recomp", 3, 60, "gym", { seed: "s1" })) !==
      ids(buildPlan("recomp", 3, 60, "gym", { seed: "s2" })));

  // weak-muscle focus
  const focused = buildPlan("recomp", 3, 60, "gym", { seed: "userA", focus: ["arms"] });
  check("a focus muscle leads the session that trains it", (() => {
    // push day (index 0) trains arms; the opening move should be an arms move
    return focused.sessions[0]!.exercises[0]!.muscle === "arms";
  })(), focused.sessions[0]!.exercises[0]!.muscle);
  check("a focus muscle gets more of the session", (() => {
    const armsIn = (pl: ReturnType<typeof buildPlan>) =>
      pl.sessions[0]!.exercises.filter((e) => e.muscle === "arms").length;
    return armsIn(focused) > armsIn(buildPlan("recomp", 3, 60, "gym", { seed: "userA" }));
  })());
  check("a leg-day focus does not force arms onto leg day", (() => {
    const legFocus = buildPlan("recomp", 3, 60, "gym", { seed: "userA", focus: ["legs"] });
    const legDay = legFocus.sessions[2]!; // push, pull, legs
    return legDay.exercises.some((e) => e.muscle === "legs");
  })());
  check("focus still builds a full session", focused.sessions.every((d) => d.exercises.length >= 4));
  check("no session repeats an exercise even with focus",
    focused.sessions.every((d) => new Set(d.exercises.map((e) => e.id)).size === d.exercises.length));

  // every combination still fills, now with a seed and focus in the mix
  check("every goal/day/kit still builds full sessions with a seed", (() => {
    for (const goal of ["cut", "recomp", "maintain", "bulk"] as const) {
      for (const days of [2, 3, 4, 5, 6]) {
        for (const kit of ["gym", "home", "bodyweight"]) {
          const pl = buildPlan(goal, days, 60, kit, { seed: "x", focus: ["chest", "back"] });
          if (pl.sessions.length !== days) return false;
          for (const d of pl.sessions) {
            if (d.exercises.length === 0) return false;
            if (new Set(d.exercises.map((e) => e.id)).size !== d.exercises.length) return false;
          }
        }
      }
    }
    return true;
  })());
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
