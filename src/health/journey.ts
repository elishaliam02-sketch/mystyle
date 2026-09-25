/**
 * The progress-photo journey: a photo a week, each one standing beside the
 * week's average weight rather than a single weigh-in.
 *
 * One morning's scale reading can be a kilo off from water alone, so a photo
 * labelled "88.9" on a salty Monday and "87.6" on the Friday after tells the
 * wrong story. Each photo is read against the average of its own calendar week
 * — recomputed from the weigh-ins every time, so a reading added later that
 * week still lands on the photo — and falls back to the number frozen with the
 * photo only when that week had no weigh-ins at all.
 *
 * Pure: no store, no clock except the `today` passed in.
 */
import { isoWeek, weeklyAverages, type WeekAverage } from "./composition";

export type JourneyPhoto = { id: string; date: string; kg?: number };

/** How a photo's weight is known. */
export type PhotoWeight = { kg: number; source: "week" | "frozen" } | null;

/** The weekly average for the week a photo was taken in. */
export function photoWeight(photo: JourneyPhoto, weeks: WeekAverage[]): PhotoWeight {
  const key = isoWeek(photo.date);
  const week = weeks.find((w) => w.week === key);
  if (week) return { kg: week.avgKg, source: "week" };
  if (typeof photo.kg === "number" && Number.isFinite(photo.kg)) return { kg: photo.kg, source: "frozen" };
  return null;
}

/** Whole days between two YYYY-MM-DD dates (b after a is positive). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return Math.round((tb - ta) / 86_400_000);
}

/** One photo a week: when the next one is due, relative to `today`. */
export type PhotoDue =
  | { state: "first" }
  | { state: "due"; daysSince: number }
  | { state: "soon"; inDays: number };

export const PHOTO_EVERY_DAYS = 7;

export function photoDue(photos: JourneyPhoto[], today: string): PhotoDue {
  const last = [...photos].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!last) return { state: "first" };
  const since = daysBetween(last.date, today);
  if (since >= PHOTO_EVERY_DAYS) return { state: "due", daysSince: since };
  return { state: "soon", inDays: PHOTO_EVERY_DAYS - Math.max(0, since) };
}

/** What changed between two photos: the weekly averages and the time between. */
export type Comparison = {
  days: number;
  weeks: number;
  /** after − before, kg, one decimal; null when either side has no weight. */
  deltaKg: number | null;
  /** kg per week over the span, one decimal; null when not measurable. */
  perWeek: number | null;
};

export function comparePhotos(
  before: JourneyPhoto,
  after: JourneyPhoto,
  weighIns: { date: string; kg: number }[],
): Comparison {
  const weeks = weeklyAverages(weighIns);
  const a = photoWeight(before, weeks);
  const b = photoWeight(after, weeks);
  const days = Math.abs(daysBetween(before.date, after.date));
  const w = Math.round((days / 7) * 10) / 10;
  const deltaKg = a && b ? Math.round((b.kg - a.kg) * 10) / 10 : null;
  const perWeek = deltaKg !== null && days >= 7 ? Math.round((deltaKg / (days / 7)) * 10) / 10 : null;
  return { days, weeks: Math.max(0, Math.round(days / 7)), deltaKg, perWeek: w > 0 ? perWeek : null };
}

/** How many distinct calendar weeks have a photo — the "weekly photo" streak's
 * total, which never punishes a missed week the way a streak would. */
export function photoWeeks(photos: JourneyPhoto[]): number {
  return new Set(photos.map((p) => isoWeek(p.date))).size;
}
