/**
 * One challenge a day, at the difficulty the person picked for themselves.
 *
 * The habits on the Today screen are theirs — written by them, kept for weeks.
 * This is the opposite: something the app puts in front of them that they did
 * not think of, changes every day, and is over by bedtime. It is what stops a
 * routine app becoming a checklist of the same five things, and it is where
 * someone finds out they can do more than they wrote down.
 *
 * The level is chosen once, in the intro, and changed whenever they like. It
 * is a promise about size, not about worthiness: "easy" means a challenge that
 * fits into a normal day with no planning, "hard" means one that has to be
 * arranged for. Someone who picks easy and holds it every day is doing better
 * than someone who picks hard and skips.
 *
 * Pure and offline, like the rest of the coaching layer: the same date and the
 * same level always produce the same challenge, so it cannot change under
 * somebody halfway through the day, and every device agrees without asking a
 * server.
 */

import { POINTS, type Difficulty } from "@/tasks/difficulty";

/** What a challenge asks of a person — picks its icon and its colour. */
export type ChallengeKind = "move" | "food" | "water" | "mind" | "sleep" | "strength";

export type Challenge = {
  /** Stable id; the completion is stored against it. */
  id: string;
  level: Difficulty;
  kind: ChallengeKind;
  /** What finishing it pays, a little over a habit of the same level. */
  points: number;
};

/**
 * The pool, by level. Ids only: the words live in `src/i18n`, like every other
 * user-facing string, so both languages stay in step and a translation cannot
 * quietly go missing.
 *
 * Every entry has to be doable by someone with no equipment, no gym and no
 * money, because the person who most needs a nudge is usually the one with the
 * fewest of those. Nothing here is a weigh-in, a calorie cut or a rule about
 * avoiding a food — a daily dare is the wrong place for any of that.
 */
const POOL: Record<Difficulty, { id: string; kind: ChallengeKind }[]> = {
  easy: [
    { id: "stairs", kind: "move" },
    { id: "walk10", kind: "move" },
    { id: "waterExtra", kind: "water" },
    { id: "vegLunch", kind: "food" },
    { id: "stretch5", kind: "mind" },
    { id: "phoneDown", kind: "mind" },
    { id: "breakfastProtein", kind: "food" },
    { id: "screensOffBed", kind: "sleep" },
    { id: "squats20", kind: "strength" },
    { id: "walkCall", kind: "move" },
    { id: "plank30", kind: "strength" },
    { id: "fruitSwap", kind: "food" },
  ],
  moderate: [
    { id: "walk30", kind: "move" },
    { id: "pushups40", kind: "strength" },
    { id: "cookHome", kind: "food" },
    { id: "waterFull", kind: "water" },
    { id: "noLift", kind: "move" },
    { id: "meditate10", kind: "mind" },
    { id: "steps8k", kind: "move" },
    { id: "squats60", kind: "strength" },
    { id: "sleepEarly", kind: "sleep" },
    { id: "proteinEveryMeal", kind: "food" },
    { id: "bike20", kind: "move" },
    { id: "core10", kind: "strength" },
  ],
  hard: [
    { id: "run5k", kind: "move" },
    { id: "steps12k", kind: "move" },
    { id: "pushups100", kind: "strength" },
    { id: "gymFull", kind: "strength" },
    { id: "swim30", kind: "move" },
    { id: "cookAll", kind: "food" },
    { id: "hillWalk", kind: "move" },
    { id: "noScreenEvening", kind: "mind" },
    { id: "sleep8", kind: "sleep" },
    { id: "runMorning", kind: "move" },
    { id: "burpees50", kind: "strength" },
    { id: "doubleSession", kind: "strength" },
  ],
};

/** A challenge pays a little over a habit of the same level — it is new work. */
export const CHALLENGE_BONUS = 5;

/**
 * A stable number from a string. Small, boring and identical on every device —
 * `Math.random` would hand two phones different challenges on the same day,
 * and a date's own arithmetic clusters badly over a short pool.
 */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * The challenge for a given day and level.
 *
 * `salt` is the device's own — the same one the kitchen's meal rotation uses —
 * so two people at the same level on the same day are not handed the same
 * dare, which would make the whole thing feel like a broadcast rather than a
 * coach.
 */
export function challengeFor(date: string, level: Difficulty, salt = ""): Challenge {
  const pool = POOL[level];
  const pick = pool[hash(`${date}|${level}|${salt}`) % pool.length];
  return { id: pick.id, level, kind: pick.kind, points: POINTS[level] + CHALLENGE_BONUS };
}

/** Every challenge id, for the string table's typed contract and for tests. */
export function allChallengeIds(): string[] {
  return Object.values(POOL).flatMap((list) => list.map((c) => c.id));
}

/** How many distinct challenges a level offers before it has to repeat. */
export function poolSize(level: Difficulty): number {
  return POOL[level].length;
}
