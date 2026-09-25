/**
 * Body composition — the progress-corner maths. Two things a scale alone can't
 * tell you: a *weekly average* that smooths out the daily water-weight noise,
 * and an *estimated body-fat %* from a tape measure. Both pure and testable;
 * the screen only renders what these return.
 *
 * Body fat uses the Relative Fat Mass (RFM) formula — a 2018 model that needs
 * only height and waist (and sex), and tracks DEXA scans about as well as far
 * fussier methods. It naturally varies from person to person (their waist) and
 * from week to week (as the waist changes), which is exactly the "changes per
 * person and per photo" the corner is for.
 */

import type { Goal } from "@/kitchen";

export type Sex = "male" | "female";

export type WeighInLike = { date: string; kg: number };

/** ISO-8601 week key ("2026-W03") for a YYYY-MM-DD date — weeks start Monday. */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  // Shift to the Thursday of this week, then count weeks from Jan 1 — the ISO rule.
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const fday = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fday + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type WeekAverage = { week: string; avgKg: number; count: number; from: string };

/**
 * Weigh-ins collapsed to one average per calendar week, oldest first. A week
 * with three readings counts as one honest data point rather than three noisy
 * ones — the number that tells you if you're actually moving.
 */
export function weeklyAverages(weighIns: WeighInLike[]): WeekAverage[] {
  const byWeek = new Map<string, { sum: number; count: number; from: string }>();
  for (const w of weighIns) {
    if (!Number.isFinite(w.kg)) continue;
    const key = isoWeek(w.date);
    const cur = byWeek.get(key);
    if (cur) {
      cur.sum += w.kg;
      cur.count += 1;
      if (w.date < cur.from) cur.from = w.date;
    } else {
      byWeek.set(key, { sum: w.kg, count: 1, from: w.date });
    }
  }
  return [...byWeek.entries()]
    .map(([week, v]) => ({
      week,
      avgKg: Math.round((v.sum / v.count) * 10) / 10,
      count: v.count,
      from: v.from,
    }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * This week's average against last week's — the honest "am I moving?" number,
 * in kg/week. Null until there are two distinct weeks to compare.
 */
export function weeklyChange(weighIns: WeighInLike[]): number | null {
  return weeklyStep(weighIns)?.perWeek ?? null;
}

/** The Monday of a date's week, as YYYY-MM-DD. */
export function weekMonday(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The latest week against the one before it that has readings — honest about
 * a gap: three weeks apart is a change over three weeks, not "since last
 * week". From the unrounded means, so two averages that round alike can
 * still show their real 0.1.
 */
export function weeklyStep(
  weighIns: WeighInLike[],
): { change: number; perWeek: number; weeksApart: number } | null {
  const byWeek = new Map<string, { sum: number; count: number }>();
  for (const w of weighIns) {
    if (!Number.isFinite(w.kg)) continue;
    const key = weekMonday(w.date);
    const cur = byWeek.get(key) ?? { sum: 0, count: 0 };
    cur.sum += w.kg;
    cur.count += 1;
    byWeek.set(key, cur);
  }
  const keys = [...byWeek.keys()].sort();
  if (keys.length < 2) return null;
  const a = byWeek.get(keys[keys.length - 2]!)!;
  const b = byWeek.get(keys[keys.length - 1]!)!;
  const weeksApart = Math.max(
    1,
    Math.round((Date.parse(keys[keys.length - 1]!) - Date.parse(keys[keys.length - 2]!)) / (7 * 86_400_000)),
  );
  const change = b.sum / b.count - a.sum / a.count;
  return {
    change: Math.round(change * 10) / 10,
    perWeek: Math.round((change / weeksApart) * 10) / 10,
    weeksApart,
  };
}

/** RFM body-fat estimate, in %, from height and waist in cm. Null if either is unusable. */
export function bodyFatPercent(opts: {
  heightCm?: number;
  waistCm?: number;
  sex?: Sex;
}): number | null {
  const { heightCm, waistCm, sex } = opts;
  if (!sex) return null;
  if (!heightCm || heightCm < 120 || heightCm > 250) return null;
  if (!waistCm || waistCm < 40 || waistCm > 200) return null;
  const base = sex === "male" ? 64 : 76;
  const rfm = base - 20 * (heightCm / waistCm);
  // Clamp to a sane human band; round to one decimal.
  const clamped = Math.max(3, Math.min(60, rfm));
  return Math.round(clamped * 10) / 10;
}

export type FatBand = { min: number; max: number };

/**
 * The body-fat band that suits the goal, by sex. A cut aims lower, a bulk
 * tolerates more — so the same person sees a different target the moment they
 * switch goal, which is the whole point of "body fat by goal".
 */
export function bodyFatTarget(goal: Goal, sex: Sex): FatBand {
  const male: Record<Goal, FatBand> = {
    cut: { min: 8, max: 14 },
    recomp: { min: 12, max: 18 },
    maintain: { min: 14, max: 20 },
    bulk: { min: 15, max: 22 },
  };
  const female: Record<Goal, FatBand> = {
    cut: { min: 16, max: 22 },
    recomp: { min: 20, max: 26 },
    maintain: { min: 22, max: 28 },
    bulk: { min: 24, max: 30 },
  };
  return (sex === "male" ? male : female)[goal];
}

export type FatTier = "below" | "in" | "above";

/** Where a body-fat number sits against the goal band. */
export function fatTier(bf: number, band: FatBand): FatTier {
  if (bf < band.min) return "below";
  if (bf > band.max) return "above";
  return "in";
}

/** Fraction 0..1 of the way a body-fat number sits across (and past) a display scale. */
export function fatFraction(bf: number, scaleMin = 5, scaleMax = 40): number {
  if (scaleMax <= scaleMin) return 0;
  return Math.max(0, Math.min(1, (bf - scaleMin) / (scaleMax - scaleMin)));
}

export function isStorableSex(v: unknown): v is Sex {
  return v === "male" || v === "female";
}
