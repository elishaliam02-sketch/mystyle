import { bestOneRepMax, sessionVolume, type SetEntry, type SetLog } from "./sets";

/**
 * A live workout, Hevy-style: the person picks which plan day they are doing,
 * presses start, and the clock runs from that moment. Only the start time is
 * stored — the elapsed figure is always `now - startedAt` — so the timer is
 * right after the app is closed, killed or the phone restarts.
 */
export type ActiveWorkout = {
  /** Plan-day index being trained. */
  day: number;
  /** Epoch ms the workout was started. */
  startedAt: number;
  /** Local date (YYYY-MM-DD) the workout belongs to — its sets live under it. */
  date: string;
};

/** One finished workout, kept for the history list and the calorie math. */
export type WorkoutRecord = {
  id: string;
  date: string;
  day: number;
  /** The plan day's type ("push", "legs"…), for the history label. */
  dayType: string;
  startedAt: number;
  durationSec: number;
  volumeKg: number;
  /** Completed sets. */
  sets: number;
  /** Exercises with at least one completed set. */
  exercises: number;
  /** Exercises whose best estimated 1RM beat every earlier session. */
  prs: number;
  /** Estimated calories burned. */
  kcal: number;
};

/** Longest a single workout can plausibly run; a forgotten timer is capped. */
export const MAX_WORKOUT_SEC = 4 * 3600;
/** How many finished workouts are kept. */
export const MAX_HISTORY = 200;

/** Seconds since the start, never negative and never past the cap. */
export function elapsedSec(startedAt: number, now: number): number {
  return Math.max(0, Math.min(MAX_WORKOUT_SEC, Math.floor((now - startedAt) / 1000)));
}

/** "4:07", "12:30", "1:02:09" — how a workout clock reads. */
export function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "45 min", "1 h 5 min" — a duration in words for summaries. */
export function durationParts(sec: number): { h: number; m: number } {
  const m = Math.max(0, Math.round(sec / 60));
  return { h: Math.floor(m / 60), m: m % 60 };
}

/**
 * Calories a strength session burns: MET x body weight x hours. 5 METs is the
 * Compendium of Physical Activities figure for general resistance training
 * with rests between sets, and it is net of the ~1 MET a person burns sitting,
 * so the result is what training added to the day.
 */
export function strengthKcal(durationSec: number, kg: number): number {
  const hours = Math.min(durationSec, MAX_WORKOUT_SEC) / 3600;
  const weight = kg > 0 ? kg : 70;
  return Math.round((5 - 1) * weight * hours);
}

/** Live figures for the running workout: what the banner shows. An exercise
 * not touched yet counts its prescribed sets, like its table shows. */
export function liveStats(day: Record<string, SetEntry[]> | undefined, ids: string[], prescribed = 0) {
  let sets = 0;
  let total = 0;
  let volume = 0;
  for (const id of ids) {
    const rows = day?.[id] ?? [];
    total += rows.length || prescribed;
    sets += rows.filter((r) => r.done).length;
    volume += sessionVolume(rows);
  }
  return { sets, total, volume };
}

/**
 * The summary a finished workout is saved as. Personal records compare each
 * exercise's best estimated 1RM today against every earlier date's, so a PR is
 * a real one and not just "heavier than last time".
 */
export function summarize(opts: {
  id: string;
  active: ActiveWorkout;
  dayType: string;
  exerciseIds: string[];
  setLog: SetLog;
  endedAt: number;
  kg: number;
}): WorkoutRecord {
  const { active, exerciseIds, setLog } = opts;
  const today = setLog[active.date] ?? {};
  const live = liveStats(today, exerciseIds);
  let exercises = 0;
  let prs = 0;
  for (const id of exerciseIds) {
    const rows = today[id] ?? [];
    if (!rows.some((r) => r.done)) continue;
    exercises++;
    const best = bestOneRepMax(rows);
    if (best <= 0) continue;
    const before = Object.keys(setLog)
      .filter((d) => d < active.date)
      .reduce((m, d) => Math.max(m, bestOneRepMax(setLog[d]?.[id] ?? [])), 0);
    if (before > 0 && best > before) prs++;
  }
  const durationSec = elapsedSec(active.startedAt, opts.endedAt);
  return {
    id: opts.id,
    date: active.date,
    day: active.day,
    dayType: opts.dayType,
    startedAt: active.startedAt,
    durationSec,
    volumeKg: live.volume,
    sets: live.sets,
    exercises,
    prs,
    kcal: strengthKcal(durationSec, opts.kg),
  };
}

/** A stored active workout, or null when it is malformed. */
export function readActive(v: unknown): ActiveWorkout | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (typeof a.day !== "number" || !Number.isInteger(a.day) || a.day < 0 || a.day > 13) return null;
  if (typeof a.startedAt !== "number" || !Number.isFinite(a.startedAt) || a.startedAt <= 0) return null;
  if (typeof a.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) return null;
  return { day: a.day, startedAt: a.startedAt, date: a.date };
}

/** Stored history, dropping anything malformed. */
export function readHistory(v: unknown): WorkoutRecord[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (r): r is WorkoutRecord =>
      !!r &&
      typeof r === "object" &&
      typeof r.id === "string" &&
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      typeof r.durationSec === "number" &&
      Number.isFinite(r.durationSec) &&
      typeof r.volumeKg === "number" &&
      typeof r.sets === "number" &&
      typeof r.kcal === "number",
  );
}

/**
 * Extra calories today's activity earns on top of the weekly target, so the
 * day's number moves with what the person actually did. Half of the estimated
 * burn is added back — the common, conservative rule, because burn estimates
 * run high and the weekly adjustment already corrects the average. Steps count
 * only above a baseline everybody walks anyway (~0.04 kcal per step per 70 kg).
 */
export const STEP_BASELINE = 5000;
export const MAX_ACTIVITY_BONUS = 600;
export function activityBonus(opts: { workoutKcal: number; steps: number; kg: number }) {
  const kg = opts.kg > 0 ? opts.kg : 70;
  const stepBurn = Math.max(0, opts.steps - STEP_BASELINE) * 0.04 * (kg / 70);
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const workout = round10(Math.max(0, opts.workoutKcal) * 0.5);
  const steps = round10(stepBurn * 0.5);
  const total = Math.min(MAX_ACTIVITY_BONUS, workout + steps);
  return { workout, steps, total };
}
