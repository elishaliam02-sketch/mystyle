/**
 * The training coach: what to lift today, and how the week is going.
 *
 * A plan that shows the same "3 × 8–12" every session reads as a printout.
 * What a coach adds is the next number: it looks at what you actually did last
 * time and says what to aim for now — double progression, the method most
 * coaches use:
 * - hit the top of the rep range on every set → add weight next time and
 *   start again from the bottom of the range;
 * - not there yet → same weight, one more rep;
 * - stuck for three sessions (no rep or load gained) → take 10% off and build
 *   back up (a deload beats grinding the same failed set);
 * - bodyweight moves progress by reps, then by a harder variation.
 *
 * Pure, so every rule is tested (coachtest.ts).
 */
import { epley1RM, type SetEntry, type SetLog } from "./sets";
import type { WorkoutRecord } from "./session";

export type Target = {
  kind: "first" | "moreReps" | "addWeight" | "deload" | "repeat";
  /** Weight to use; 0 for bodyweight. */
  kg: number;
  /** Reps to aim for on each set. */
  reps: number;
  /** What last time was, for "last time 60×10". */
  last: { kg: number; reps: number } | null;
};

/** "8–12" → { lo: 8, hi: 12 }; a single number is both ends. */
export function repRange(range: string): { lo: number; hi: number } {
  const nums = (range.match(/\d+/g) ?? []).map(Number);
  const lo = nums[0] ?? 8;
  const hi = nums[1] ?? lo;
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

/** How much to add when the range is beaten: bigger for heavy compound lifts. */
export function increment(kg: number, compound: boolean): number {
  if (!compound) return kg >= 20 ? 2.5 : 1;
  return kg >= 100 ? 5 : 2.5;
}

const round = (kg: number, step: number) => Math.max(0, Math.round(kg / step) * step);

/** The completed working sets of a session, ignoring empty rows. */
function worked(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.done && s.reps > 0);
}

/** The heaviest weight used in a session and the reps done at it (weakest set). */
function summary(sets: SetEntry[]): { kg: number; reps: number; all: SetEntry[] } | null {
  const w = worked(sets);
  if (w.length === 0) return null;
  const kg = Math.max(...w.map((s) => s.kg));
  const atKg = w.filter((s) => s.kg === kg);
  return { kg, reps: Math.min(...atKg.map((s) => s.reps)), all: atKg };
}

/** Best estimated 1RM of a session (or best reps for bodyweight). */
function score(sets: SetEntry[]): number {
  const w = worked(sets);
  if (w.length === 0) return 0;
  if (w.every((s) => s.kg === 0)) return Math.max(...w.map((s) => s.reps));
  return Math.max(...w.map((s) => epley1RM(s.kg, s.reps)));
}

/**
 * Today's target for one exercise from its past sessions (oldest first).
 * `range` is the prescribed rep range, `compound` whether it is a big lift.
 */
export function nextTarget(history: SetEntry[][], range: string, compound: boolean): Target {
  const { lo, hi } = repRange(range);
  const sessions = history.map(summary).filter((s): s is NonNullable<typeof s> => !!s);
  const last = sessions[sessions.length - 1];
  if (!last) return { kind: "first", kg: 0, reps: lo, last: null };
  const lastOut = { kg: last.kg, reps: last.reps };

  // Bodyweight: reps are the only dial.
  if (last.kg === 0) {
    return last.reps >= hi
      ? { kind: "addWeight", kg: 0, reps: last.reps + 1, last: lastOut }
      : { kind: "moreReps", kg: 0, reps: Math.min(hi, last.reps + 1), last: lastOut };
  }

  // Stuck: the last three sessions made no progress on the best one before them.
  const scores = history.map(score).filter((n) => n > 0);
  if (scores.length >= 4) {
    const before = Math.max(...scores.slice(0, -3));
    const recent = scores.slice(-3);
    if (recent.every((n) => n <= before)) {
      return { kind: "deload", kg: round(last.kg * 0.9, 2.5), reps: hi, last: lastOut };
    }
  }

  // Every working set at the top of the range: add weight, back to the bottom.
  if (last.all.every((s) => s.reps >= hi)) {
    return { kind: "addWeight", kg: last.kg + increment(last.kg, compound), reps: lo, last: lastOut };
  }
  // Below the bottom of the range: repeat the weight and own it.
  if (last.reps < lo) return { kind: "repeat", kg: last.kg, reps: lo, last: lastOut };
  return { kind: "moreReps", kg: last.kg, reps: Math.min(hi, last.reps + 1), last: lastOut };
}

/** Past sessions of one exercise from the set log, oldest first, before `today`. */
export function historyOf(log: SetLog, exerciseId: string, today: string): SetEntry[][] {
  return Object.keys(log)
    .filter((d) => d < today && (log[d]?.[exerciseId]?.length ?? 0) > 0)
    .sort()
    .map((d) => log[d]![exerciseId]!);
}

export type WeekReview = {
  /** Sessions trained in the last 7 days. */
  done: number;
  /** Planned sessions a week. */
  planned: number;
  /** Days since the last workout; null when never. */
  sinceLast: number | null;
  /** Weeks in a row with at least the planned number of sessions (up to now). */
  streakWeeks: number;
  /** Personal records in the last 7 days. */
  prs: number;
  /** Minutes trained in the last 7 days. */
  minutes: number;
  /** The one thing to say. */
  mood: "start" | "comeback" | "onTrack" | "behind" | "crushing" | "done";
};

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / DAY);

/**
 * The week so far, from the training log (dates with exercises done) and the
 * saved workout summaries. `today` is the local date.
 */
export function weekReview(
  log: Record<string, string[]>,
  history: WorkoutRecord[],
  planned: number,
  today: string,
): WeekReview {
  const t = dayNum(today);
  const days = Object.keys(log).filter((d) => (log[d]?.length ?? 0) > 0);
  const inWeek = (d: string) => t - dayNum(d) >= 0 && t - dayNum(d) < 7;
  const done = days.filter(inWeek).length;
  const last = days.filter((d) => dayNum(d) <= t).sort().pop();
  const sinceLast = last ? t - dayNum(last) : null;
  const recent = history.filter((r) => inWeek(r.date));
  const prs = recent.reduce((n, r) => n + r.prs, 0);
  const minutes = Math.round(recent.reduce((n, r) => n + r.durationSec, 0) / 60);

  // Full weeks (7-day blocks ending yesterday) that met the plan, in a row.
  let streakWeeks = 0;
  for (let w = 0; w < 52; w++) {
    const end = t - 1 - w * 7;
    const count = days.filter((d) => {
      const n = dayNum(d);
      return n <= end && n > end - 7;
    }).length;
    if (count >= planned && planned > 0) streakWeeks++;
    else break;
  }

  let mood: WeekReview["mood"];
  if (sinceLast === null) mood = "start";
  else if (done >= planned) mood = prs > 0 ? "crushing" : "done";
  else if (sinceLast >= 5) mood = "comeback";
  else if (prs >= 2) mood = "crushing";
  else {
    // On track when the sessions left fit in the days left of this 7-day window.
    const daysLeft = 7 - ((t - (dayNum(days.filter(inWeek).sort()[0] ?? today))) % 7);
    mood = planned - done <= daysLeft ? "onTrack" : "behind";
  }
  return { done, planned, sinceLast, streakWeeks, prs, minutes, mood };
}
