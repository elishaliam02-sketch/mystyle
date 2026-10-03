/**
 * Achievements — the Hevy-style badges that turn quiet, steady effort into
 * something you can see. Every badge is earned from data the app already keeps
 * (habit ticks, streaks, workouts logged, weigh-ins, recaps, and the reward
 * level the self-set tasks add up to), so this is a pure function of the
 * stored state: no clock, no network, fully testable. The screen supplies the
 * words for each id; here we only decide progress.
 */

import type { AppState } from "@/store/types";
import { earnings, levelAt } from "@/rewards";
import { longestStreakOf } from "@/habits/schedule";

/** An Ionicons glyph name — the screen renders it. */
export type Achievement = {
  id: string;
  icon: string;
  /** Where the person is, and where the badge unlocks. */
  progress: number;
  target: number;
  unlocked: boolean;
  /** Bronze / silver / gold — colours a tier without needing separate ids. */
  tier: "bronze" | "silver" | "gold";
};

const tierFor = (target: number): Achievement["tier"] =>
  target >= 100 ? "gold" : target >= 25 ? "silver" : "bronze";

function badge(id: string, icon: string, progress: number, target: number): Achievement {
  return {
    id,
    icon,
    progress: Math.min(progress, target),
    target,
    unlocked: progress >= target,
    tier: tierFor(target),
  };
}

/**
 * The full badge board, in a stable order. Unlocked or not, every badge is
 * returned with its progress, so the screen can show a bar on the locked ones —
 * the near-misses are what pull someone back tomorrow.
 */
export function computeAchievements(state: AppState): Achievement[] {
  const doneCompletions = state.completions.filter((c) => c.done);
  const ticks = doneCompletions.length;

  // Longest streak across any single habit.
  const byHabit = new Map<string, string[]>();
  for (const c of doneCompletions) {
    byHabit.set(c.habitId, [...(byHabit.get(c.habitId) ?? []), c.date]);
  }
  // Over each habit's own days: a Monday/Wednesday/Friday habit kept for a
  // month is a twelve-day run, not twelve runs of one.
  let longestStreak = 0;
  for (const [id, dates] of byHabit) {
    const habit = state.habits.find((h) => h.id === id) ?? { createdAt: "9999-12-31" };
    const last = [...dates].sort().at(-1)!;
    longestStreak = Math.max(longestStreak, longestStreakOf(habit, new Set(dates), last));
  }

  // Training: distinct days trained, and total exercises ticked.
  const log = state.training?.log ?? {};
  const workoutDays = Object.values(log).filter((ids) => ids.length > 0).length;
  const exercisesDone = Object.values(log).reduce((n, ids) => n + ids.length, 0);
  const customMoves = state.training?.custom.length ?? 0;

  // What the reward system makes of the tasks this person set themselves: the
  // hard ones they actually finished, and the level those ticks add up to.
  const earned = earnings(state);
  const hardTicks = earned.ticks.hard;
  const level = levelAt(earned.points).level;

  const weighIns = state.weighIns.length;
  const checkIns = state.checkIns.length;

  // Weight moved toward the goal, in kg (only counts as loss for a cut).
  const sorted = [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const startKg = state.profile.startKg ?? sorted[0]?.kg;
  const latestKg = sorted[sorted.length - 1]?.kg;
  // Unrounded, and only for someone losing: 2.5 kg is not "lost 3 kg", and a
  // bulk's gain is not a loss.
  const goal = state.goal ?? state.nutritionGoal;
  const losing = goal !== "bulk" && goal !== "maintain";
  const kgLost = losing && startKg && latestKg ? Math.max(0, Math.floor((startKg - latestKg) * 10) / 10) : 0;

  return [
    // habits
    badge("first-tick", "checkmark-circle", ticks, 1),
    badge("ticks-50", "flame", ticks, 50),
    badge("ticks-200", "ribbon", ticks, 200),
    // streaks
    badge("streak-7", "bonfire", longestStreak, 7),
    badge("streak-30", "trophy", longestStreak, 30),
    badge("streak-100", "medal", longestStreak, 100),
    // training
    badge("first-workout", "barbell", workoutDays, 1),
    badge("workouts-20", "fitness", workoutDays, 20),
    badge("workouts-100", "trophy", workoutDays, 100),
    badge("exercises-250", "flash", exercisesDone, 250),
    badge("own-move", "add-circle", customMoves, 1),
    // self-set tasks: what you asked of yourself, not what the app asked
    badge("first-hard", "flash-outline", hardTicks, 1),
    badge("hard-25", "rocket", hardTicks, 25),
    badge("level-10", "trophy-outline", level, 10),
    // kitchen
    badge("kitchen-start", "restaurant", state.pantry?.trim() ? 1 : 0, 1),
    // weight
    badge("weigh-in-4", "scale", weighIns, 4),
    badge("weight-down-3", "trending-down", kgLost, 3),
    // reflection
    badge("recap-7", "chatbubble-ellipses", checkIns, 7),
    badge("recap-30", "sparkles", checkIns, 30),
  ];
}

/** How many are unlocked — for the "12/19" summary. */
export function unlockedCount(list: Achievement[]): number {
  return list.filter((a) => a.unlocked).length;
}
