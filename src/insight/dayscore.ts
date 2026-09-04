/**
 * The day's score — one number, 0 to 100, that ties the app's pillars together
 * so opening APEX answers "how am I doing today?" at a glance and the number
 * climbs as the day is lived. This is the hook the Today screen was missing: a
 * flat list of tiles does not pull you back, a score you want to fill does.
 *
 * Pure and weighted, so it is testable and honest: each pillar only counts if
 * the person actually uses it (no water goal, no water weight), and the whole
 * thing tops out at 100 without any single pillar being able to carry it alone.
 */

export type DayInput = {
  habitsDone: number;
  habitsTotal: number;
  workoutDone: boolean;
  hasPlan: boolean;
  waterCups: number;
  waterGoal: number;
  kcalEaten: number;
  kcalTarget: number;
  loggedFood: boolean;
};

export type Pillar = { key: "habits" | "workout" | "water" | "food"; fraction: number; weight: number };

/**
 * The pillars in play today and how full each is, 0..1. A pillar the person
 * does not use (no habits, no plan, no water goal) is left out entirely rather
 * than dragging the score down for a feature they never touched.
 */
export function pillars(d: DayInput): Pillar[] {
  const out: Pillar[] = [];
  if (d.habitsTotal > 0) {
    out.push({ key: "habits", weight: 3, fraction: clamp(d.habitsDone / d.habitsTotal) });
  }
  if (d.hasPlan) {
    out.push({ key: "workout", weight: 2, fraction: d.workoutDone ? 1 : 0 });
  }
  if (d.waterGoal > 0) {
    out.push({ key: "water", weight: 2, fraction: clamp(d.waterCups / d.waterGoal) });
  }
  if (d.kcalTarget > 0) {
    // Food scores for logging and for landing near the target — being wildly
    // under (forgot to log) or way over both read as less than a clean day.
    const ratio = d.kcalEaten / d.kcalTarget;
    const closeness = d.loggedFood ? 1 - Math.min(1, Math.abs(1 - ratio)) : 0;
    out.push({ key: "food", weight: 2, fraction: clamp(closeness) });
  }
  return out;
}

/** The weighted day score, 0..100. Zero when there is nothing to score yet. */
export function dayScore(d: DayInput): number {
  const ps = pillars(d);
  const totalWeight = ps.reduce((n, p) => n + p.weight, 0);
  if (totalWeight === 0) return 0;
  const got = ps.reduce((n, p) => n + p.weight * p.fraction, 0);
  return Math.round((got / totalWeight) * 100);
}

export type ScoreTier = "start" | "rolling" | "closing" | "crushed";

/** Which headline to show for a score — the emotional read of the number. */
export function scoreTier(score: number): ScoreTier {
  if (score >= 100) return "crushed";
  if (score >= 66) return "closing";
  if (score >= 25) return "rolling";
  return "start";
}

function clamp(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1, n);
}
