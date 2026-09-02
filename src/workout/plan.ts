import { EXERCISES, type Exercise, type Muscle } from "./exercises";
import type { Goal } from "@/kitchen";

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
 * Pulls `count` exercises that hit the day's muscles: a compound to open, then
 * a spread across the remaining muscles. `offset` rotates the picks so a split
 * that repeats (push on day 1 and day 4) does not prescribe the identical
 * session twice.
 */
function pick(muscles: Muscle[], count: number, offset: number): Exercise[] {
  const pool = (m: Muscle, compound: boolean) =>
    EXERCISES.filter((e) => e.muscle === m && e.compound === compound && !e.custom);

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

export function buildPlan(goal: Goal, days: number): Plan {
  const { sets, reps } = volume(goal);
  const perDay = goal === "bulk" ? 6 : 5;
  const types = split(days);
  const sessions = types.map((type, i) => ({
    type,
    muscles: DAY_MUSCLES[type],
    exercises: pick(DAY_MUSCLES[type], perDay, i),
  }));
  return { goal, days: types.length, sets, reps, sessions };
}
