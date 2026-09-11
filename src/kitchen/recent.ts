/**
 * The meals you have logged before, ready to log again in one tap.
 *
 * People eat the same breakfast most mornings. Making them rebuild it from the
 * calculator every single day is the friction that empties a food diary by the
 * second week, so the app remembers what has already been counted and offers it
 * back. It is the most-used button in a calorie app and the app did not have
 * it.
 *
 * Pure over the stored diary: no new state to persist, no new thing to sync,
 * nothing that can drift from the log it is drawn from — a "recent meal" is
 * only ever a meal that is genuinely already in the history.
 */
import type { IntakeItem } from "@/store/types";

export type RecentMeal = {
  label: string;
  kcal: number;
  protein: number;
  /** How many separate days this exact meal was logged — a proxy for "your
   * usual", so the daily coffee floats above the thing eaten once. */
  count: number;
  /** The most recent date (YYYY-MM-DD) it was logged, for the ordering. */
  last: string;
};

/** A meal is "the same meal" when its name and its calories match. Two
 * different 200-kcal snacks with the same name are, for re-logging, the same
 * thing; a name collision at a different calorie count is not. */
function keyOf(item: Pick<IntakeItem, "label" | "kcal">): string {
  return `${item.label.trim().toLowerCase()}::${Math.round(item.kcal)}`;
}

/**
 * The distinct meals in the diary, most useful first.
 *
 * Ordering puts what you eat *often* above what you ate *last*: a meal logged
 * on five different days beats one logged once yesterday, and ties break on
 * recency. Today's own entries are excluded — offering to re-log the thing
 * already on today's plate is noise, not help.
 */
export function recentMeals(
  intake: Record<string, IntakeItem[]> | undefined,
  today: string,
  limit = 8,
): RecentMeal[] {
  if (!intake) return [];
  const byKey = new Map<string, RecentMeal & { days: Set<string> }>();

  for (const [date, items] of Object.entries(intake)) {
    if (date === today) continue; // not the meals already logged today
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item.label !== "string") continue;
      const label = item.label.trim();
      if (!label) continue;
      const kcal = Number.isFinite(item.kcal) ? Math.max(0, Math.round(item.kcal)) : 0;
      const protein = Number.isFinite(item.protein) ? Math.max(0, Math.round(item.protein)) : 0;
      const key = keyOf({ label, kcal });
      const seen = byKey.get(key);
      if (seen) {
        seen.days.add(date);
        seen.count = seen.days.size;
        if (date > seen.last) seen.last = date;
      } else {
        byKey.set(key, { label, kcal, protein, count: 1, last: date, days: new Set([date]) });
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit))
    .map(({ days: _days, ...meal }) => meal);
}
