/**
 * Where this person can improve — named, ranked, and with the number behind it.
 *
 * A progress screen full of charts tells someone what happened. It does not
 * tell them what to do on Tuesday, and the gap between those two is where most
 * tracking apps lose people: the graphs are honest, nobody knows what to
 * change, and eventually nobody opens them.
 *
 * So this ranks the pillars by the gap between what the person set out to do
 * and what they actually did over the last week, and returns the two or three
 * worth fixing next. Three rules keep it useful rather than dispiriting:
 *
 * - It only judges what they opted into. No water goal, no water verdict.
 * - It needs enough days to be fair. A pillar with two days of data is not
 *   evidence of anything, and saying so would be noise.
 * - It always returns what is going *well* too. A list of six failings is a
 *   reason to close the app, and the thing that is working is usually the
 *   thing to build the next habit on.
 *
 * Pure: state in, readings out. The words live in `src/i18n`.
 */

import { goalMlOf, waterMlLog } from "@/health/water";
import type { AppState } from "@/store/types";

export type ImproveArea = "habits" | "workout" | "water" | "steps" | "food" | "weighIn" | "recap";

export type Reading = {
  area: ImproveArea;
  /** How much of the target was met over the window, 0–1. */
  fraction: number;
  /** What the person did, and what they were aiming at — for the sentence. */
  actual: number;
  target: number;
  /** Days of data this is based on. */
  days: number;
  /** The gap, weighted by how much this pillar matters. Ranks the list. */
  weight: number;
};

export type Improvement = {
  /** The areas most worth fixing, worst first. Never more than three. */
  worst: Reading[];
  /** The one going best, when anything is. */
  best: Reading | null;
  /** Every area that had enough data to judge. */
  all: Reading[];
};

const DAY_MS = 86_400_000;

function parseDate(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, day || 1);
}

/** The last `days` local dates, most recent first. */
function window(today: string, days: number): string[] {
  const end = parseDate(today);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(end - i * DAY_MS);
    const pad = (n: number) => String(n).padStart(2, "0");
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

/** Below this, a pillar is worth mentioning as something to fix. */
export const SHORTFALL = 0.8;
/** Fewer days than this and there is nothing honest to say. */
export const MIN_DAYS = 3;
/** How many days back to read. A week is short enough to still be actionable. */
export const WINDOW_DAYS = 7;

/**
 * Reads the last week and ranks it.
 *
 * `today` is passed in rather than read from a clock, like everywhere else in
 * this codebase — it has to be testable, and the store already guards against
 * a device clock wound backwards.
 */
export function improvements(state: AppState, today: string): Improvement {
  const days = window(today, WINDOW_DAYS);
  const inWindow = new Set(days);
  const all: Reading[] = [];

  const add = (
    area: ImproveArea,
    actual: number,
    target: number,
    daysOfData: number,
    weight: number,
  ) => {
    if (target <= 0 || daysOfData < MIN_DAYS) return;
    all.push({
      area,
      fraction: Math.max(0, Math.min(1, actual / target)),
      actual: Math.round(actual * 10) / 10,
      target: Math.round(target * 10) / 10,
      days: daysOfData,
      weight,
    });
  };

  // Habits: ticks against what was on the board each day.
  const habits = state.habits.filter((h) => !h.archived);
  if (habits.length > 0) {
    const created = habits.map((h) => parseDate(h.createdAt));
    // Only count days a habit actually existed — a board created on Thursday
    // is not "four days missed".
    const liveDays = days.filter((d) => created.some((c) => c <= parseDate(d)));
    const possible = liveDays.reduce(
      (n, d) => n + habits.filter((h) => parseDate(h.createdAt) <= parseDate(d)).length,
      0,
    );
    const done = state.completions.filter((c) => c.done && inWindow.has(c.date)).length;
    add("habits", done, possible, liveDays.length, 3);
  }

  // Training: sessions against the plan's days per week.
  if (state.training) {
    const log = state.training.log ?? {};
    const trained = days.filter((d) => (log[d]?.length ?? 0) > 0).length;
    add("workout", trained, state.training.days, WINDOW_DAYS, 3);
  }

  // Water, steps: daily goals, averaged.
  // In ml — the old cup record folded in at the glass size it was shown at.
  const waterGoal = goalMlOf(state) ?? 0;
  if (waterGoal > 0) {
    const water = waterMlLog(state);
    const logged = days.filter((d) => water[d] !== undefined);
    const drunk = logged.reduce((n, d) => n + (water[d] ?? 0), 0);
    add("water", Math.round(drunk / Math.max(1, logged.length) / 50) * 50, waterGoal, logged.length, 2);
  }

  const stepGoal = state.stepGoal ?? 0;
  if (stepGoal > 0) {
    const logged = days.filter((d) => state.steps?.[d] !== undefined);
    const walked = logged.reduce((n, d) => n + (state.steps?.[d] ?? 0), 0);
    add("steps", walked / Math.max(1, logged.length), stepGoal, logged.length, 2);
  }

  // Food: days with anything logged at all. Not calories — being under target
  // is not a failure worth chasing, and this app does not police intake.
  const intake = state.intake ?? {};
  const loggedDays = days.filter((d) => (intake[d]?.length ?? 0) > 0).length;
  if (Object.keys(intake).length > 0) {
    add("food", loggedDays, WINDOW_DAYS, WINDOW_DAYS, 1);
  }

  // Weigh-ins and recaps: weekly rhythms rather than daily ones.
  if (state.weighIns.length > 0) {
    const weighed = state.weighIns.filter((w) => inWindow.has(w.date)).length;
    add("weighIn", weighed, 2, WINDOW_DAYS, 1);
  }
  if (state.checkIns.length > 0) {
    const recapped = state.checkIns.filter((c) => inWindow.has(c.date)).length;
    add("recap", recapped, 4, WINDOW_DAYS, 1);
  }

  // Worst first, by how far short it fell and how much the pillar matters.
  const ranked = [...all].sort(
    (a, b) => (1 - b.fraction) * b.weight - (1 - a.fraction) * a.weight,
  );
  const worst = ranked.filter((r) => r.fraction < SHORTFALL).slice(0, 3);
  const best = [...all].sort((a, b) => b.fraction - a.fraction)[0] ?? null;

  return { worst, best: best && best.fraction >= SHORTFALL ? best : null, all };
}
