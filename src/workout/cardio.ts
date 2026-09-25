/**
 * The cardio prescription — the half of a physique the weights room does not
 * cover, and the piece the app was missing.
 *
 * It is built from the goal first (a cut needs real conditioning; a bulk needs
 * just enough to stay healthy without eating the surplus) and then rolled from
 * a per-device seed, so two people chasing the same goal are handed different
 * modalities and it feels like their plan, not a leaflet. Pure and testable —
 * no clock, no store.
 */
import { EXERCISES, type Exercise } from "./exercises";
import type { Goal } from "@/kitchen";
import type { Level } from "./difficulty";

export type CardioStyle = "steady" | "interval";

export type CardioSession = {
  /** The exercise id from the library, so the demo video resolves for it. */
  exerciseId: string;
  he: string;
  en: string;
  style: CardioStyle;
  minutes: number;
};

export type CardioPlan = {
  goal: Goal;
  /** How many cardio sessions a week the goal calls for. */
  perWeek: number;
  /** The sessions themselves, already chosen — one per weekly slot. */
  sessions: CardioSession[];
  /** A one-line "why", so the number is not mysterious. */
  he: string;
  en: string;
};

/** How much conditioning each goal wants, and of what flavour. */
type Shape = { perWeek: number; steady: number; interval: number; minLow: number; minHigh: number };

function shape(goal: Goal): Shape {
  switch (goal) {
    // Cutting: the most conditioning, a mix of long steady work for the burn and
    // short intervals for the afterburn.
    case "cut": return { perWeek: 4, steady: 2, interval: 2, minLow: 30, minHigh: 40 };
    // Recomp: moderate — enough to stay lean while building.
    case "recomp": return { perWeek: 3, steady: 2, interval: 1, minLow: 20, minHigh: 30 };
    // Maintenance: keep the engine, no agenda.
    case "maintain": return { perWeek: 2, steady: 2, interval: 0, minLow: 20, minHigh: 30 };
    // Bulk: the least — a little easy cardio for the heart, nothing that eats
    // the surplus you are trying to grow on.
    default: return { perWeek: 2, steady: 2, interval: 0, minLow: 15, minHigh: 20 };
  }
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Cardio moves that suit steady work vs the ones that suit hard intervals. */
const STEADY = ["incline-walk", "stationary-bike", "elliptical", "treadmill-run", "rowing-machine", "stair-master", "swimming"];
const INTERVAL = ["sprint-intervals", "assault-bike", "ski-erg", "battle-ropes", "jump-rope", "box-jump", "rowing-machine"];
/** Without a gym: the street, a rope and the floor — never a treadmill. */
const STEADY_HOME = ["brisk-walk", "easy-run", "jump-rope", "swimming"];
const INTERVAL_HOME = ["sprint-intervals", "jump-rope", "burpee", "mountain-climber"];

function findEx(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/**
 * A cardio plan for a goal and a person. The same goal and seed always give the
 * same plan (so it is stable across opens); a different seed, or a different
 * goal, gives a different one.
 */
export function cardioPlan(goal: Goal, seed = "", level?: Level, equipment = "gym"): CardioPlan {
  const gym = equipment === "gym";
  const base = shape(goal);
  // A beginner builds the base first: the interval slots become steady work,
  // and the sessions start at the short end. Intervals on an assault bike in
  // week one are how people decide cardio is not for them.
  const sh =
    level === "beginner"
      ? { ...base, steady: base.steady + base.interval, interval: 0, minHigh: base.minLow }
      : base;
  const sessions: CardioSession[] = [];
  const usedForVariety: string[] = [];

  const pickFrom = (ids: string[], style: CardioStyle, slot: number): void => {
    // rotate the list by the seed so different people lead with different kit,
    // and step through it so one plan does not repeat the same machine
    const start = hash(`${seed}|${goal}|${style}|${slot}`) % ids.length;
    for (let k = 0; k < ids.length; k++) {
      const id = ids[(start + k) % ids.length]!;
      if (usedForVariety.includes(id) && usedForVariety.length < ids.length) continue;
      const ex = findEx(id);
      if (!ex) continue;
      usedForVariety.push(id);
      // Hard intervals are short: 12–20 minutes including the easy parts,
      // not the 30–40 of a steady session.
      const lo = style === "interval" ? 12 : sh.minLow;
      const hi = style === "interval" ? 20 : sh.minHigh;
      const minutes = lo + (hash(`${seed}|${id}|${slot}`) % (hi - lo + 1));
      sessions.push({ exerciseId: id, he: ex.he, en: ex.en, style, minutes });
      return;
    }
  };

  for (let i = 0; i < sh.steady; i++) pickFrom(gym ? STEADY : STEADY_HOME, "steady", i);
  for (let i = 0; i < sh.interval; i++) pickFrom(gym ? INTERVAL : INTERVAL_HOME, "interval", i);

  return {
    goal,
    perWeek: sh.perWeek,
    sessions,
    he: HE_NOTE[goal],
    en: EN_NOTE[goal],
  };
}

const HE_NOTE: Record<Goal, string> = {
  cut: "בחיטוב האירובי עושה חצי מהעבודה — שילוב של קצב קבוע לשריפה ואינטרוולים לאפטרברן.",
  recomp: "במיצוק מספיק אירובי מתון כדי להישאר רזה בזמן שבונים.",
  maintain: "לשמירה — קצת אירובי קבוע כדי לשמור על הלב והכושר.",
  bulk: "במסה מעט אירובי קליל בלבד — מספיק לבריאות, בלי לאכול את העודף.",
};
const EN_NOTE: Record<Goal, string> = {
  cut: "On a cut, cardio does half the work — steady for the burn, intervals for the afterburn.",
  recomp: "Recomp wants just enough steady cardio to stay lean while you build.",
  maintain: "Maintaining — a little regular cardio to keep the engine and the heart.",
  bulk: "Bulking takes the least — easy cardio for health, nothing that eats the surplus.",
};
