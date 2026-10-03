/**
 * What to do right now — the one card on Today that changes with the hour.
 *
 * Every block on the home screen answered "how is the day going"; none
 * answered "so what do I do next", which is the question someone opening the
 * app actually has. This reads the clock and the day so far and returns the
 * few actions that matter most at this moment, most important first:
 * a workout left running, the habit due in this part of the day, water behind
 * the pace the goal needs, a meal not logged after its time, a weigh-in that
 * is due, today's session when the week needs it, and the evening recap.
 *
 * Pure and deterministic — the hour and the numbers in, a ranked list out —
 * so every rule is tested (nextsteptest.ts). Words live in `src/i18n`.
 */

export type NextKind =
  | "resumeWorkout"
  | "habit"
  | "water"
  | "logMeal"
  | "weighIn"
  | "workout"
  | "recap"
  | "eatMore"
  | "bodyFacts"
  | "allDone";

export type NextStep = {
  kind: NextKind;
  /** Higher first. */
  priority: number;
  /** A habit's id and title, a meal slot, a number for the sentence. */
  habitId?: string;
  title?: string;
  meal?: "breakfast" | "lunch" | "dinner";
  amount?: number;
};

export type NextInput = {
  /** Local hour, 0–23 (fractions allowed). */
  hour: number;
  habits: { id: string; title: string; slot?: "morning" | "noon" | "evening"; done: boolean }[];
  water: { ml: number; goalMl: number; cupMl: number };
  /** Diary entries logged today, and their calories. */
  meals: { count: number; kcal: number; targetKcal: number };
  /** Days since the last weigh-in; null when there has never been one. */
  daysSinceWeighIn: number | null;
  workout: {
    /** A session is running right now. */
    active: boolean;
    /** The person has a training plan. */
    planned: boolean;
    doneToday: boolean;
    /** Sessions done in the last 7 days, and the plan's per week. */
    doneThisWeek: number;
    perWeek: number;
  };
  recapDoneToday: boolean;
  /** Height, sex and age are all known (the calorie target is calculated,
   * not guessed). Missing: a quiet nudge to fill them in. */
  bodyKnown?: boolean;
};

/** The waking day the water pace is spread over. */
const WAKE = 7;
const SLEEP = 22;

/** Which part of the day a habit slot belongs to, by the clock. */
export function partOfDay(hour: number): "morning" | "noon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "noon";
  return "evening";
}

/** How much water the goal needs by this hour, on an even pace through the
 * waking day. */
export function waterPace(goalMl: number, hour: number): number {
  const share = Math.max(0, Math.min(1, (hour - WAKE) / (SLEEP - WAKE)));
  return Math.round(goalMl * share);
}

export function nextSteps(input: NextInput, limit = 3): NextStep[] {
  const out: NextStep[] = [];
  const { hour } = input;
  const part = partOfDay(hour);

  if (input.workout.active) out.push({ kind: "resumeWorkout", priority: 100 });

  // A habit due in this part of the day, or one left over from an earlier part.
  const order = { morning: 0, noon: 1, evening: 2 } as const;
  const due = input.habits
    .filter((h) => !h.done && (h.slot ? order[h.slot] <= order[part] : part === "evening"))
    .sort((a, b) => (b.slot === part ? 1 : 0) - (a.slot === part ? 1 : 0));
  if (due[0]) {
    out.push({ kind: "habit", priority: due[0].slot === part ? 80 : 70, habitId: due[0].id, title: due[0].title });
  }

  // Water: behind the pace by more than a cup.
  const { ml, goalMl, cupMl } = input.water;
  if (goalMl > 0 && hour >= WAKE + 1 && hour < SLEEP) {
    const behind = waterPace(goalMl, hour) - ml;
    if (behind >= cupMl) {
      out.push({ kind: "water", priority: 60 + Math.min(20, Math.round(behind / cupMl) * 4), amount: Math.ceil(behind / cupMl) });
    }
  }

  // A meal whose time has passed with nothing written down.
  const { count, kcal, targetKcal } = input.meals;
  const meal: NextStep["meal"] | null =
    hour >= 10.5 && count === 0 ? "breakfast" : hour >= 15 && count <= 1 ? "lunch" : hour >= 21 && count <= 2 ? "dinner" : null;
  if (meal) out.push({ kind: "logMeal", priority: 65, meal });
  // Evening and far under the day's food: a real dinner, not skipping it.
  if (hour >= 18 && count > 0 && targetKcal > 0 && kcal < targetKcal * 0.55) {
    out.push({ kind: "eatMore", priority: 55, amount: Math.round((targetKcal - kcal) / 10) * 10 });
  }

  // Weigh-in: weekly, and best done in the morning.
  const since = input.daysSinceWeighIn;
  if (since === null || since >= 7) {
    const overdue = since === null || since >= 10;
    if (hour < 12 || overdue) out.push({ kind: "weighIn", priority: hour < 12 ? 75 : 50, amount: since ?? undefined });
  }

  // Today's session, when the week still needs it and the day has room.
  const w = input.workout;
  if (w.planned && !w.active && !w.doneToday && w.doneThisWeek < w.perWeek && hour >= 6 && hour < 21) {
    out.push({ kind: "workout", priority: 58 + (w.perWeek - w.doneThisWeek) * 3, amount: w.perWeek - w.doneThisWeek });
  }

  // The evening recap, once the day is mostly done.
  if (hour >= 20 && !input.recapDoneToday) out.push({ kind: "recap", priority: hour >= 21 ? 85 : 62 });

  // The least urgent thing on the card, so it never pushes a real task off it.
  if (input.bodyKnown === false) out.push({ kind: "bodyFacts", priority: 20 });

  if (out.length === 0) return [{ kind: "allDone", priority: 0 }];
  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
