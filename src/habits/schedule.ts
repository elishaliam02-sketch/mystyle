/**
 * Which days a habit is due on, and what a streak means once some days are
 * rest days.
 *
 * A habit used to be due every day, so "the gym, three times a week" broke
 * its streak on every rest day and scored 3/7 on a perfect week. A habit can
 * now name its weekdays; every count of "possible" days, every streak and
 * every reminder reads them from here, so they all agree on what was owed.
 *
 * Weekdays are numbered as JavaScript's getDay: 0 = Sunday … 6 = Saturday.
 * No list — or all seven — means every day.
 */

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** A clean weekday list, or undefined for every day. */
export function normalizeDays(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const days = [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  return days.length === 0 || days.length === 7 ? undefined : days;
}

/** The weekday of a local YYYY-MM-DD, read at noon UTC so no time zone can move it. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay();
}

/** A YYYY-MM-DD moved by whole days. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n, 12));
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export type Scheduled = { days?: number[]; createdAt: string };

/** Whether a habit is owed on a date: it existed, and the day is one of its days. */
export function dueOn(h: Scheduled, date: string): boolean {
  if (date < h.createdAt.slice(0, 10)) return false;
  const days = normalizeDays(h.days);
  return !days || days.includes(weekdayOf(date));
}

/** Whether a weekday is one of a habit's days. */
export function dueWeekday(days: number[] | undefined, weekday: number): boolean {
  const list = normalizeDays(days);
  return !list || list.includes(weekday);
}

/**
 * Whether a date counts toward a streak. Before the habit existed every day
 * counts — ticks there can only come from a clock that was wrong, and the
 * old rule (every day) is the honest reading of them.
 */
function owed(h: Scheduled, date: string): boolean {
  return date < h.createdAt.slice(0, 10) || dueOn(h, date);
}

/**
 * The current run of due days done, counting back from today. Today, not yet
 * ticked, is not a miss — at 09:00 the day is still open. A rest day neither
 * breaks the run nor adds to it, and a tick on a rest day is a bonus that
 * changes nothing.
 */
export function streakOf(h: Scheduled, done: ReadonlySet<string>, today: string): number {
  let count = 0;
  for (let i = 0; i < 3660; i++) {
    const date = addDays(today, -i);
    if (!owed(h, date)) continue;
    if (done.has(date)) count += 1;
    else if (i === 0) continue;
    else break;
  }
  return count;
}

/** The longest run of due days done, ever — the record a streak badge reads. */
export function longestStreakOf(h: Scheduled, done: ReadonlySet<string>, today: string): number {
  if (done.size === 0) return 0;
  const first = [...done].sort()[0]!;
  const born = h.createdAt.slice(0, 10);
  let best = 0;
  let run = 0;
  for (let date = first < born ? first : born, i = 0; date <= today && i < 3660; date = addDays(date, 1), i++) {
    if (!owed(h, date)) continue;
    if (done.has(date)) {
      run += 1;
      best = Math.max(best, run);
    } else if (date !== today) {
      run = 0;
    }
  }
  return best;
}

/** How many of these habits are owed on a date. */
export function dueCount(habits: readonly Scheduled[], date: string): number {
  return habits.filter((h) => dueOn(h, date)).length;
}
