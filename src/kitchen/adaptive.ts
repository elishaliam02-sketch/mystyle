/**
 * A calorie target that learns, week by week, from the scale.
 *
 * The starting number (dailyTarget: ~30 kcal a kilo, minus for a cut, plus
 * for a bulk) is a guess about one person's metabolism. The scale says
 * whether it was right. Every week the trend of the last two weeks' weigh-ins
 * is compared with the pace the goal asks for, and the day's target moves:
 *
 *  - cut: about 0.5% of body weight a week down. Losing slower → a little
 *    less food; losing faster (muscle at risk) → a little more.
 *  - bulk: about 0.25% a week up. Gaining faster (mostly fat) → less;
 *    not gaining → more.
 *  - maintain / recomp: hold the weight.
 *
 * Steps are small (at most 150 kcal a week) and the total drift is capped
 * (±500), so a salty dinner or one missed weigh-in cannot swing the plan. A
 * goal change starts the learning over: last month's cut says nothing about
 * this month's bulk.
 */
import { dailyTarget, type DailyTarget, type Goal } from "./index";

export type WeighInLike = { date: string; kg: number };

/** Weekly pace each goal aims for, as a fraction of body weight. */
export const GOAL_PACE: Record<Goal, number> = { cut: -0.005, bulk: 0.0025, maintain: 0, recomp: 0 };

/** Energy in a kilo of body weight change, roughly. */
const KCAL_PER_KG = 7700;
const MAX_STEP = 150;
const MAX_DRIFT = 500;
/** A trend within this of the goal's pace (kg a week) counts as on track. */
const DEAD_BAND = 0.1;
/** Needs this much history before the first adjustment. */
const LEARN_DAYS = 14;

export type WeekCheck = {
  /** The last day of the week this check covers (YYYY-MM-DD). */
  weekEnd: string;
  /** Measured trend, kg a week. */
  rateKg: number;
  /** What the goal asked for, kg a week. */
  goalRateKg: number;
  /** How much the day's target moved this week. */
  step: number;
};

export type AdaptiveTarget = DailyTarget & {
  /** The formula's starting target, before anything was learned. */
  base: number;
  /** Total learned adjustment, kcal a day. */
  adjust: number;
  /** "learning" until two weeks of weigh-ins; then what the last week did. */
  status: "learning" | "onTrack" | "lowered" | "raised";
  /** The latest weekly check, when there has been one. */
  last: WeekCheck | null;
  /** Days of weigh-ins still needed before the first check (learning only). */
  daysToGo: number;
  /** Weigh-ins the goal's learning is based on. */
  weighIns: number;
};

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);
const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** Least-squares slope, kg a day. */
function slope(points: { t: number; kg: number }[]): number {
  const n = points.length;
  const mt = points.reduce((a, p) => a + p.t, 0) / n;
  const mk = points.reduce((a, p) => a + p.kg, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.kg - mk);
    den += (p.t - mt) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function adaptiveTarget(opts: {
  weighIns: readonly WeighInLike[];
  goal: Goal;
  /** When the current goal was chosen (YYYY-MM-DD); learning starts there. */
  goalSince?: string | null;
  /** Weight to use when there are no weigh-ins at all. */
  fallbackKg?: number;
  /** Today, YYYY-MM-DD. */
  today: string;
}): AdaptiveTarget {
  const { goal, goalSince, today } = opts;
  const all = [...opts.weighIns].filter((w) => w.kg > 0).sort((a, b) => a.date.localeCompare(b.date));
  const latestKg = all.at(-1)?.kg ?? opts.fallbackKg;
  const base = dailyTarget(latestKg, goal);
  const pts = all
    .filter((w) => !goalSince || w.date >= goalSince)
    .map((w) => ({ t: dayNum(w.date), kg: w.kg }));
  const now = dayNum(today);

  const learning = (daysToGo: number): AdaptiveTarget => ({
    ...base,
    base: base.kcal,
    adjust: 0,
    status: "learning",
    last: null,
    daysToGo,
    weighIns: pts.length,
  });
  if (pts.length === 0) return learning(LEARN_DAYS);
  const first = pts[0]!.t;

  let adjust = 0;
  let last: WeekCheck | null = null;
  for (let end = first + LEARN_DAYS; end <= now; end += 7) {
    const win = pts.filter((p) => p.t > end - LEARN_DAYS && p.t <= end);
    if (win.length < 3 || win.at(-1)!.t - win[0]!.t < 7) continue;
    const rateKg = slope(win) * 7;
    const avgKg = win.reduce((a, p) => a + p.kg, 0) / win.length;
    const goalRateKg = GOAL_PACE[goal] * avgKg;
    const off = rateKg - goalRateKg;
    let step = 0;
    if (Math.abs(off) > DEAD_BAND) {
      // Gaining faster than the goal wants → eat less, and the reverse.
      const raw = (-off * KCAL_PER_KG) / 7;
      step = Math.max(-MAX_STEP, Math.min(MAX_STEP, Math.round(raw / 25) * 25));
    }
    const next = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, adjust + step));
    step = next - adjust;
    adjust = next;
    last = { weekEnd: isoOf(end), rateKg: Math.round(rateKg * 100) / 100, goalRateKg: Math.round(goalRateKg * 100) / 100, step };
  }
  if (!last) return learning(Math.max(1, first + LEARN_DAYS - now));

  const floor = 1200;
  return {
    kcal: Math.max(floor, base.kcal + adjust),
    protein: base.protein,
    base: base.kcal,
    adjust,
    status: last.step < 0 ? "lowered" : last.step > 0 ? "raised" : "onTrack",
    last,
    daysToGo: 0,
    weighIns: pts.length,
  };
}
