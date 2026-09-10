/**
 * Working out what a meal actually was.
 *
 * The photo scanner needs a model key and a network; this needs neither. You
 * name the foods and say how much of each, and it adds up — offline, instantly,
 * for free, and for anyone, which is the difference between a feature the app
 * has and a feature the app can use today.
 *
 * It shares the food library and the same per-category estimates the rest of
 * the kitchen already works from, so a portion counted here and the same
 * portion counted in a suggested meal come to the same number. Every figure is
 * an estimate and the screen says so; the point is a total that moves in the
 * right direction when you eat more, not a laboratory measurement.
 */
import { CATEGORY_NUTRITION, FOODS, adhocFood, portion, type Food } from "./data";

/** One thing on the plate: a food, and how many grams of it. */
export type CalcItem = { food: Food; grams: number };

export type Totals = { kcal: number; protein: number };

/** Nobody eats a negative sandwich, and nobody eats five kilos of one. The cap
 * is what stops a stray keystroke turning into a 40,000-calorie day. */
export const MIN_GRAMS = 1;
export const MAX_GRAMS = 3000;
/** More than this many separate foods is a shopping list, not a meal. */
export const MAX_ITEMS = 20;

export function clampGrams(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_GRAMS, Math.round(n)));
}

/** The grams in one standard portion of a food — the step the +/− buttons move
 * by, so a tap means "one more of these" rather than an arbitrary 50g. */
export function stepFor(food: Food): number {
  return Math.max(1, Math.round(portion(food.id).g));
}

/** What a given weight of one food comes to. */
export function itemNutrition(item: CalcItem): Totals {
  const tag = item.food.tags[0] ?? "carb";
  const per100 = CATEGORY_NUTRITION[tag] ?? CATEGORY_NUTRITION.carb;
  const g = clampGrams(item.grams);
  return {
    kcal: Math.round((per100.kcal * g) / 100),
    protein: Math.round((per100.protein * g) / 100),
  };
}

/** The whole plate. Rounded once at the end rather than per item, so the total
 * cannot drift away from the rows the person is reading. */
export function total(items: CalcItem[]): Totals {
  let kcal = 0;
  let protein = 0;
  for (const item of items) {
    const tag = item.food.tags[0] ?? "carb";
    const per100 = CATEGORY_NUTRITION[tag] ?? CATEGORY_NUTRITION.carb;
    const g = clampGrams(item.grams);
    kcal += (per100.kcal * g) / 100;
    protein += (per100.protein * g) / 100;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein) };
}

/** Add a food, or add to it if it is already on the plate — a second tap on
 * "egg" means two eggs, not two rows both called egg. */
export function addFood(items: CalcItem[], food: Food): CalcItem[] {
  const step = stepFor(food);
  const at = items.findIndex((i) => i.food.id === food.id);
  if (at === -1) {
    if (items.length >= MAX_ITEMS) return items;
    return [...items, { food, grams: step }];
  }
  const next = [...items];
  next[at] = { ...next[at]!, grams: clampGrams(next[at]!.grams + step) };
  return next;
}

/** Nudge one row by whole portions. Stepping to zero removes it, because a row
 * reading "0 g" is a thing to tidy up rather than information. */
export function step(items: CalcItem[], foodId: string, direction: 1 | -1): CalcItem[] {
  const at = items.findIndex((i) => i.food.id === foodId);
  if (at === -1) return items;
  const item = items[at]!;
  const grams = clampGrams(item.grams + direction * stepFor(item.food));
  if (grams < MIN_GRAMS) return items.filter((_, i) => i !== at);
  const next = [...items];
  next[at] = { ...item, grams };
  return next;
}

/** Set one row's weight outright, from a typed number. */
export function setGrams(items: CalcItem[], foodId: string, grams: number): CalcItem[] {
  const at = items.findIndex((i) => i.food.id === foodId);
  if (at === -1) return items;
  const next = [...items];
  next[at] = { ...next[at]!, grams: clampGrams(grams) };
  return next;
}

export function removeFood(items: CalcItem[], foodId: string): CalcItem[] {
  return items.filter((i) => i.food.id !== foodId);
}

/** How many standard portions a weight is, for the label under a row. Kept to
 * one decimal: "1.5 portions" is useful, "1.4736 portions" is noise. */
export function portions(item: CalcItem): number {
  return Math.round((clampGrams(item.grams) / stepFor(item.food)) * 10) / 10;
}

/**
 * The name the diary shows for a calculated meal. The foods themselves, in the
 * order they were added, because "chicken, rice, salad" tells you what you ate
 * a week later and "Meal" does not.
 */
export function label(items: CalcItem[], locale: "he" | "en"): string {
  const names = items.map((i) => (locale === "he" ? i.food.he : i.food.en));
  if (names.length === 0) return locale === "he" ? "ארוחה" : "Meal";
  if (names.length <= 3) return names.join(", ");
  const rest = names.length - 2;
  return locale === "he"
    ? `${names.slice(0, 2).join(", ")} ועוד ${rest}`
    : `${names.slice(0, 2).join(", ")} +${rest}`;
}

/**
 * Turning what the AI read off a photograph into rows this screen can edit.
 *
 * The model returns names and its own calorie guesses; we keep the names and
 * recompute from our own table, so a photograph and a hand-typed meal of the
 * same food never disagree — and a model that hallucinates a 5,000-calorie
 * salad cannot write that number into the diary. A name we do not recognise
 * still becomes a row, so nothing the person photographed silently vanishes.
 */
export function fromAnalysis(
  read: { label: string; grams?: number }[],
  locale: "he" | "en",
): CalcItem[] {
  const out: CalcItem[] = [];
  for (const entry of read) {
    const name = (entry.label ?? "").trim();
    if (!name) continue;
    if (out.length >= MAX_ITEMS) break;
    const found = matchFood(name, locale);
    const food = found ?? adhocFood(name);
    const grams = clampGrams(entry.grams && entry.grams > 0 ? entry.grams : stepFor(food));
    if (grams < MIN_GRAMS) continue;
    const at = out.findIndex((i) => i.food.id === food.id);
    if (at === -1) out.push({ food, grams });
    else out[at] = { ...out[at]!, grams: clampGrams(out[at]!.grams + grams) };
  }
  return out;
}

/** The food a written name refers to, or null. Exact names first, then the
 * search terms, so "עוף" finds chicken and "chicken breast" finds it too. */
export function matchFood(name: string, locale: "he" | "en"): Food | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  for (const food of FOODS) {
    if (food.he.toLowerCase() === q || food.en.toLowerCase() === q) return food;
  }
  for (const food of FOODS) {
    if (food.match.some((m) => m.toLowerCase() === q)) return food;
  }
  // A last pass on containment, so "grilled chicken breast" still lands on
  // chicken rather than becoming an unknown.
  let best: { food: Food; len: number } | null = null;
  for (const food of FOODS) {
    for (const term of [food.he, food.en, ...food.match]) {
      const t = term.toLowerCase();
      if (t.length < 2 || !q.includes(t)) continue;
      if (!best || t.length > best.len) best = { food, len: t.length };
    }
  }
  void locale;
  return best?.food ?? null;
}
