/**
 * "When do I get there?" — the one question a person losing weight actually
 * asks. A pure reading of the weigh-in history against the goal weight: the
 * recent pace, and how many weeks are left at that pace.
 *
 * The pace is the least-squares slope of the last four weeks, not the line
 * from the first reading ever to today's: a plateau or a regain after months
 * of loss must show as one, and one heavy morning must not move the answer
 * by fifteen weeks. It needs a real span (a week) before it says anything,
 * and it says "steady" or "moving away" rather than inventing an ETA.
 */

export type WeighPoint = { date: string; kg: number };

export type Projection =
  | {
      kind: "toward";
      /** Kilos per week, signed: negative while losing. */
      perWeek: number;
      /** Whole weeks until the goal at this pace. */
      weeksLeft: number;
      /** Kilos still between the current trend weight and the goal, positive. */
      toGo: number;
    }
  /** Less than 0.1 kg a week either way over the recent weeks. */
  | { kind: "plateau"; perWeek: number; toGo: number }
  /** The recent trend points away from the goal. */
  | { kind: "away"; perWeek: number; toGo: number };

export type Trend = {
  /** Kilos per week, signed, unrounded. */
  perWeek: number;
  /** The trend line's value on the latest reading's day. */
  fitted: number;
  /** Days between the first and last reading used. */
  span: number;
  points: number;
};

const DAY_MS = 86_400_000;
/** The window the pace is read over. */
const WINDOW_DAYS = 28;
/** Slower than this is "steady", whatever the sign. */
const PLATEAU_KG_WEEK = 0.1;
/** An ETA further out than two years is noise, not a plan. */
const MAX_WEEKS = 104;

function fit(rows: { x: number; kg: number }[]): { slope: number; at: (x: number) => number } | null {
  const n = rows.length;
  if (n < 2) return null;
  const mx = rows.reduce((s, r) => s + r.x, 0) / n;
  const my = rows.reduce((s, r) => s + r.kg, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const r of rows) {
    sxy += (r.x - mx) * (r.kg - my);
    sxx += (r.x - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, at: (x) => my + slope * (x - mx) };
}

/** The recent weight trend: the last four weeks when they hold enough
 * readings, otherwise everything there is. Null without a week's span. */
export function recentTrend(points: WeighPoint[]): Trend | null {
  const rows = points
    .filter((p) => Number.isFinite(p.kg) && Number.isFinite(Date.parse(p.date)))
    .map((p) => ({ x: Date.parse(p.date) / DAY_MS, kg: p.kg }))
    .sort((a, b) => a.x - b.x);
  if (rows.length < 2) return null;
  const lastX = rows[rows.length - 1]!.x;
  let use = rows.filter((r) => r.x >= lastX - WINDOW_DAYS);
  if (use.length < 3 || lastX - use[0]!.x < 7) use = rows;
  const span = lastX - use[0]!.x;
  if (span < 7) return null;
  const line = fit(use);
  if (!line) return null;
  return { perWeek: line.slope * 7, fitted: line.at(lastX), span, points: use.length };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function projectGoal(points: WeighPoint[], goalKg?: number): Projection | null {
  if (!goalKg) return null;
  const trend = recentTrend(points);
  if (!trend) return null;

  const toGoSigned = goalKg - trend.fitted;
  const toGo = r1(Math.abs(toGoSigned));
  // Within half a kilo of the goal is being there.
  if (toGo < 0.5) return null;

  const perWeek = trend.perWeek;
  if (Math.abs(perWeek) < PLATEAU_KG_WEEK) return { kind: "plateau", perWeek: r1(perWeek), toGo };
  // The pace has to point at the goal: losing while the goal is below, or
  // gaining while it is above.
  if (Math.sign(perWeek) !== Math.sign(toGoSigned)) return { kind: "away", perWeek: r1(perWeek), toGo };

  const weeksLeft = Math.max(1, Math.ceil(Math.abs(toGoSigned / perWeek)));
  if (weeksLeft > MAX_WEEKS) return { kind: "plateau", perWeek: r1(perWeek), toGo };
  return { kind: "toward", perWeek: r1(perWeek), weeksLeft, toGo };
}
