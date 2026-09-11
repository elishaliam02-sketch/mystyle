import { allChallengeIds, challengeFor, CHALLENGE_BONUS, poolSize } from "./index";
import { POINTS, type Difficulty } from "@/tasks/difficulty";
import { he } from "@/i18n/he";
import { en } from "@/i18n/en";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const LEVELS: Difficulty[] = ["easy", "moderate", "hard"];

// --- the same day always gives the same challenge
{
  const a = challengeFor("2026-09-11", "moderate", "salt-1");
  const b = challengeFor("2026-09-11", "moderate", "salt-1");
  check("the same day and level give the same challenge", a.id === b.id, `${a.id} vs ${b.id}`);
  check("it carries the level it was asked for", a.level === "moderate");
  check("a challenge pays more than a habit of the same level",
    a.points === POINTS.moderate + CHALLENGE_BONUS, String(a.points));
}

// --- and a different day gives a different one, most of the time
{
  const week = ["11", "12", "13", "14", "15", "16", "17"].map(
    (d) => challengeFor(`2026-09-${d}`, "easy", "salt-1").id,
  );
  check("a week of days is not one repeated challenge", new Set(week).size >= 5,
    week.join(","));
}

// --- two people are not handed the same dare on the same day
{
  const mine = challengeFor("2026-09-11", "hard", "device-a").id;
  const theirs = challengeFor("2026-09-11", "hard", "device-b").id;
  const third = challengeFor("2026-09-11", "hard", "device-c").id;
  check("the salt separates devices", new Set([mine, theirs, third]).size > 1,
    `${mine}/${theirs}/${third}`);
}

// --- a level only ever yields its own challenges, and every one is reachable
{
  for (const level of LEVELS) {
    const seen = new Set<string>();
    // Enough days to walk the whole pool many times over.
    for (let i = 0; i < 400; i++) {
      const date = `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
      const c = challengeFor(date, level, `s${i}`);
      check(`${level}: never returns another level's challenge`, c.level === level);
      seen.add(c.id);
    }
    check(`${level}: every challenge in the pool can come up`,
      seen.size === poolSize(level), `${seen.size}/${poolSize(level)}`);
  }
}

// --- the pool is deep enough to not feel like a loop
{
  for (const level of LEVELS) {
    check(`${level} has at least ten challenges`, poolSize(level) >= 10, String(poolSize(level)));
  }
  const ids = allChallengeIds();
  check("no challenge id is used twice", new Set(ids).size === ids.length);
}

// --- every challenge has words, in both languages
{
  const heItems = he.challenge.items as Record<string, string>;
  const enItems = en.challenge.items as Record<string, string>;
  const missingHe = allChallengeIds().filter((id) => !heItems[id]?.trim());
  const missingEn = allChallengeIds().filter((id) => !enItems[id]?.trim());
  check("every challenge is written in Hebrew", missingHe.length === 0, missingHe.join(","));
  check("every challenge is written in English", missingEn.length === 0, missingEn.join(","));

  // And nothing is written that no challenge will ever show — a dead string is
  // a translation someone paid for and a promise the app does not keep.
  const ids = new Set(allChallengeIds());
  const strayHe = Object.keys(heItems).filter((id) => !ids.has(id));
  check("no orphaned challenge text", strayHe.length === 0, strayHe.join(","));
}

// --- the wording stays a dare, not a diet instruction
{
  const enItems = en.challenge.items as Record<string, string>;
  // A daily challenge is the wrong place to tell somebody to weigh themselves,
  // skip a meal or cut calories, and this app refuses to do it anywhere.
  const banned = /\b(skip|fast|starve|weigh yourself|calorie deficit|cut calories|detox|cleanse)\b/i;
  const offenders = Object.entries(enItems).filter(([, text]) => banned.test(text));
  check("no challenge tells anyone to restrict or weigh themselves",
    offenders.length === 0, offenders.map(([id]) => id).join(","));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
