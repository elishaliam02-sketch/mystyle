import { allSetsDone, bestOneRepMax, blankSets, clampKg, clampReps, epley1RM, previousSets, progress, sessionVolume, topSet, typedNumber, typedValue, type SetLog } from "./sets";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const S = (kg: number, reps: number, done = true) => ({ kg, reps, done });

// blank sets
{
  check("three prescribed sets give three rows", blankSets(3).length === 3);
  check("blank rows start empty and unticked",
    blankSets(3).every((s) => s.kg === 0 && s.reps === 0 && !s.done));
  check("zero or nonsense still gives one row", blankSets(0).length === 1 && blankSets(NaN).length === 1);
  check("an absurd count is capped", blankSets(999).length === 12, String(blankSets(999).length));
}

// previous sets
{
  const log: SetLog = {
    "2026-01-01": { bench: [S(50, 10)] },
    "2026-01-08": { bench: [S(55, 8)], squat: [S(80, 5)] },
    "2026-01-15": { bench: [S(60, 8)] },
  };
  check("previous is the latest earlier date",
    previousSets(log, "bench", "2026-01-15")?.[0].kg === 55,
    String(previousSets(log, "bench", "2026-01-15")?.[0].kg));
  check("today's own sets are never shown as history",
    previousSets(log, "bench", "2026-01-08")?.[0].kg === 50);
  check("an exercise never trained has no previous", previousSets(log, "deadlift", "2026-02-01") === null);
  check("nothing earlier means no previous", previousSets(log, "bench", "2026-01-01") === null);
  check("a day with no rows for that exercise is skipped",
    previousSets(log, "squat", "2026-01-15")?.[0].kg === 80);
  check("an empty log is safe", previousSets({}, "bench", "2026-01-01") === null);
}

// volume counts only what was ticked
{
  const sets = [S(60, 10), S(60, 8), { kg: 60, reps: 8, done: false }];
  check("volume sums the ticked sets", sessionVolume(sets) === 60 * 10 + 60 * 8, String(sessionVolume(sets)));
  check("an untouched exercise has no volume", sessionVolume(blankSets(3)) === 0);
}

// top set
{
  check("top set is the heaviest ticked one", topSet([S(60, 8), S(80, 3), S(70, 5)])?.kg === 80);
  check("an unticked heavy set does not count",
    topSet([S(60, 8), { kg: 200, reps: 1, done: false }])?.kg === 60);
  check("no ticked sets means no top set", topSet(blankSets(3)) === null);
}

// completion
{
  check("all ticked reads as done", allSetsDone([S(60, 8), S(60, 8)]));
  check("one unticked is not done", !allSetsDone([S(60, 8), { kg: 60, reps: 8, done: false }]));
  check("an empty list is not done", !allSetsDone([]));
}

// --- today against last time
{
  const S = (kg: number, reps: number, done = true) => ({ kg, reps, done });
  const last = [S(70, 8), S(70, 7), S(65, 8)];
  check("volume counts only the ticked sets", progress([S(50, 10), S(50, 10, false)], null).volume === 500);
  check("a first session has nothing to compare", progress([S(50, 10)], null).deltaPct === null);
  check("more volume reads as a gain", progress([S(80, 8), S(80, 8), S(80, 8)], last).deltaPct! > 0);
  check("less volume reads as a drop", progress([S(50, 5)], last).deltaPct! < 0);
  check("an identical session is flat", progress(last, last).deltaPct === 0);
  check("a heavier top set is a personal best", progress([S(75, 3)], last).personalBest);
  check("the same top weight is not a new best", !progress([S(70, 12)], last).personalBest);
  check("a lighter session is no personal best", !progress([S(60, 20)], last).personalBest);
  check("the very first lift is a personal best", progress([S(40, 5)], null).personalBest);
  check("an empty session claims nothing", !progress([], last).personalBest && progress([], last).volume === 0);
  check("untouched sets cannot make a best", !progress([S(200, 1, false)], last).personalBest);
  check("last session's volume is reported back", progress([], last).prevVolume === 70 * 8 + 70 * 7 + 65 * 8);
}

// --- a single set cannot hold an absurd number
{
  check("a huge weight is capped", clampKg(999999) === 1000);
  check("a normal weight is kept", clampKg(72.5) === 72.5);
  check("weight rounds to one decimal", clampKg(72.55) === 72.6, String(clampKg(72.55)));
  check("a negative weight becomes zero", clampKg(-5) === 0);
  check("NaN weight becomes zero", clampKg(Number.NaN) === 0);
  check("reps are whole numbers", clampReps(8.6) === 9);
  check("a thousand-and-one reps is capped", clampReps(1001) === 1000);
  check("negative reps become zero", clampReps(-3) === 0);
  check("a capped set cannot fake a personal best", (() => {
    const prev = [{ kg: 100, reps: 5, done: true }];
    // even a typo'd 999999 is clamped to 1000, still a real PB but a sane one
    const p = progress([{ kg: clampKg(999999), reps: clampReps(8), done: true }], prev);
    return p.volume === 1000 * 8 && p.personalBest;
  })());
}

// --- estimated one-rep-max
{
  check("a single rep is its own max", epley1RM(100, 1) === 100);
  check("Epley on 100x10 is about 133", epley1RM(100, 10) === 133.3, String(epley1RM(100, 10)));
  check("more reps at the same weight estimate a higher max", epley1RM(80, 8) > epley1RM(80, 5));
  check("bodyweight sets have no 1RM", epley1RM(0, 20) === 0);
  check("zero reps have no 1RM", epley1RM(60, 0) === 0);
  check("the session 1RM is the best completed set", (() => {
    const rm = bestOneRepMax([
      { kg: 60, reps: 10, done: true },
      { kg: 100, reps: 3, done: true },
      { kg: 200, reps: 1, done: false },
    ]);
    return rm === epley1RM(100, 3);
  })());
  check("progress carries the 1RM", progress([{ kg: 100, reps: 5, done: true }], null).oneRepMax === epley1RM(100, 5));
  check("an all-bodyweight session reports no 1RM", progress([{ kg: 0, reps: 20, done: true }], null).oneRepMax === 0);
}

// Typing a weight — the bug that made the set table unusable: every keystroke
// was pushed through clampKg and rendered back, so the moment you typed the
// dot in "62.5" it was parsed to 62 and the dot disappeared.
{
  // the exact sequence a person types for 62.5 kg
  const keys = ["6", "62", "62.", "62.5"];
  const seen = keys.map((k) => typedNumber(k, true));
  check("every keystroke of 62.5 survives", seen.join("|") === "6|62|62.|62.5", seen.join("|"));
  check("a half-typed decimal is not yet a number", typedValue("62.") === null);
  check("and the finished one is", typedValue("62.5") === 62.5);
  check("a comma decimal is accepted and normalised", typedNumber("62,5", true) === "62.5");
  check("typing a lone zero is kept, not blanked", typedNumber("0", true) === "0" && typedValue("0") === 0);
  check("a leading dot is still mid-word", typedValue(typedNumber(".", true)) === null);
  check("letters never reach the box", typedNumber("6a2", true) === "62");
  check("only one decimal place is offered", typedNumber("62.55", true) === "62.5");
  check("only one separator survives", typedNumber("62.5.5", true) === "62.5");
  check("reps take no decimal point at all", typedNumber("8.5", false) === "85");
  check("an empty box means nothing yet", typedValue("") === null);
  check("an absurdly long entry is cut off", typedNumber("123456", true) === "1234");
  check("what is typed still clamps on commit", clampKg(typedValue("62.5")!) === 62.5);
  check("and a typo above the cap is still caught", clampKg(9999) === 1000);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
