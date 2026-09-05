import { EXERCISES, type Equipment, type Exercise, type Muscle } from "./exercises";
import type { Goal } from "@/kitchen";

/** What equipment the person can train with — drives which moves a plan uses. */
export const EQUIP_SETS: Record<string, Equipment[]> = {
  gym: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "smith", "band"],
  home: ["dumbbell", "kettlebell", "bodyweight", "band"],
  bodyweight: ["bodyweight"],
};

/**
 * A small stable number from a string, well mixed. This is what makes a plan
 * *this person's* plan: fold a per-device salt into the exercise rotation and
 * two people with the same goal, days and kit get different — but equally
 * valid — sessions, instead of the one identical plan everybody used to get.
 * The final avalanche matters; without it a one-character change to the seed
 * barely moves the result.
 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0);
}

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
 * How the goal tilts what a session is built from. Bulk leans on compounds
 * (the heavy multi-joint lifts that add mass); cut spends more of the session
 * on accessories and machines the higher-rep work suits; recomp and maintain
 * sit in between. This is what makes switching goal change the *exercises*, not
 * only the set-and-rep numbers underneath them.
 */
function compoundBias(goal: Goal): number {
  if (goal === "bulk") return 0.75;
  if (goal === "cut") return 0.35;
  return 0.55;
}

/**
 * Pulls `count` exercises that hit the day's muscles: a compound to open, then
 * a spread across the remaining muscles. `seed` (a per-device, per-goal,
 * per-day number) rotates the picks, so the same inputs give one person a
 * different — but equally valid — session from the next, and switching goal
 * reshuffles them too.
 */
function pick(
  muscles: Muscle[],
  count: number,
  seed: number,
  allowed: Set<Equipment>,
  bias: number,
): Exercise[] {
  const pool = (m: Muscle, compound: boolean) =>
    EXERCISES.filter(
      (e) => e.muscle === m && e.compound === compound && !e.custom && allowed.has(e.equipment),
    );
  const at = (list: Exercise[], salt: number) =>
    list.length ? list[hash(`${seed}:${salt}`) % list.length]! : undefined;

  const chosen: Exercise[] = [];
  const used = new Set<string>();
  const take = (e?: Exercise) => {
    if (e && !used.has(e.id)) {
      used.add(e.id);
      chosen.push(e);
      return true;
    }
    return false;
  };

  // How many of the slots should be compound lifts, from the goal's bias. Bulk
  // (0.75) fills most of the session with the heavy multi-joint lifts; cut
  // (0.35) spends most of it on accessories the higher-rep work suits. The lead
  // is always a compound, so the session opens on a big lift regardless.
  let compoundBudget = Math.max(1, Math.round(bias * count));

  // Open with a compound for the lead muscle (a focus muscle when set).
  if (take(at(pool(muscles[0]!, true), 1))) compoundBudget -= 1;

  // Fill the rest, muscle by muscle, spending the compound budget first and
  // then accessories — so the compound share tracks the goal, and the seed
  // decides the exact moves within each category.
  let round = 0;
  while (chosen.length < count && round < 12) {
    for (let mi = 0; mi < muscles.length && chosen.length < count; mi++) {
      const m = muscles[mi]!;
      const wantCompound = compoundBudget > 0;
      const primary = pool(m, wantCompound);
      const salt = round * 31 + mi;
      if (take(at(primary, salt))) {
        if (wantCompound) compoundBudget -= 1;
      } else if (take(at(pool(m, !wantCompound), salt))) {
        // fell back to the other category because this one was exhausted
      }
    }
    round += 1;
  }
  return chosen.slice(0, count);
}

export type PlanOptions = {
  /** A per-device salt, so the plan is this person's and not everyone's. */
  seed?: string;
  /** Muscles the person wants extra work on — a random plan can lead with the
   * lagging ones instead of always the day's default. */
  focus?: Muscle[];
};

/**
 * The day's muscles, with any focus muscle this session trains pulled to the
 * front (so it gets the opening compound and the most volume) and given a
 * second slot at the end. A focus muscle a given day does not train is ignored
 * — leg day does not suddenly grow biceps.
 */
function orderMuscles(base: Muscle[], focus: Muscle[]): Muscle[] {
  const wanted = focus.filter((m) => base.includes(m));
  if (wanted.length === 0) return base;
  const rest = base.filter((m) => !wanted.includes(m));
  // focus first (extra volume), the rest, then focus again as an accessory
  return [...wanted, ...rest, ...wanted];
}

/** A day's hand-made edits: exercises the person added and removed by hand. */
export type DayEdit = { add?: string[]; remove?: string[] };

/**
 * Applies a person's per-day edits on top of a day's exercises — the Hevy-style
 * "this is my plan now" layer. Removed moves drop out; added moves join the end,
 * de-duplicated. `base` is the generated day (or an empty list for a day the
 * person is building from scratch). Pure, so it is the same on every screen and
 * in the tests.
 */
export function applyDayEdits(
  base: Exercise[],
  edit: DayEdit | undefined,
  byId: (id: string) => Exercise | undefined,
): Exercise[] {
  const removed = new Set(edit?.remove ?? []);
  const kept = base.filter((e) => !removed.has(e.id));
  const seen = new Set(kept.map((e) => e.id));
  const added: Exercise[] = [];
  for (const id of edit?.add ?? []) {
    if (seen.has(id)) continue;
    const ex = byId(id);
    if (ex) {
      added.push(ex);
      seen.add(id);
    }
  }
  return [...kept, ...added];
}

export function buildPlan(
  goal: Goal,
  days: number,
  minutes?: number,
  equipment?: string,
  opts: PlanOptions = {},
): Plan {
  const { sets, reps } = volume(goal);
  // Time drives the count when the person told us how long they have; otherwise
  // fall back to a goal-based default (bulk runs a little longer).
  const perDay = minutes ? exercisesForTime(minutes) : goal === "bulk" ? 6 : 5;
  const allowed = new Set(EQUIP_SETS[equipment ?? "gym"] ?? EQUIP_SETS.gym);
  const bias = compoundBias(goal);
  const focus = opts.focus ?? [];
  const salt = opts.seed ?? "";
  const types = split(days);
  const sessions = types.map((type, i) => {
    const muscles = orderMuscles(DAY_MUSCLES[type], focus);
    // The seed carries the salt, the goal and which day this is, so every knob
    // the person can turn actually reshapes the session.
    const seed = hash(`${salt}|${goal}|${type}|${i}`);
    return { type, muscles: DAY_MUSCLES[type], exercises: pick(muscles, perDay, seed, allowed, bias) };
  });
  return { goal, days: types.length, equipment, minutes, sets, reps, sessions };
}
