import type { Goal } from "@/kitchen";
import type { Exercise } from "@/workout/exercises";

/** The training plan config and log, device-local like the pantry. */
export type Training = {
  goal: Goal;
  /** How many days a week the plan spans. */
  days: number;
  /** How long one session runs, in minutes. Undefined for plans built before
   * duration was a criterion — the plan then falls back to a goal-based size. */
  minutes?: number;
  /** Which equipment the plan is built for: "gym" | "home" | "bodyweight". */
  equipment?: string;
  /** Weight lifted per exercise over time (exercise id → readings), so each
   * session can show what was moved last time — progressive overload. */
  weights?: Record<string, { date: string; kg: number }[]>;
  /** Local date (YYYY-MM-DD) → ids of exercises ticked that day. */
  log: Record<string, string[]>;
  /** The person's own manually-added moves. */
  custom: Exercise[];
};

/** One thing eaten and logged against the day's target. */
export type IntakeItem = {
  id: string;
  label: string;
  kcal: number;
  protein: number;
};

export type Habit = {
  id: string;
  title: string;
  /** Rough time of day, chosen from chips. Undefined means "whenever". */
  slot?: "morning" | "noon" | "evening";
  /** The existing routine this habit hangs off — "after I brush my teeth". */
  anchor?: string;
  createdAt: string;
  archived: boolean;
  /** When this habit was last edited on any device, ISO 8601. */
  updatedAt?: string;
};

/**
 * One habit on one day, with its state written down rather than implied by the
 * row existing. Presence-as-truth could not express "I unticked this": the row
 * simply vanished locally and the server's copy brought it back on the next
 * sync. An explicit `done`, with a timestamp, makes unticking a change like
 * any other.
 */
export type Completion = {
  habitId: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  done: boolean;
  updatedAt: string;
};

export type WeighIn = {
  date: string;
  kg: number;
  updatedAt: string;
};

export type CheckIn = {
  date: string;
  mood: "good" | "ok" | "hard";
  note: string;
  updatedAt: string;
};

export type Profile = {
  name: string;
  startKg?: number;
  goalKg?: number;
  onboarded: boolean;
  /** Whether daily reminders are scheduled on this device. */
  reminders?: boolean;
  updatedAt?: string;
};

export type AppState = {
  profile: Profile;
  habits: Habit[];
  completions: Completion[];
  weighIns: WeighIn[];
  checkIns: CheckIn[];
  /**
   * How far the server had got, in *its* clock, when this device last pulled.
   * The next pull asks for everything after it. Server time, not ours: a
   * device that was offline for a week writes rows stamped a week ago, and a
   * device filtering by its own clock would never see them.
   */
  lastSyncAt?: string;
  /**
   * When this device last pushed, in *its own* clock — the stamps on its rows
   * come from the same clock, so this is the only honest way to ask "what have
   * I changed since?".
   */
  lastPushAt?: string;
  /**
   * The groceries the person keeps around, as they typed them. One free-text
   * blob rather than a parsed list: the kitchen reads the whole thing, the way
   * someone actually writes a shopping list. Device-local for now — it rides
   * through a sync untouched because mergeState carries local fields it does
   * not own, but it is never sent to the server.
   */
  pantry?: string;
  /**
   * The furthest instant in time the app has ever observed, in device-clock
   * milliseconds. "Today" for anything that feeds a streak is read as never
   * before this, so winding the phone's clock back cannot manufacture a fresh
   * day. Device-local; the server holds the real record.
   */
  clockHighWaterMs?: number;
  /**
   * The training plan and its day-by-day log. Device-local like the pantry —
   * it rides through a sync untouched (mergeState keeps local fields) and is
   * never sent to the server.
   */
  training?: Training;
  /** What was eaten each day (YYYY-MM-DD → items), for the daily food log. */
  intake?: Record<string, IntakeItem[]>;
  /** Glasses of water logged each day (YYYY-MM-DD → count). */
  water?: Record<string, number>;
  /** Tape-measure readings per body part (part id → readings over time). */
  measurements?: Record<string, { date: string; cm: number }[]>;
  /** The nutrition goal the kitchen was last set to, so it is remembered
   * across opens and the Today hub can read a calorie target from it. */
  nutritionGoal?: Goal;
  /** The kitchen's dietary filter ("all" | "kosher" | "vegetarian"), remembered. */
  dietFilter?: string;
  /** Meal ids the person starred, so a dish they love is one tap away. */
  favorites?: string[];
};

export const EMPTY_STATE: AppState = {
  // Stamped at the epoch rather than left blank: an undefined timestamp reads
  // as "newer than anything", which would make a fresh install's blank profile
  // outrank the real one waiting on the server.
  profile: { name: "", onboarded: false, updatedAt: "1970-01-01T00:00:00.000Z" },
  habits: [],
  completions: [],
  weighIns: [],
  checkIns: [],
};

/** Local calendar date as YYYY-MM-DD — never UTC, or a 22:00 tick lands on tomorrow. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function now(): string {
  return new Date().toISOString();
}

/**
 * Brings a stored state up to the current shape. Data written by an earlier
 * build has completions with no `done` (their presence meant done) and rows
 * with no timestamp; without this they would be dropped or, worse, treated as
 * newer than everything on the server.
 */
export function migrateState(raw: unknown): AppState {
  if (typeof raw !== "object" || raw === null) return EMPTY_STATE;
  const s = raw as Partial<AppState> & { completions?: unknown[] };
  const EPOCH = "1970-01-01T00:00:00.000Z";

  return {
    // Untimed rows are stamped at the epoch rather than left blank: an
    // undefined timestamp reads as "newer than anything", so it would both
    // beat a real edit from another device and re-upload on every sync.
    profile: {
      ...EMPTY_STATE.profile,
      ...(s.profile ?? {}),
      updatedAt: s.profile?.updatedAt ?? EPOCH,
    },
    habits: (s.habits ?? []).map((h) => ({ ...h, updatedAt: h.updatedAt ?? EPOCH })),
    completions: (s.completions ?? []).map((c) => {
      const row = c as Partial<Completion>;
      return {
        habitId: String(row.habitId ?? ""),
        date: String(row.date ?? ""),
        // A row written by the old build existed only when it was done.
        done: row.done ?? true,
        updatedAt: row.updatedAt ?? EPOCH,
      };
    }).filter((c) => c.habitId && c.date),
    weighIns: (s.weighIns ?? []).map((w) => ({ ...w, updatedAt: w.updatedAt ?? EPOCH })),
    checkIns: (s.checkIns ?? []).map((c) => ({ ...c, updatedAt: c.updatedAt ?? EPOCH })),
    lastSyncAt: s.lastSyncAt,
    lastPushAt: s.lastPushAt,
    pantry: s.pantry,
    clockHighWaterMs: s.clockHighWaterMs,
    training: s.training,
    intake: s.intake,
    water: s.water,
    measurements: s.measurements,
    nutritionGoal: s.nutritionGoal,
    dietFilter: s.dietFilter,
    favorites: s.favorites,
  };
}
