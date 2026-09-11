import { shareSubject, shareText } from "./share";
import { he } from "@/i18n/he";
import { en } from "@/i18n/en";
import type { Dict } from "@/i18n/dict";

/**
 * The one piece of text in this app that is read by people who have never
 * opened it. A stray `{placeholder}`, an empty line or a boast with no
 * substance behind it is a mistake shown to strangers.
 */

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const reward = {
  level: 7,
  points: 1240,
  ticks: { easy: 40, moderate: 22, hard: 9 },
};

const DICTS: [string, Dict][] = [
  ["he", he],
  ["en", en],
];

for (const [name, t] of DICTS) {
  const full = shareText(t, {
    reward,
    streakDays: 12,
    dayScore: 84,
    challenges: 6,
    name: "Dan",
  });

  check(`${name}: no placeholder survives`, !/\{[a-z]+\}/i.test(full), full);
  check(`${name}: every line has words`, full.split("\n").filter((l) => l === "").length <= 1, full);
  check(`${name}: the level is in it`, full.includes("7"), full);
  check(`${name}: the points are formatted, not raw`, /1[,.]240/.test(full), full);
  check(`${name}: the streak is named`, full.includes("12"), full);
  check(`${name}: the name is used when given`, full.includes("Dan"), full);
  check(`${name}: it says what was actually done, not only a score`,
    full.includes("71") || full.includes("9"), full);
  check(`${name}: it names the app`, full.toUpperCase().includes("APEX"), full);
  check(`${name}: the subject carries the level`, shareSubject(t, 7).includes("7"));
}

// A beginner's share must not read as an empty boast: no streak line at one
// day, no "0 hard tasks", no day score of zero.
{
  const fresh = shareText(en, {
    reward: { level: 1, points: 10, ticks: { easy: 1, moderate: 0, hard: 0 } },
    streakDays: 1,
    dayScore: 0,
    challenges: 0,
  });
  check("a one-day streak is not announced", !fresh.includes("1 days"), fresh);
  check("zero hard tasks are not announced", !fresh.includes("0 of them"), fresh);
  check("a zero day score is left out", !fresh.includes("0/100"), fresh);
  check("zero challenges are left out", !fresh.includes("0 daily"), fresh);
  check("but the level and points are still there", fresh.includes("level 1") && fresh.includes("10"));
}

// A brand-new account with nothing done at all still produces something
// sendable rather than a half-empty message.
{
  const empty = shareText(en, {
    reward: { level: 1, points: 0, ticks: { easy: 0, moderate: 0, hard: 0 } },
    streakDays: 0,
  });
  check("an empty board still shares cleanly", empty.split("\n").length >= 3, empty);
  check("and says nothing false", !/\b0 (tasks|days)\b/.test(empty), empty);
}

// The name is optional, and whitespace is not a name.
{
  const blank = shareText(en, { reward, streakDays: 3, name: "   " });
  check("a blank name falls back to the plain headline", !blank.includes("·"), blank.split("\n")[0]);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${(d ?? "").slice(0, 120)}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
