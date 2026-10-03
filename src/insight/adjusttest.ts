import { shrinkTitle, suggestAdjustment, type AdjustInput } from "./adjust";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

check("minutes halve to a round number", shrinkTitle("הליכה 30 דקות") === "הליכה 15 דקות");
check("cups halve", shrinkTitle("לשתות 8 כוסות מים") === "לשתות 4 כוסות מים");
check("thousands keep their comma", shrinkTitle("10,000 צעדים") === "5,000 צעדים");
check("odd small numbers round", shrinkTitle("3 סטים") === "2 סטים");
check("a clock time is not a count", shrinkTitle("בלי מתוקים אחרי 20:00") === null);
check("one is as small as it gets", shrinkTitle("פרי 1 ביום") === null);
check("no number, nothing to halve", shrinkTitle("לאכול ירקות") === null);
check("English too", shrinkTitle("Walk 45 minutes") === "Walk 25 minutes" || shrinkTitle("Walk 45 minutes") === "Walk 20 minutes", String(shrinkTitle("Walk 45 minutes")));

const T = "2026-10-03";
const ago = (n: number) => new Date(Date.parse(`${T}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const base: AdjustInput = {
  today: T,
  habits: [
    { id: "walk", title: "הליכה 30 דקות", slot: "evening", createdAt: ago(20) },
    { id: "water", title: "לשתות מים", slot: "morning", createdAt: ago(20) },
  ],
  doneDates: { walk: [ago(1)], water: [0, 1, 2, 3, 4, 5, 6].map(ago) },
  moods: [],
  anchorsFor: () => ["אחרי שאני מצחצח שיניים"],
};
const a = suggestAdjustment(base);
check("a habit done 1 of 7 days gets halved", a?.kind === "smaller" && a.habitId === "walk" && a.newTitle === "הליכה 15 דקות", JSON.stringify(a));
check("and says how it went", a?.done === 1 && a.days === 7 && a.why === "missed");

const noNumber = suggestAdjustment({ ...base, habits: [{ ...base.habits[0]!, title: "לצאת להליכה" }, base.habits[1]!] });
check("no number and no trigger: hang it on one", noNumber?.kind === "anchor" && noNumber.anchor === "אחרי שאני מצחצח שיניים", JSON.stringify(noNumber));

const anchored = suggestAdjustment({ ...base, habits: [{ ...base.habits[0]!, title: "לצאת להליכה", anchor: "אחרי ארוחת ערב" }, base.habits[1]!] });
check("anchored already: move it to where things get done", anchored?.kind === "reschedule" && anchored.slot === "morning" && anchored.slotRate === 100, JSON.stringify(anchored));

check("a habit going well is left alone", suggestAdjustment({ ...base, doneDates: { walk: [0, 1, 2, 3, 4].map(ago), water: [0, 1, 2, 3, 4, 5, 6].map(ago) } }) === null);
check("too new to judge (3 days old)", suggestAdjustment({ ...base, habits: [{ ...base.habits[0]!, createdAt: ago(2) }], doneDates: {} }) === null);
check("4 of 7 is fine on an ordinary week", suggestAdjustment({ ...base, doneDates: { walk: [1, 2, 3, 4].map(ago), water: [0, 1, 2, 3, 4, 5, 6].map(ago) } }) === null);
const hardWeek = suggestAdjustment({ ...base, doneDates: { walk: [1, 2, 3, 4].map(ago), water: [0, 1, 2, 3, 4, 5, 6].map(ago) }, moods: [{ date: ago(1), mood: "hard" }, { date: ago(3), mood: "hard" }] });
check("but after a hard week the bar drops", hardWeek?.kind === "smaller" && hardWeek.why === "hard", JSON.stringify(hardWeek));
check("old hard days do not count", suggestAdjustment({ ...base, doneDates: { walk: [1, 2, 3, 4].map(ago), water: [0, 1, 2, 3, 4, 5, 6].map(ago) }, moods: [{ date: ago(9), mood: "hard" }, { date: ago(10), mood: "hard" }] }) === null);
check("the worst habit is the one picked", suggestAdjustment({ ...base, doneDates: { walk: [1, 2].map(ago), water: [] } })?.habitId === "water");
check("a day ticked twice counts once", suggestAdjustment({ ...base, doneDates: { walk: [ago(1), ago(1), ago(1), ago(1)], water: [0, 1, 2, 3, 4, 5, 6].map(ago) } })?.done === 1);

check("a habit changed this week is given the week", suggestAdjustment({ ...base, habits: [{ ...base.habits[0]!, updatedAt: `${ago(2)}T20:00:00Z` }, base.habits[1]!] }) === null);
check("one changed long ago can be looked at again", suggestAdjustment({ ...base, habits: [{ ...base.habits[0]!, updatedAt: `${ago(9)}T20:00:00Z` }, base.habits[1]!] })?.kind === "smaller");
check("an updatedAt from the day it was made does not count as a change", suggestAdjustment({ ...base, habits: [{ ...base.habits[0]!, updatedAt: `${ago(20)}T09:00:00Z` }, base.habits[1]!] })?.kind === "smaller");

// --- a habit with rest days is judged on the days it was owed
{
  // 2026-10-03 is a Saturday: this week's Mon/Wed/Fri are 28/9, 30/9, 2/10.
  const gym = { id: "gym", title: "חדר כושר", slot: "evening" as const, days: [1, 3, 5], createdAt: ago(20) };
  const water = base.habits[1]!;
  const kept = suggestAdjustment({ ...base, habits: [gym, water], doneDates: { gym: ["2026-09-28", "2026-09-30", "2026-10-02"], water: base.doneDates.water! } });
  check("three of three gym days is not \"struggling\" (it used to read 3/7)", kept === null, JSON.stringify(kept));
  const missed = suggestAdjustment({ ...base, habits: [gym, water], doneDates: { gym: [], water: base.doneDates.water! } });
  check("none of its days is", missed?.habitId === "gym", JSON.stringify(missed));
  const once = suggestAdjustment({ ...base, habits: [{ ...gym, days: [6] }, water], doneDates: { gym: [], water: base.doneDates.water! } });
  check("a once-a-week habit is not judged on one day", once === null, JSON.stringify(once));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
