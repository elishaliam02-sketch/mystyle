/**
 * Deciding what to remind someone about.
 *
 * Kept pure and away from expo-notifications so the judgement calls are
 * testable: which nudges a person gets, at what hour, and — the part that
 * decides whether an app stays unmuted — which ones they *don't*.
 *
 * The rule throughout is that a reminder is earned by use. Someone who has
 * never logged a glass of water does not want a water reminder; someone with
 * no training plan does not want to be told to train. Every nudge here is
 * switched on by evidence that the person actually uses that part of the app,
 * and the total is capped, because the fastest way to lose notifications
 * permission is to spend it.
 */
import type { AppState } from "@/store/types";

export type Reminder = {
  /** Stable id, so a schedule can be compared in a test. */
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** 1 = Sunday … 7 = Saturday. Absent means every day. */
  weekday?: number;
};

export type ReminderCopy = {
  slotTitle: string;
  recapTitle: string;
  recapBody: string;
  trainTitle: string;
  trainBody: string;
  waterTitle: string;
  waterBody: string;
  foodTitle: string;
  foodBody: string;
  stepsTitle: string;
  stepsBody: string;
  weighTitle: string;
  weighBody: string;
  measureTitle: string;
  measureBody: string;
};

/** When each part of the day fires, in local time. */
export const SLOT_HOUR = { morning: 8, noon: 13, evening: 19 } as const;
/** Habits with no time of day ride with the morning group. */
export const DEFAULT_HOUR = 9;

/**
 * No more than this many reminders a day, however much of the app someone
 * uses. Past roughly this, people turn the whole lot off — and then get none
 * of them, including the one that would have helped.
 */
export const MAX_DAILY = 6;

/**
 * Which weekdays a plan's sessions land on — 1 = Sunday … 7 = Saturday.
 *
 * A plan says how many days a week, not which ones, so the reminder has to
 * choose. It spreads them as evenly as the week allows and starts on Sunday
 * (the Israeli working week), which puts rest days between sessions instead of
 * stacking them — and, more to the point, gives somebody a reason to believe
 * the notification knows what day it is.
 */
export function trainingWeekdays(days: number): number[] {
  const count = Math.max(1, Math.min(7, Math.round(days)));
  if (count >= 7) return [1, 2, 3, 4, 5, 6, 7];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // Evenly spaced across seven slots, rounded to whole days, deduplicated by
    // construction because the step is always at least one.
    out.push(1 + Math.round((i * 7) / count));
  }
  return [...new Set(out.map((d) => (d > 7 ? d - 7 : d)))].sort((a, b) => a - b);
}

/** Has this person used a part of the app enough to want reminding about it? */
function used(map: Record<string, unknown> | undefined, days = 1): boolean {
  return Object.keys(map ?? {}).length >= days;
}

/**
 * The full schedule for a state. Daily reminders first, in the order they fire;
 * weekly ones after. Deterministic — the same state always yields the same
 * list, which is what lets `reschedule` rebuild it from scratch every time.
 */
export function planReminders(state: AppState, copy: ReminderCopy): Reminder[] {
  const daily: Reminder[] = [];
  const weekly: Reminder[] = [];

  // habits, grouped by part of the day — one nudge per group, not per habit
  const active = state.habits.filter((h) => !h.archived);
  const groups = new Map<number, string[]>();
  for (const habit of active) {
    const hour = habit.slot ? SLOT_HOUR[habit.slot] : DEFAULT_HOUR;
    groups.set(hour, [...(groups.get(hour) ?? []), habit.title]);
  }
  for (const [hour, titles] of [...groups].sort((a, b) => a[0] - b[0])) {
    daily.push({
      id: `habits-${hour}`,
      hour,
      minute: 0,
      title: copy.slotTitle.replace("{count}", String(titles.length)),
      body: titles.join(" · ").slice(0, 140),
    });
  }

  // the food diary — only for someone who has actually logged a meal
  if (used(state.intake)) {
    daily.push({ id: "food", hour: 12, minute: 30, title: copy.foodTitle, body: copy.foodBody });
  }

  // water, mid-afternoon, when there is still time to catch up
  if (used(state.water) || used(state.waterMl)) {
    daily.push({ id: "water", hour: 15, minute: 0, title: copy.waterTitle, body: copy.waterBody });
  }

  // Training, early evening — before the gym closes and before the sofa wins.
  // One reminder per training day rather than one every day: being told to
  // train on a rest day teaches people that the reminder is not worth reading,
  // and then the one that mattered gets swiped away with the rest.
  if (state.training) {
    for (const weekday of trainingWeekdays(state.training.days)) {
      weekly.push({
        id: `train-${weekday}`,
        hour: 17,
        minute: 30,
        weekday,
        title: copy.trainTitle,
        body: copy.trainBody,
      });
    }
  }

  // steps, with an hour or two left in the day to fix it
  if (used(state.steps)) {
    daily.push({ id: "steps", hour: 19, minute: 30, title: copy.stepsTitle, body: copy.stepsBody });
  }

  // the day's recap, last
  daily.push({ id: "recap", hour: 21, minute: 30, title: copy.recapTitle, body: copy.recapBody });

  // a weekly weigh-in, Sunday morning — the same day and the same conditions
  // each week is the only way a scale reading means anything
  if (state.weighIns.length > 0 || state.profile.goalKg) {
    weekly.push({
      id: "weigh",
      hour: 8,
      minute: 30,
      weekday: 1,
      title: copy.weighTitle,
      body: copy.weighBody,
    });
  }

  // the tape measure, once a fortnight's worth of nagging is too much — weekly
  // on a different day, for someone who has taken a measurement before
  if (used(state.measurements)) {
    weekly.push({
      id: "measure",
      hour: 9,
      minute: 0,
      weekday: 4,
      title: copy.measureTitle,
      body: copy.measureBody,
    });
  }

  // If the day is crowded, the recap is the one that survives — it is the only
  // reminder that looks back rather than asking for something.
  const trimmed =
    daily.length <= MAX_DAILY
      ? daily
      : [...daily.filter((r) => r.id !== "recap").slice(0, MAX_DAILY - 1), daily[daily.length - 1]!];

  return [...trimmed.sort((a, b) => a.hour - b.hour || a.minute - b.minute), ...weekly];
}
