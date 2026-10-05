/**
 * The one setup step most worth offering on the home screen, if any.
 *
 * The features that keep someone coming back — reminders, and a backup so a
 * new phone does not mean starting over — sat in the profile screen, where
 * hardly anyone went looking. This picks the next one to offer, one at a
 * time, and lets "not now" mean not now: a step put aside comes back after
 * two weeks if it still applies.
 */

export type SetupStep = "install" | "reminders" | "backup";

export const SNOOZE_DAYS = 14;
/** Days of use before backup is worth bringing up — there is something to lose. */
export const BACKUP_AFTER_DAYS = 3;

export type SetupInput = {
  /** Running in a browser rather than the phone app. */
  web: boolean;
  /** For the browser: can it take reminders, or only once installed? */
  webSupport: "ok" | "install" | "no";
  /** For the phone app: can it schedule notifications at all? */
  nativeReminders: boolean;
  remindersOn: boolean;
  cloudOn: boolean;
  /** Distinct days with anything logged. */
  daysUsed: number;
  /** Step → when it was put aside (ISO). */
  snoozed: Record<string, string>;
  now: Date;
};

function resting(step: SetupStep, i: SetupInput): boolean {
  const at = i.snoozed[step];
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && i.now.getTime() - t < SNOOZE_DAYS * 86_400_000;
}

export function nextSetup(i: SetupInput): SetupStep | null {
  const canRemind = i.web ? i.webSupport === "ok" : i.nativeReminders;
  const steps: [SetupStep, boolean][] = [
    // An iPhone in a Safari tab: nothing else about reminders can happen first.
    ["install", i.web && i.webSupport === "install" && !i.remindersOn],
    ["reminders", canRemind && !i.remindersOn],
    ["backup", !i.cloudOn && i.daysUsed >= BACKUP_AFTER_DAYS],
  ];
  for (const [step, applies] of steps) if (applies && !resting(step, i)) return step;
  return null;
}

/** Distinct days with a tick, a meal, water, a weigh-in or a recap. */
export function daysUsed(state: {
  completions: { date: string; done: boolean }[];
  intake?: Record<string, unknown[]>;
  waterMl?: Record<string, number>;
  weighIns: { date: string }[];
  checkIns: { date: string }[];
}): number {
  const days = new Set<string>();
  for (const c of state.completions) if (c.done) days.add(c.date);
  for (const [d, items] of Object.entries(state.intake ?? {})) if (items.length) days.add(d);
  for (const [d, ml] of Object.entries(state.waterMl ?? {})) if (ml > 0) days.add(d);
  for (const w of state.weighIns) days.add(w.date);
  for (const c of state.checkIns) days.add(c.date);
  return days.size;
}
