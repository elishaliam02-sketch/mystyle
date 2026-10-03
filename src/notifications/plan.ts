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
import { defaultGoalMl, goalMlOf, waterMlLog } from "@/health/water";
import { DEFAULT_STEP_GOAL } from "@/health/steps";

export type Reminder = {
  /** Stable id, so a schedule can be compared in a test. */
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** 1 = Sunday … 7 = Saturday. Absent means every day. */
  weekday?: number;
  /** For a habit group: the habits it is about, so today's copy can drop the
   * ones already ticked. */
  habitIds?: string[];
};

export type ReminderCopy = {
  slotTitle: string;
  /** The title when only one habit is waiting — "1 things" reads as a bug. */
  slotOneTitle: string;
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

function slotTitle(copy: ReminderCopy, count: number): string {
  return count === 1 ? copy.slotOneTitle : copy.slotTitle.replace("{count}", String(count));
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
  const ids = new Map<number, string[]>();
  for (const habit of active) {
    const hour = habit.slot ? SLOT_HOUR[habit.slot] : DEFAULT_HOUR;
    groups.set(hour, [...(groups.get(hour) ?? []), habit.title]);
    ids.set(hour, [...(ids.get(hour) ?? []), habit.id]);
  }
  for (const [hour, titles] of [...groups].sort((a, b) => a[0] - b[0])) {
    daily.push({
      id: `habits-${hour}`,
      hour,
      minute: 0,
      title: slotTitle(copy, titles.length),
      body: titles.join(" · ").slice(0, 140),
      habitIds: ids.get(hour),
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

/** One reminder on one date — what is actually handed to the phone. */
export type DatedReminder = {
  /** Template id and local date, e.g. "water@2026-10-03". */
  id: string;
  at: Date;
  title: string;
  body: string;
};

/**
 * How many reminders are written ahead. iOS keeps the 64 soonest and drops the
 * rest without a word, so this stays under it with room to spare.
 */
export const MAX_PENDING = 60;
/** How many days ahead the schedule reaches, at most. */
export const HORIZON_DAYS = 21;

/** Local YYYY-MM-DD for a date — never UTC, or an evening reminder lands on tomorrow. */
export function localKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Today's version of a reminder, or null when there is nothing left to remind
 * about. A "drink water" after the bottle is already full, or "how was your
 * day" after the recap is written, teaches people that the notification is
 * not worth reading — and then the one that mattered is swiped away unread.
 */
function forToday(state: AppState, r: Reminder, date: string, copy: ReminderCopy): { title: string; body: string } | null {
  if (r.habitIds) {
    const done = new Set(
      state.completions.filter((c) => c.date === date && c.done).map((c) => c.habitId),
    );
    const left = state.habits.filter((h) => r.habitIds!.includes(h.id) && !h.archived && !done.has(h.id));
    if (left.length === 0) return null;
    return {
      title: slotTitle(copy, left.length),
      body: left.map((h) => h.title).join(" · ").slice(0, 140),
    };
  }
  const keep = { title: r.title, body: r.body };
  if (r.id === "food") return (state.intake?.[date]?.length ?? 0) > 0 ? null : keep;
  if (r.id === "water") {
    const drunk = waterMlLog(state)[date] ?? 0;
    const latest = [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).pop();
    const goal = goalMlOf(state) ?? defaultGoalMl(latest?.kg ?? state.profile.startKg);
    return drunk >= goal ? null : keep;
  }
  if (r.id.startsWith("train-")) {
    const ticked = (state.training?.log?.[date]?.length ?? 0) > 0;
    const sets = Object.values(state.training?.setLog?.[date] ?? {}).some((list) => list.some((x) => x.done));
    return ticked || sets ? null : keep;
  }
  if (r.id === "steps") {
    return (state.steps?.[date] ?? 0) >= (state.stepGoal ?? DEFAULT_STEP_GOAL) ? null : keep;
  }
  if (r.id === "recap") return state.checkIns.some((c) => c.date === date) ? null : keep;
  if (r.id === "weigh") return state.weighIns.some((w) => w.date === date) ? null : keep;
  if (r.id === "measure") {
    return Object.values(state.measurements ?? {}).some((list) => list.some((m) => m.date === date))
      ? null
      : keep;
  }
  return keep;
}

/**
 * The schedule as dated, one-off reminders rather than repeating ones.
 *
 * A repeating "every day at 15:00" cannot know that today's water is already
 * drunk; a reminder written for today's date can simply not be written. So the
 * schedule is laid out day by day from now, today's entries checked against
 * what has been done, and rebuilt whenever that changes or the app is opened.
 * Someone who stops opening the app gets the reminders already written and
 * then quiet — about three weeks for a light user, a week and a bit for
 * someone using everything — rather than the same nudge forever.
 */
export function datedReminders(state: AppState, copy: ReminderCopy, now: Date): DatedReminder[] {
  const plan = planReminders(state, copy);
  const out: DatedReminder[] = [];
  for (let d = 0; d < HORIZON_DAYS; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const date = localKey(day);
    const weekday = day.getDay() + 1;
    for (const r of plan) {
      if (r.weekday !== undefined && r.weekday !== weekday) continue;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), r.hour, r.minute);
      if (at.getTime() <= now.getTime()) continue;
      const text = d === 0 ? forToday(state, r, date, copy) : { title: r.title, body: r.body };
      if (!text) continue;
      out.push({ id: `${r.id}@${date}`, at, ...text });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_PENDING);
}

/** Every identifier this app writes starts with this, so a diff never touches anyone else's. */
export const ID_PREFIX = "apex:";

/**
 * The identifier a reminder is scheduled under. It carries a short hash of the
 * words, so a renamed habit or a switched language reads as a different
 * reminder and is rewritten, while an unchanged one is left alone.
 */
export function identifierOf(r: DatedReminder): string {
  let h = 2166136261;
  for (const ch of `${r.title}\n${r.body}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${ID_PREFIX}${r.id}#${h.toString(36)}`;
}

/**
 * What to cancel and what to add to turn the phone's schedule into the wanted
 * one. Ticking one habit then cancels one notification, instead of tearing
 * down and rewriting sixty. Anything already pending that is not wanted goes —
 * including the repeating reminders older builds wrote, which carry no prefix.
 */
export function diffSchedule(pending: string[], want: DatedReminder[]): { cancel: string[]; add: DatedReminder[] } {
  const wanted = new Map(want.map((r) => [identifierOf(r), r]));
  const have = new Set(pending);
  return {
    cancel: pending.filter((id) => !wanted.has(id)),
    add: [...wanted].filter(([id]) => !have.has(id)).map(([, r]) => r),
  };
}

/** Where tapping a reminder takes the person: the screen it is asking about. */
export function routeOf(id: string): string {
  const base = id.split("@")[0]!;
  if (base.startsWith("habits-")) return "/";
  if (base.startsWith("train-")) return "/workout";
  const routes: Record<string, string> = {
    food: "/kitchen",
    water: "/water",
    steps: "/progress",
    recap: "/checkin",
    weigh: "/progress",
    measure: "/progress",
  };
  return routes[base] ?? "/";
}

/** "today 15:00", "tomorrow 08:30", "Sunday 08:30" — when the next one fires. */
export function whenLabel(
  at: Date,
  now: Date,
  names: { today: string; tomorrow: string; weekdays: readonly string[] },
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day1 = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  const days = Math.round((day1 - day0) / 86400000);
  const label = days <= 0 ? names.today : days === 1 ? names.tomorrow : names.weekdays[at.getDay()]!;
  return `${label} ${time}`;
}
