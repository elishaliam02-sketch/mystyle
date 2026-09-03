import { EXERCISES, type Equipment, type Exercise, type Muscle } from "./exercises";
import type { Goal } from "@/kitchen";

/** What equipment the person can train with — drives which moves a plan uses. */
export const EQUIP_SETS: Record<string, Equipment[]> = {
  gym: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"],
  home: ["dumbbell", "kettlebell", "bodyweight"],
  bodyweight: ["bodyweight"],
};

/**
 * Builds a weekly training plan from a goal and how many days a week the person
 * can train. The split is chosen by frequency — the same logic a coach uses —
 * and each session is filled from the exercise library, compounds first. All on
 * the device; no account, no cost.
 */

export type DayType = "push" | "pull" | "legs" | "upper" | "lower" | "fullA" | "fullB";

export type PlanDay = { type: DayType; muscles: Muscle[]; exercises: Exercise[] };

export type Plan = {
  goal: Goal;
  days: number;
  /** Which equipment set the plan was built for. */
  equipment?: string;
  /** How long one session runs, in minutes — governs how many moves it holds. */
  minutes?: number;
  /** Working sets per exercise, and the rep range — set by the goal. */
  sets: number;
  reps: string;
  sessions: PlanDay[];
};

/** The muscles each kind of session trains. */
const DAY_MUSCLES: Record<DayType, Muscle[]> = {
  push: ["chest", "shoulders", "arms"],
  pull: ["back", "arms"],
  legs: ["legs", "glutes", "core"],
  upper: ["chest", "back", "shoulders", "arms"],
  lower: ["legs", "glutes", "core"],
  fullA: ["chest", "back", "legs", "core"],
  fullB: ["shoulders", "back", "legs", "glutes"],
};

/** The split for a given weekly frequency. */
function split(days: number): DayType[] {
  switch (Math.max(2, Math.min(6, days))) {
    case 2: return ["fullA", "fullB"];
    case 3: return ["push", "pull", "legs"];
    case 4: return ["upper", "lower", "upper", "lower"];
    case 5: return ["push", "pull", "legs", "upper", "lower"];
    default: return ["push", "pull", "legs", "push", "pull", "legs"];
  }
}

/** Sets and rep range by goal. */
function volume(goal: Goal): { sets: number; reps: string } {
  if (goal === "bulk") return { sets: 4, reps: "6–10" };
  if (goal === "cut") return { sets: 3, reps: "12–15" };
  if (goal === "recomp") return { sets: 3, reps: "8–12" };
  return { sets: 3, reps: "10–12" };
}

/**
 * How many exercises fit in a session of a given length — roughly one working
 * exercise per ten to twelve minutes once warm-up and rest are accounted for.
 * Kept between four and eight so even a short session trains the whole day's
 * muscles and a long one doesn't sprawl past what recovers.
 */
export function exercisesForTime(minutes: number): number {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  if (minutes <= 75) return 7;
  return 8;
}

/**
 * Pulls `count` exercises that hit the day's muscles: a compound to open, then
 * a spread across the remaining muscles. `offset` rotates the picks so a split
 * that repeats (push on day 1 and day 4) does not prescribe the identical
 * session twice.
 */
function pick(muscles: Muscle[], count: number, offset: number, allowed: Set<Equipment>): Exercise[] {
  const pool = (m: Muscle, compound: boolean) =>
    EXERCISES.filter(
      (e) => e.muscle === m && e.compound === compound && !e.custom && allowed.has(e.equipment),
    );

  const chosen: Exercise[] = [];
  const used = new Set<string>();
  const take = (e?: Exercise) => {
    if (e && !used.has(e.id)) {
      used.add(e.id);
      chosen.push(e);
    }
  };

  // Open with a compound for the first muscle.
  const leadPool = pool(muscles[0], true);
  take(leadPool[offset % Math.max(1, leadPool.length)]);

  // Then rotate muscle by muscle, compounds before accessories.
  let round = 0;
  while (chosen.length < count && round < 6) {
    for (const m of muscles) {
      if (chosen.length >= count) break;
      const compoundFirst = round === 0;
      const list = [...pool(m, compoundFirst), ...pool(m, !compoundFirst)];
      take(list[(offset + round) % Math.max(1, list.length)]);
    }
    round += 1;
  }
  return chosen.slice(0, count);
}

export function buildPlan(goal: Goal, days: number, minutes?: number, equipment?: string): Plan {
  const { sets, reps } = volume(goal);
  // Time drives the count when the person told us how long they have; otherwise
  // fall back to a goal-based default (bulk runs a little longer).
  const perDay = minutes ? exercisesForTime(minutes) : goal === "bulk" ? 6 : 5;
  const allowed = new Set(EQUIP_SETS[equipment ?? "gym"] ?? EQUIP_SETS.gym);
  const types = split(days);
  const sessions = types.map((type, i) => ({
    type,
    muscles: DAY_MUSCLES[type],
    exercises: pick(DAY_MUSCLES[type], perDay, i, allowed),
  }));
  return { goal, days: types.length, equipment, minutes, sets, reps, sessions };
}
