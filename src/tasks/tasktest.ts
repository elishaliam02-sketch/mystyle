import { BANDS, POINTS, scanTask, taskPoints, type Difficulty } from "./difficulty";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const level = (title: string): Difficulty => scanTask(title).level;
const at = (title: string, want: Difficulty) =>
  check(`"${title}" reads as ${want}`, level(title) === want, `${level(title)} (${scanTask(title).score})`);

// The everyday small ones — the tasks a coach actually wants people to start
// with. They must not read as hard, or the board inflates.
at("Drink a glass of water", "easy");
at("Take my vitamins", "easy");
at("Make the bed", "easy");
at("Read 10 pages", "easy");
at("Stretch for 5 minutes", "easy");
at("Meditate 10 minutes", "easy");

// The middle: real, repeatable, costs something.
at("Walk 30 minutes", "moderate");
at("Cold shower", "moderate");
at("No sugar today", "moderate");
at("50 push-ups", "moderate");
at("Gym session", "moderate");

// The ones that should pay out.
at("Run 10 km", "hard");
at("Gym for 60 minutes", "hard");
at("Wake up at 5am and run 5 km", "hard");
at("Sprint intervals for 20 minutes", "hard");
at("Swim 2 km before work", "hard");

// Hebrew reads the same, including inflected forms and no-niqqud spelling.
at("לשתות כוס מים", "easy");
at("לקרוא 10 עמודים", "easy");
at("ריצה 10 קמ", "hard");
at("אימון בחדר כושר 60 דקות", "hard");
at("בלי סוכר כל היום", "moderate");
at("הליכה 30 דקות", "moderate");

// A quantity moves a task even when the words around it do not.
{
  const small = scanTask("Run 1 km").score;
  const big = scanTask("Run 15 km").score;
  check("a longer distance scores higher", big > small, `${small} → ${big}`);
  check("15 km is hard", level("Run 15 km") === "hard");
  check("a distance is reported as a quantity", scanTask("Run 5 km").reasons.includes("quantity"));
  check("minutes are reported as a duration", scanTask("Row for 45 minutes").reasons.includes("duration"));
}

// Metric is the app's language. Imperial is read, converted and forgotten —
// before the fix, "run 3 miles" was priced as three kilometres (60% of the
// real thing) and "bench 200 lbs" as two hundred kilos (more than double).
{
  const km = (t: string) => scanTask(t).score;
  check("3 miles outscores 3 km", km("Run 3 miles") > km("Run 3 km"),
    `${km("Run 3 km")} → ${km("Run 3 miles")}`);
  check("3 miles scores like the ~4.8 km it is",
    km("Run 3 miles") === km("Run 4.8 km"), `${km("Run 3 miles")} vs ${km("Run 4.8 km")}`);
  check("10 miles is hard, like the 16 km it is", level("Run 10 miles") === "hard");
  check("1 mile is not 1 km", km("Walk 1 mile") > km("Walk 1 km"));

  check("200 lbs is read as ~90 kg, not 200",
    km("Bench press 200 lbs") === km("Bench press 91 kg"),
    `${km("Bench press 200 lbs")} vs ${km("Bench press 91 kg")}`);
  check("200 lbs scores lower than 200 kg",
    km("Bench press 200 lbs") < km("Bench press 200 kg"));
  check("a kilo is still a kilo", km("Bench press 100 kg") === km("Bench press 100 kilo"));

  // Hebrew spellings of both, since people write them.
  check("מייל converts too", km("ריצה 3 מייל") > km("ריצה 3 קמ"));
  check("kilometre spelled out is the same as km", km("Run 5 kilometres") === km("Run 5 km"));
}

// Two tasks in one line cost more than one.
{
  const one = scanTask("Walk 20 minutes").score;
  const two = scanTask("Walk 20 minutes and stretch").score;
  check("a second clause raises the score", two > one, `${one} → ${two}`);
  check("scope is reported", scanTask("Walk 20 minutes and stretch").reasons.includes("scope"));
}

// Words that mark a task as deliberately small pull it back down.
{
  const plain = scanTask("Read").score;
  const small = scanTask("Read just one page").score;
  check("a deliberately small task scores lower", small < plain, `${plain} → ${small}`);
}

// Resisting something all day is its own shape, and it is not easy.
{
  const s = scanTask("No phone after 9pm");
  check("abstaining is spotted", s.reasons.includes("abstain"));
  check("abstaining is not easy", s.level !== "easy", s.level);
}

// Points follow the level, and only the level.
{
  check("an easy task pays the easy rate", taskPoints("Make the bed") === POINTS.easy);
  check("a hard task pays the hard rate", taskPoints("Run 10 km") === POINTS.hard);
  check("hard pays more than moderate", POINTS.hard > POINTS.moderate);
  check("moderate pays more than easy", POINTS.moderate > POINTS.easy);
}

// The bands tile the whole 0–100 range with no gap and no overlap.
{
  check("bands start at zero", BANDS.easy[0] === 0);
  check("bands end at a hundred", BANDS.hard[1] === 100);
  check("easy meets moderate", BANDS.moderate[0] === BANDS.easy[1] + 1);
  check("moderate meets hard", BANDS.hard[0] === BANDS.moderate[1] + 1);
}

// Junk in, sane out — the form scans on every keystroke, including the empty
// one and the half-typed one.
{
  check("an empty title is easy and free of reasons", scanTask("").level === "easy" && scanTask("").reasons.length === 0);
  check("whitespace is an empty title", scanTask("   ").score === 0);
  check("a half-typed word does not crash", typeof scanTask("ru").score === "number");
  check("a score never leaves 0–100", [
    "", "Run 42 km and swim 10 km and cycle 100 km at 5am with max effort every day",
  ].every((t) => {
    const s = scanTask(t).score;
    return s >= 0 && s <= 100;
  }));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
