/**
 * "Is the app actually helping this person?" — the one question the owner's
 * monitoring window has to answer honestly, for one user and for the whole
 * cohort at once.
 *
 * It reads a person's weigh-in history against their goal and returns a plain
 * verdict: are they moving toward the goal, barely moving, stuck, or drifting
 * the wrong way — and how long since they last stepped on the scale, because a
 * good trend from three weeks ago is not the same as a good trend today.
 *
 * Pure, like the rest of the numbers in this app: handed the points and "now",
 * so the same history always reads the same way and every threshold can be
 * tested. It is deliberately conservative — it says "not enough to tell" rather
 * than inventing a trend from a single reading or a day's noise, because a
 * dashboard that cries "off track!" at everyone is one nobody trusts.
 */

export type WeighPoint = { date: string; kg: number };

/** Where a person is, in one word. */
export type Trajectory =
  /** Too few readings, or too short a span, to say anything honest. */
  | "no-data"
  /** Moving toward the goal at a healthy pace. */
  | "on-track"
  /** Moving toward the goal, but only just. */
  | "slow"
  /** Essentially flat — the scale has not really moved. */
  | "stalled"
  /** Moving toward the goal faster than is usually healthy — worth a look. */
  | "fast"
  /** Moving away from the goal. */
  | "off-track";

export type UserTrajectory = {
  trajectory: Trajectory;
  /** Signed kilos per week over the span; negative while losing. Null when no-data. */
  perWeek: number | null;
  /** Kilos from the first recorded weight to the latest; negative while losing. */
  changeKg: number | null;
  /** Kilos still between the latest weight and the goal, absolute. Null with no goal. */
  toGoalKg: number | null;
  /** Whole days since the most recent weigh-in. Null when there are none. */
  daysSinceWeighIn: number | null;
  /** How many weigh-ins were considered. */
  points: number;
};

const DAY_MS = 86_400_000;

/** The pace bands, in kilos per week (magnitude). Named so the dashboard and
 * the tests read the same numbers, and a change is one edit in one place. */
export const STALL_BAND = 0.1;
export const SLOW_BELOW = 0.2;
export const FAST_ABOVE = 1.5;
/** A trend needs at least this many days of span before it means anything. */
export const MIN_SPAN_DAYS = 7;

/**
 * Read one person's trajectory.
 *
 * `goalKg` sharpens the reading — "toward the goal" is exact when we know where
 * the goal is. Without it, this is a weight-loss app, so "toward" means losing;
 * that keeps the verdict useful for someone who never set a target rather than
 * refusing to say anything.
 */
export function readTrajectory(
  points: WeighPoint[],
  goalKg: number | undefined,
  nowIso: string,
): UserTrajectory {
  const clean = (Array.isArray(points) ? points : [])
    .filter((p) => p && typeof p.date === "string" && Number.isFinite(p.kg))
    .sort((a, b) => a.date.localeCompare(b.date));

  const now = Date.parse(nowIso);
  const last = clean[clean.length - 1];
  const daysSinceWeighIn =
    last && Number.isFinite(now)
      ? Math.max(0, Math.floor((now - Date.parse(last.date)) / DAY_MS))
      : null;

  const base: UserTrajectory = {
    trajectory: "no-data",
    perWeek: null,
    changeKg: null,
    toGoalKg: goalKg !== undefined && last ? Math.abs(goalKg - last.kg) : null,
    daysSinceWeighIn,
    points: clean.length,
  };

  if (clean.length < 2) return base;

  const first = clean[0];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / DAY_MS;
  if (!Number.isFinite(days) || days < MIN_SPAN_DAYS) return base;

  const perWeek = Math.round(((last.kg - first.kg) / days) * 7 * 100) / 100;
  const changeKg = Math.round((last.kg - first.kg) * 10) / 10;

  // Which direction counts as "toward the goal". With a goal, it is the sign
  // that closes the gap; without one, losing is good.
  const toGo = goalKg !== undefined ? goalKg - last.kg : -1;
  const towardIsNegative = toGo < 0; // goal below current (or no goal) → lose
  const magnitude = Math.abs(perWeek);
  const toward = perWeek === 0 ? false : perWeek < 0 === towardIsNegative;

  let trajectory: Trajectory;
  if (magnitude < STALL_BAND) trajectory = "stalled";
  else if (!toward) trajectory = "off-track";
  else if (magnitude < SLOW_BELOW) trajectory = "slow";
  else if (magnitude > FAST_ABOVE) trajectory = "fast";
  else trajectory = "on-track";

  return { ...base, trajectory, perWeek, changeKg };
}

/** True when the trend is actually moving the person toward their goal — the
 * simple "is it working" the dashboard colours green. `fast` counts, but the
 * dashboard should still surface it separately as one to keep an eye on. */
export function isProgressing(trajectory: Trajectory): boolean {
  return trajectory === "on-track" || trajectory === "slow" || trajectory === "fast";
}

export type CohortSummary = Record<Trajectory, number> & {
  /** Everyone counted. */
  total: number;
  /** How many are moving toward their goal (on-track + slow + fast). */
  progressing: number;
};

/** Roll a list of per-user trajectories into the counts the monitoring window
 * shows at the top. Order-independent and safe on an empty list. */
export function summariseCohort(trajectories: Trajectory[]): CohortSummary {
  const summary: CohortSummary = {
    "no-data": 0,
    "on-track": 0,
    slow: 0,
    stalled: 0,
    fast: 0,
    "off-track": 0,
    total: 0,
    progressing: 0,
  };
  for (const t of trajectories) {
    if (t in summary) summary[t] += 1;
    summary.total += 1;
    if (isProgressing(t)) summary.progressing += 1;
  }
  return summary;
}
