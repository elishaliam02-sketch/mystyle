import { computeRewards, levelAt, levelSpan, scoredTasks, todayOnOffer, STREAK_DAYS } from "./index";
import { POINTS } from "@/tasks/difficulty";
import { EMPTY_STATE, type AppState, type Habit } from "@/store/types";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const STAMP = "2026-01-01T00:00:00.000Z";
const habit = (id: string, title: string, archived = false): Habit => ({
  id,
  title,
  createdAt: "2026-01-01",
  archived,
  updatedAt: STAMP,
});
const tick = (habitId: string, date: string, done = true) => ({ habitId, date, done, updatedAt: STAMP });
const stateWith = (patch: Partial<AppState>): AppState => ({ ...EMPTY_STATE, ...patch });

// nothing done, nothing owed
{
  const r = computeRewards(EMPTY_STATE, "2026-03-01");
  check("an empty board earns nothing", r.points === 0, String(r.points));
  check("everyone starts at level 1", r.level === 1, String(r.level));
  check("an empty board has no hardest task", r.hardest === null);
}

// a tick pays what the task is worth, and no more
{
  const s = stateWith({
    habits: [habit("h1", "Make the bed"), habit("h2", "Run 10 km")],
    completions: [tick("h1", "2026-03-01"), tick("h2", "2026-03-01")],
  });
  const r = computeRewards(s, "2026-03-01");
  check("an easy tick pays the easy rate", r.points === POINTS.easy + POINTS.hard, String(r.points));
  check("both ticks count today", r.todayPoints === POINTS.easy + POINTS.hard, String(r.todayPoints));
  check("the split is recorded", r.ticks.easy === 1 && r.ticks.hard === 1, JSON.stringify(r.ticks));
  check("the hardest task is the hard one", r.hardest?.title === "Run 10 km", r.hardest?.title);
}

// a harder task is worth more than an easy one for the same single tick
{
  const easy = computeRewards(
    stateWith({ habits: [habit("h1", "Make the bed")], completions: [tick("h1", "2026-03-01")] }),
    "2026-03-01",
  );
  const hard = computeRewards(
    stateWith({ habits: [habit("h1", "Run 10 km")], completions: [tick("h1", "2026-03-01")] }),
    "2026-03-01",
  );
  check("one hard tick beats one easy tick", hard.points > easy.points, `${easy.points} vs ${hard.points}`);
}

// unticking takes the points back — the ledger is the ticks themselves
{
  const s = stateWith({
    habits: [habit("h1", "Run 10 km")],
    completions: [tick("h1", "2026-03-01", false)],
  });
  check("an unticked day pays nothing", computeRewards(s, "2026-03-01").points === 0);
}

// a week held pays a bonus; six days does not
{
  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => tick("h1", `2026-03-${String(i + 1).padStart(2, "0")}`));
  const six = computeRewards(
    stateWith({ habits: [habit("h1", "Make the bed")], completions: days(6) }),
    "2026-03-06",
  );
  const seven = computeRewards(
    stateWith({ habits: [habit("h1", "Make the bed")], completions: days(7) }),
    "2026-03-07",
  );
  check("six days earn no bonus", six.bonusPoints === 0, String(six.bonusPoints));
  check(`day ${STREAK_DAYS} earns a bonus`, seven.bonusPoints > 0, String(seven.bonusPoints));
  check("the bonus is on top of the day's own worth",
    seven.points > seven.ticks.easy * POINTS.easy, String(seven.points));
}

// a broken run starts the streak again
{
  const dates = ["01", "02", "03", "04", "05", "06", "08", "09"].map((d) => tick("h1", `2026-03-${d}`));
  const r = computeRewards(stateWith({ habits: [habit("h1", "Make the bed")], completions: dates }), "2026-03-09");
  check("a gap resets the streak bonus", r.bonusPoints === 0, String(r.bonusPoints));
}

// the week window covers seven days, including today, and stops there
{
  const s = stateWith({
    habits: [habit("h1", "Make the bed")],
    completions: [tick("h1", "2026-03-01"), tick("h1", "2026-03-10"), tick("h1", "2026-03-16")],
  });
  const r = computeRewards(s, "2026-03-16");
  check("this week counts only the last seven days", r.weekPoints === POINTS.easy * 2, String(r.weekPoints));
  check("lifetime points count everything", r.points === POINTS.easy * 3, String(r.points));
}

// a tick against a habit that no longer exists cannot pay out
{
  const s = stateWith({ habits: [], completions: [tick("ghost", "2026-03-01")] });
  check("an orphaned tick earns nothing", computeRewards(s, "2026-03-01").points === 0);
}

// two ticks written for the same habit on the same day are one day
{
  const s = stateWith({
    habits: [habit("h1", "Run 10 km")],
    completions: [tick("h1", "2026-03-01"), tick("h1", "2026-03-01")],
  });
  check("a duplicated tick is not paid twice", computeRewards(s, "2026-03-01").points === POINTS.hard);
}

// levels: the curve widens, and the pieces always add back up to the total
{
  check("level 1 is the cheapest", levelSpan(1) < levelSpan(2));
  check("no points is level 1 exactly", levelAt(0).level === 1 && levelAt(0).intoLevel === 0);
  check("the last point of a level does not level up", levelAt(levelSpan(1) - 1).level === 1);
  check("the first point of the next level does", levelAt(levelSpan(1)).level === 2);
  for (const points of [0, 1, 99, 100, 259, 260, 1000, 12345]) {
    const at = levelAt(points);
    let below = 0;
    for (let l = 1; l < at.level; l++) below += levelSpan(l);
    check(`level maths adds up at ${points}`, below + at.intoLevel === points, `${below}+${at.intoLevel}`);
    check(`position never exceeds the level at ${points}`, at.intoLevel < at.levelSpan);
  }
}

// the board only ever offers live tasks
{
  const s = stateWith({
    habits: [habit("h1", "Run 10 km"), habit("h2", "Make the bed", true)],
    completions: [tick("h1", "2026-03-01")],
  });
  check("archived tasks are not scanned", scoredTasks(s).length === 1, String(scoredTasks(s).length));
  const offer = todayOnOffer(s, "2026-03-01");
  check("today's offer covers the live tasks", offer.available === POINTS.hard, String(offer.available));
  check("today's earned tracks what was ticked", offer.earned === POINTS.hard, String(offer.earned));
  const untouched = todayOnOffer(s, "2026-03-02");
  check("a fresh day starts at nothing earned", untouched.earned === 0 && untouched.available === POINTS.hard);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
