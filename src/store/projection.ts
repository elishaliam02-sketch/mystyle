/**
 * "When do I get there?" — the one question a person losing weight actually
 * asks. A pure reading of the weigh-in history against the goal weight: the
 * pace so far, and how many weeks are left at that pace.
 *
 * Deliberately conservative. It needs a real span of time (a week) and two
 * readings before it says anything, and it refuses to project when the trend
 * points away from the goal — a number invented from noise is worse than
 * saying nothing.
 */

export type WeighPoint = { date: string; kg: number };

export type Projection = {
  /** Kilos per week, signed: negative while losing. */
  perWeek: number;
  /** Whole weeks until the goal at this pace. */
  weeksLeft: number;
  /** Kilos still between the latest weight and the goal, always positive. */
  toGo: number;
};

const DAY_MS = 86_400_000;

export function projectGoal(points: WeighPoint[], goalKg?: number): Projection | null {
  if (!goalKg || points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const days = (Date.parse(last.date) - Date.parse(first.date)) / DAY_MS;
  if (!Number.isFinite(days) || days < 7) return null;

  const perWeek = ((last.kg - first.kg) / days) * 7;
  if (perWeek === 0) return null;

  const toGo = goalKg - last.kg;
  if (toGo === 0) return null;

  // The pace has to point at the goal: losing while the goal is below, or
  // gaining while it is above. Otherwise there is nothing honest to project.
  if (Math.sign(perWeek) !== Math.sign(toGo)) return null;

  return {
    perWeek: Math.round(perWeek * 10) / 10,
    weeksLeft: Math.max(1, Math.ceil(Math.abs(toGo / perWeek))),
    toGo: Math.round(Math.abs(toGo) * 10) / 10,
  };
}
