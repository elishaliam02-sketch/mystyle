/**
 * What a person has earned for the tasks they set themselves.
 *
 * The rule is simple enough to say in one line: every tick pays what the task
 * is worth, and what a task is worth is read off the task itself (see
 * `@/tasks/difficulty`). Holding a task for a week pays more than the first
 * day of it, because the seventh day is the one people quit on.
 *
 * Like the achievements board, this is a pure function of stored state — no
 * ledger, no counter to keep in step, nothing to migrate, and nothing that can
 * drift out of agreement with the ticks it is computed from. Untick a day and
 * the points go with it, which is the honest behaviour.
 */

import type { AppState } from "@/store/types";
import { scanTask, type Difficulty, type Scan } from "@/tasks/difficulty";

export type Reward = {
  /** Everything earned, ever. */
  points: number;
  level: number;
  /** Points banked inside the current level, and what the level costs. */
  intoLevel: number;
  levelSpan: number;
  toNext: number;
  todayPoints: number;
  weekPoints: number;
  /** Completions, split by how hard the task was. */
  ticks: Record<Difficulty, number>;
  /** The share of `points` that came from holding a task for a week or more. */
  bonusPoints: number;
  /** The hardest task this person has actually completed, for the board. */
  hardest: { title: string; level: Difficulty; points: number } | null;
};

/** A task with its scan attached — what the screens list. */
export type ScoredTask = { id: string; title: string; scan: Scan };

const DAY_MS = 86_400_000;

/** After this many days in a row, a task starts paying its streak bonus. */
export const STREAK_DAYS = 7;
/** How much of a task's own worth the bonus adds. */
export const STREAK_BONUS = 0.5;

function parseDate(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, day || 1);
}

/**
 * The cost of each level. It widens as it goes, so early levels arrive fast
 * enough to mean something and later ones stay worth reaching.
 */
export function levelSpan(level: number): number {
  return 100 + (Math.max(1, level) - 1) * 60;
}

/** Turns lifetime points into a level and a position inside it. */
export function levelAt(points: number): { level: number; intoLevel: number; levelSpan: number } {
  let level = 1;
  let left = Math.max(0, points);
  while (left >= levelSpan(level)) {
    left -= levelSpan(level);
    level += 1;
  }
  return { level, intoLevel: left, levelSpan: levelSpan(level) };
}

/** Every live task the person set themselves, scanned. */
export function scoredTasks(state: AppState): ScoredTask[] {
  return state.habits
    .filter((h) => !h.archived)
    .map((h) => ({ id: h.id, title: h.title, scan: scanTask(h.title) }));
}

/**
 * Everything earned, without reference to what day it is.
 *
 * Split out from `computeRewards` because the parts that do not depend on the
 * clock — the lifetime total, the level, the split by difficulty — are wanted
 * on their own by the achievements board, and handing that a fake "today" to
 * get at them would be a lie with a long tail.
 */
export function earnings(state: AppState): {
  points: number;
  bonusPoints: number;
  ticks: Record<Difficulty, number>;
  hardest: Reward["hardest"];
  /** Points earned per local date, for the day and week windows. */
  perDay: Map<string, number>;
} {
  const scans = new Map<string, Scan>();
  for (const habit of state.habits) scans.set(habit.id, scanTask(habit.title));
  const titles = new Map(state.habits.map((h) => [h.id, h.title]));

  // Ticks per habit, in date order, so a run can be measured as we pay it.
  const byHabit = new Map<string, string[]>();
  for (const c of state.completions) {
    if (!c.done) continue;
    if (!scans.has(c.habitId)) continue;
    byHabit.set(c.habitId, [...(byHabit.get(c.habitId) ?? []), c.date]);
  }

  const ticks: Record<Difficulty, number> = { easy: 0, moderate: 0, hard: 0 };
  const perDay = new Map<string, number>();
  let points = 0;
  let bonusPoints = 0;
  let hardest: Reward["hardest"] = null;

  for (const [habitId, rawDates] of byHabit) {
    const scan = scans.get(habitId)!;
    // Deduplicated: two rows for one habit on one day are one day's work.
    const dates = [...new Set(rawDates)].sort();

    let run = 0;
    let previous: number | null = null;
    for (const date of dates) {
      const at = parseDate(date);
      run = previous !== null && at - previous === DAY_MS ? run + 1 : 1;
      previous = at;

      const bonus = run >= STREAK_DAYS ? Math.round(scan.points * STREAK_BONUS) : 0;
      const earned = scan.points + bonus;

      points += earned;
      bonusPoints += bonus;
      ticks[scan.level] += 1;
      perDay.set(date, (perDay.get(date) ?? 0) + earned);

      if (!hardest || scan.points > hardest.points) {
        hardest = { title: titles.get(habitId) ?? "", level: scan.level, points: scan.points };
      }
    }
  }

  return { points, bonusPoints, ticks, hardest, perDay };
}

/**
 * The whole reward picture.
 *
 * `today` is passed in rather than read from the clock: this has to be
 * testable, and the app already guards against a wound-back device clock in
 * one place (the store) rather than in every reader.
 */
export function computeRewards(state: AppState, today: string): Reward {
  const { points, bonusPoints, ticks, hardest, perDay } = earnings(state);

  const weekStart = parseDate(today) - 6 * DAY_MS;
  const todayAt = parseDate(today);
  let todayPoints = 0;
  let weekPoints = 0;
  for (const [date, earned] of perDay) {
    const at = parseDate(date);
    if (date === today) todayPoints += earned;
    if (at >= weekStart && at <= todayAt) weekPoints += earned;
  }

  const { level, intoLevel, levelSpan: span } = levelAt(points);

  return {
    points,
    level,
    intoLevel,
    levelSpan: span,
    toNext: span - intoLevel,
    todayPoints,
    weekPoints,
    ticks,
    bonusPoints,
    hardest,
  };
}

/** What today's board is worth if everything left on it gets ticked. */
export function todayOnOffer(state: AppState, today: string): { earned: number; available: number } {
  const done = new Set(
    state.completions.filter((c) => c.done && c.date === today).map((c) => c.habitId),
  );
  let earned = 0;
  let available = 0;
  for (const task of scoredTasks(state)) {
    available += task.scan.points;
    if (done.has(task.id)) earned += task.scan.points;
  }
  return { earned, available };
}
