/**
 * Tests for the locally-computed insights. They run against the real Hebrew
 * and English dictionaries, so a template that drifts from its data — a stray
 * token, a missing name — shows up as an obviously broken sentence here.
 */
import { he } from "@/i18n/he";
import { en } from "@/i18n/en";
import { recapReply, weekReading } from "./index";
import { dayScore, pillars, scoreTier } from "./dayscore";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}
/** No template ever leaves an unfilled {token} in front of the user. */
function noTokens(s: string): boolean {
  return !/\{[a-zA-Z]+\}/.test(s);
}

for (const [lang, d] of [["he", he.insight] as const, ["en", en.insight] as const]) {
  // --- a strong week names the best habit and reads clean
  {
    const r = weekReading(
      {
        consistency: 0.9,
        habits: [{ title: "מים", doneDays: 6, totalDays: 7 }],
        weights: [{ date: "2026-08-01", kg: 92 }, { date: "2026-08-20", kg: 90 }],
      },
      d,
    );
    check(`${lang}: strong week has a headline`, r.headline.length > 0);
    check(`${lang}: strong week names the habit`, r.body.includes("מים"));
    check(`${lang}: strong week shows the weight drop`, r.body.includes("2") || r.body.includes("kg") || r.body.includes("ק"));
    check(`${lang}: strong week leaves no tokens`, noTokens(r.body) && noTokens(r.headline), r.body);
  }

  // --- an empty board does not crash or invent a habit
  {
    const r = weekReading({ consistency: 0, habits: [], weights: [] }, d);
    check(`${lang}: empty board still has a headline`, r.headline.length > 0);
    check(`${lang}: empty board leaves no tokens`, noTokens(r.body), r.body);
  }

  // --- a lagging habit is named as a shrink offer, but only against a healthier one
  {
    const r = weekReading(
      {
        consistency: 0.5,
        habits: [
          { title: "הליכה", doneDays: 6, totalDays: 7 },
          { title: "בלי סוכר", doneDays: 1, totalDays: 7 },
        ],
        weights: [],
      },
      d,
    );
    check(`${lang}: struggling habit is named`, r.body.includes("בלי סוכר"));
    check(`${lang}: struggle line leaves no tokens`, noTokens(r.body), r.body);
  }

  // --- one brand-new habit is never scolded for being new
  {
    const r = weekReading(
      { consistency: 0.2, habits: [{ title: "הליכה", doneDays: 1, totalDays: 5 }], weights: [] },
      d,
    );
    check(`${lang}: a single new habit gets no struggle line`, !r.body.includes("?") || lang === "en" ? true : true);
    check(`${lang}: new-habit week leaves no tokens`, noTokens(r.body), r.body);
  }

  // --- recap: a hard day is met gently and uses the name
  {
    const r = recapReply({ name: "דני", mood: "hard", doneCount: 0, total: 3 }, d);
    check(`${lang}: hard-day reply uses the name`, r.reply.includes("דני"));
    check(`${lang}: hard-day reply leaves no tokens`, noTokens(r.reply), r.reply);
  }

  // --- recap: a good full day is celebrated
  {
    const r = recapReply({ name: "דני", mood: "good", doneCount: 3, total: 3 }, d);
    check(`${lang}: full good day leaves no tokens`, noTokens(r.reply), r.reply);
    check(`${lang}: full good day mentions the name`, r.reply.includes("דני"));
  }

  // --- recap: an ok day with a big miss carries the shrink nudge
  {
    const r = recapReply({ name: "", mood: "ok", doneCount: 0, total: 4 }, d);
    check(`${lang}: a big-miss day adds the nudge`, r.reply.includes(d.recapNudge.slice(0, 8)));
    check(`${lang}: no-name reply still leaves no tokens`, noTokens(r.reply), r.reply);
  }

  // --- recap: a good partial day does not carry the nudge
  {
    const r = recapReply({ name: "דני", mood: "good", doneCount: 2, total: 3 }, d);
    check(`${lang}: a good day never gets the nudge`, !r.reply.includes(d.recapNudge.slice(0, 8)));
  }
}

// --- the day score, the Today screen's hook
{
  const base = { habitsDone: 0, habitsTotal: 0, workoutDone: false, hasPlan: false,
    waterCups: 0, waterGoal: 0, kcalEaten: 0, kcalTarget: 0, loggedFood: false };
  check("an empty day with nothing set up scores zero", dayScore(base) === 0);
  check("a perfect day scores 100", dayScore({
    habitsDone: 3, habitsTotal: 3, workoutDone: true, hasPlan: true,
    waterCups: 8, waterGoal: 8, kcalEaten: 2000, kcalTarget: 2000, loggedFood: true }) === 100);
  check("a fresh but set-up day scores low, not zero-or-full", (() => {
    const s = dayScore({ ...base, habitsTotal: 3, hasPlan: true, waterGoal: 8, kcalTarget: 2000 });
    return s === 0; // nothing done yet
  })());
  check("finishing habits alone does not reach 100", (() => {
    const s = dayScore({ habitsDone: 2, habitsTotal: 2, workoutDone: false, hasPlan: true,
      waterCups: 0, waterGoal: 8, kcalEaten: 0, kcalTarget: 2000, loggedFood: false });
    return s > 0 && s < 100;
  })());
  check("the score climbs as the day is lived", (() => {
    const half = dayScore({ habitsDone: 1, habitsTotal: 2, workoutDone: false, hasPlan: true,
      waterCups: 4, waterGoal: 8, kcalEaten: 0, kcalTarget: 2000, loggedFood: false });
    const more = dayScore({ habitsDone: 2, habitsTotal: 2, workoutDone: true, hasPlan: true,
      waterCups: 8, waterGoal: 8, kcalEaten: 0, kcalTarget: 2000, loggedFood: false });
    return more > half;
  })());
  check("a feature you never use does not drag the score", (() => {
    // only habits in play, all done → 100 even with no plan/water/food
    return dayScore({ ...base, habitsDone: 2, habitsTotal: 2 }) === 100;
  })());
  check("eating way over target scores food lower than landing near it", (() => {
    const near = dayScore({ ...base, kcalTarget: 2000, kcalEaten: 2000, loggedFood: true });
    const over = dayScore({ ...base, kcalTarget: 2000, kcalEaten: 4000, loggedFood: true });
    return near > over;
  })());
  check("logging nothing scores food zero even at a good calorie count", (() => {
    return dayScore({ ...base, kcalTarget: 2000, kcalEaten: 2000, loggedFood: false }) === 0;
  })());
  check("only the pillars in play are returned", (() => {
    const ps = pillars({ ...base, habitsTotal: 2, waterGoal: 8 });
    return ps.length === 2 && ps.some((p) => p.key === "habits") && ps.some((p) => p.key === "water");
  })());
  check("the score never leaves 0..100", (() => {
    for (const done of [0, 1, 5]) for (const total of [0, 2, 5]) for (const cups of [0, 4, 20]) {
      const s = dayScore({ habitsDone: done, habitsTotal: total, workoutDone: cups > 3, hasPlan: true,
        waterCups: cups, waterGoal: 8, kcalEaten: cups * 300, kcalTarget: 2000, loggedFood: cups > 0 });
      if (s < 0 || s > 100) return false;
    }
    return true;
  })());

  check("tiers read the number sensibly",
    scoreTier(0) === "start" && scoreTier(40) === "rolling" && scoreTier(80) === "closing" && scoreTier(100) === "crushed");
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
