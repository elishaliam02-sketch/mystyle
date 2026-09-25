/**
 * Working out what a meal actually was.
 *
 * The photo scanner needs a model key and a network; this needs neither. You
 * name the foods and say how much of each, and it adds up — offline, instantly,
 * for free, and for anyone, which is the difference between a feature the app
 * has and a feature the app can use today.
 *
 * It shares the food library and its per-food nutrition table (./nutrition.ts,
 * USDA figures per 100 g) with the rest of the kitchen, so a portion counted
 * here and the same portion counted in a suggested meal come to the same
 * number. The arithmetic is exact; what is only as good as the person's eye is
 * the weight, which is why every row can be set to the gram.
 */
import type { MealAnalysis } from "@/ai/nutrition";
import { FOODS, adhocFood, per100For, portion, type Food } from "./data";

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
  const per100 = per100For(item.food);
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
    const per100 = per100For(item.food);
    const g = clampGrams(item.grams);
    kcal += (per100.kcal * g) / 100;
    protein += (per100.protein * g) / 100;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein) };
}

/** Carbs and fat for the plate, from the foods whose split is actually known:
 * library foods (USDA table) and products found on Open Food Facts. A food
 * priced only by calories — the AI's reading of a photo, or a category guess —
 * has no honest split, so it is left out and `partial` says so rather than
 * counting it as zero. Null when nothing on the plate has a known split. */
export type Macros = { carbs: number; fat: number; partial: boolean };

export function macros(items: CalcItem[]): Macros | null {
  let carbs = 0;
  let fat = 0;
  let known = 0;
  for (const item of items) {
    const per100 = per100For(item.food);
    const trusted = per100.source === "table" || (per100.source === "food" && item.food.src === "off");
    if (!trusted) continue;
    const g = clampGrams(item.grams);
    carbs += (per100.carbs * g) / 100;
    fat += (per100.fat * g) / 100;
    known++;
  }
  if (known === 0) return null;
  return { carbs: Math.round(carbs), fat: Math.round(fat), partial: known < items.length };
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

/** Add a weight of a food — a typed sentence's reading — merging with a row
 * already on the plate rather than listing the food twice. */
export function addGrams(items: CalcItem[], food: Food, grams: number): CalcItem[] {
  const g = clampGrams(grams);
  if (g < MIN_GRAMS) return items;
  const at = items.findIndex((i) => i.food.id === food.id);
  if (at === -1) {
    if (items.length >= MAX_ITEMS) return items;
    return [...items, { food, grams: g }];
  }
  const next = [...items];
  next[at] = { ...next[at]!, grams: clampGrams(next[at]!.grams + g) };
  return next;
}

/** Dry staples weighed raw, and the cooked twin a plate is actually weighed as. */
const COOKED_OF: Record<string, string> = { rice: "cookedRice", pasta: "cookedPasta" };

/** Search hits with a cooked twin ahead of the dry food: on a plate, "rice"
 * is cooked rice, and a row reading "75 g" of dry rice misleads. */
export function cookedFirst(foods: Food[]): Food[] {
  const out = [...foods];
  for (const [dry, cooked] of Object.entries(COOKED_OF)) {
    const d = out.findIndex((f) => f.id === dry);
    if (d === -1) continue;
    const c = out.findIndex((f) => f.id === cooked);
    const twin = c === -1 ? FOODS.find((f) => f.id === cooked) : out[c];
    if (!twin) continue;
    if (c !== -1) out.splice(c, 1);
    out.splice(d, 0, twin);
  }
  return out;
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

/** One item as the photo reader returned it. `kcal` and `protein` are the
 * model's own figures for the whole portion; they are used only for a food the
 * library does not know. */
export type ReadItem = { label: string; grams?: number; kcal?: number; protein?: number };

/** Nothing edible is denser than pure fat; a per-100 g figure above this is a
 * misread, not a food. */
const MAX_KCAL_PER_100 = 900;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * An item the library does not know, priced by the model's own reading of it:
 * its calories and protein for the portion it saw, turned into per-100 g so the
 * person can change the weight and the numbers follow.
 */
export function aiFood(label: string, grams: number, kcal: number, protein: number): Food {
  const base = adhocFood(label);
  const g = Math.max(1, grams);
  return {
    ...base,
    id: `x:ai:${label}`,
    n: {
      kcal: round1(Math.min(MAX_KCAL_PER_100, Math.max(0, (kcal * 100) / g))),
      protein: round1(Math.min(100, Math.max(0, (protein * 100) / g))),
      carbs: 0,
      fat: 0,
    },
    src: "ai",
  };
}

/**
 * Turning what the AI read off a photograph into rows this screen can edit.
 *
 * The model is good at WHAT is on the plate and at roughly HOW MUCH; it is not
 * a nutrition database. So a food it names that the library knows by that exact
 * name is priced from the library's per-food table (USDA per 100 g × the
 * weight) — a photograph and a hand-typed meal of the same food never disagree,
 * and a hallucinated 5,000-calorie salad cannot reach the diary. A food the
 * library does not know keeps the model's own estimate for it (a dish like
 * shakshuka is better guessed by a model that saw it than by a category
 * average). Only a partial-word match — "salad with avocado" containing
 * "avocado" — is NOT trusted to reprice a whole plate item, because pricing a
 * 250 g salad as 250 g of avocado is exactly the error this exists to stop.
 */
export function fromAnalysis(read: ReadItem[], locale: "he" | "en"): CalcItem[] {
  const out: CalcItem[] = [];
  for (const entry of read) {
    const name = (entry.label ?? "").trim();
    if (!name) continue;
    if (out.length >= MAX_ITEMS) break;
    const seenGrams = entry.grams && entry.grams > 0 ? entry.grams : 0;
    const exact = matchFood(name, locale, { exactOnly: true });
    let food: Food;
    if (exact) {
      food = exact;
    } else if (seenGrams > 0 && typeof entry.kcal === "number" && Number.isFinite(entry.kcal)) {
      food = aiFood(name, seenGrams, entry.kcal, entry.protein ?? 0);
    } else {
      food = matchFood(name, locale) ?? adhocFood(name);
    }
    const grams = clampGrams(seenGrams > 0 ? seenGrams : stepFor(food));
    if (grams < MIN_GRAMS) continue;
    const at = out.findIndex((i) => i.food.id === food.id);
    if (at === -1) out.push({ food, grams });
    else out[at] = { ...out[at]!, grams: clampGrams(out[at]!.grams + grams) };
  }
  return out;
}

/**
 * The photo reading, re-priced. What the scanner shows, what "save" logs, and
 * what the calculator opens with are all this one answer, so the three can
 * never show different numbers for the same plate.
 */
export function groundAnalysis(analysis: MealAnalysis, locale: "he" | "en"): MealAnalysis {
  const rows = fromAnalysis(analysis.items, locale);
  const items = rows.map((row) => {
    const n = itemNutrition(row);
    return {
      label: locale === "he" ? row.food.he : row.food.en,
      grams: row.grams,
      kcal: n.kcal,
      protein: n.protein,
    };
  });
  const sums = total(rows);
  return { items, kcal: sums.kcal, protein: sums.protein, confidence: analysis.confidence };
}

/** The food a written name refers to, or null. Exact names first, then the
 * search terms, so "עוף" finds chicken and "chicken breast" finds it too. */
export function matchFood(
  name: string,
  locale: "he" | "en",
  opts: { exactOnly?: boolean } = {},
): Food | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  for (const food of FOODS) {
    if (food.he.toLowerCase() === q || food.en.toLowerCase() === q) return food;
  }
  for (const food of FOODS) {
    if (food.match.some((m) => m.toLowerCase() === q)) return food;
  }
  if (opts.exactOnly) return null;
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
