/**
 * The daily step log.
 *
 * No pedometer: reading the phone's motion sensor needs a native module, which
 * would mean a fresh store build rather than an over-the-air update, and a
 * permission prompt on top. What this does instead is the thing every step
 * tracker is actually for — a number, a target, and whether the week is
 * holding — fed from the count the person's phone or watch already shows them.
 *
 * Pure over a date → count map, so all of it is testable without a store.
 */

export type StepLog = Record<string, number>;

/** Nobody walks a million steps; nobody walks minus five. */
export const MAX_STEPS = 100000;

/** The default daily target, and the range someone may set it to. */
export const DEFAULT_STEP_GOAL = 8000;
export const MIN_STEP_GOAL = 2000;
export const MAX_STEP_GOAL = 30000;

export function isStorableSteps(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= MAX_STEPS && Number.isInteger(n);
}

export function isStorableGoal(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_STEP_GOAL && n <= MAX_STEP_GOAL;
}

/** Clamps a count into the storable range, for a text field that can hold junk. */
export function clampSteps(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_STEPS, Math.round(n));
}

export function stepsOn(log: StepLog, date: string): number {
  return log[date] ?? 0;
}

/**
 * The last `days` days ending at `today`, oldest first — including the zeros,
 * because a chart that silently skips the days you did not walk is a chart that
 * flatters you.
 */
export function recentSteps(log: StepLog, today: string, days: number): { date: string; steps: number }[] {
  const out: { date: string; steps: number }[] = [];
  const d = new Date(`${today}T12:00:00`);
  for (let i = days - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    out.push({ date: key, steps: log[key] ?? 0 });
  }
  return out;
}

/** The average over a window, rounded — zero when the window is empty. */
export function averageSteps(log: StepLog, today: string, days: number): number {
  const rows = recentSteps(log, today, days);
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((n, r) => n + r.steps, 0) / rows.length);
}

/**
 * Consecutive days the target was met, counting back from today — or from
 * yesterday when today has not been logged *at all*, so an unfinished day never
 * reads as a broken streak at nine in the morning. A day logged below target is
 * a miss, and does break it.
 */
export function stepStreak(log: StepLog, today: string, goal: number): number {
  const target = goal > 0 ? goal : DEFAULT_STEP_GOAL;
  const d = new Date(`${today}T12:00:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  let n = 0;
  const cursor = new Date(d);
  // A day with no entry yet is "not finished"; a day logged below target is a
  // miss. Only the first of those gets the benefit of the doubt — otherwise
  // someone who logged 4,000 steps would still be shown an unbroken streak.
  if (log[key(cursor)] === undefined) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    if ((log[key(cursor)] ?? 0) < target) break;
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/**
 * Roughly how many calories a step count burned, from body weight. About
 * 0.0005 kcal per step per kilogram — a walking-economy rule of thumb, honest
 * to within the tens, and labelled as an estimate wherever it is shown.
 */
export function stepsKcal(steps: number, weightKg?: number): number {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  return Math.round(steps * 0.0005 * w);
}

/** Roughly how far that is, in kilometres — 0.72 m a step for an adult. */
export function stepsKm(steps: number): number {
  return Math.round(steps * 0.00072 * 10) / 10;
}
