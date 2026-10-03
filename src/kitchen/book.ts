/**
 * The recipe book's logic, kept apart from the screens so it can be tested:
 * which recipes a search and a set of filters leave, in what order, and the
 * text a recipe is shared as.
 */
import { FOODS, MEALS, mealAmount, type Food, type Meal, type MealSlot } from "./data";
import { dietList, dietOk, foodsDietOk } from "./index";
import { missingFor } from "./menu";
import { RECIPES, type Recipe, type RecipeTag } from "./recipes";

export type BookFilter = RecipeTag | "protein" | "veggie";

export type BookQuery = {
  query?: string;
  slot?: MealSlot | "all";
  filter?: BookFilter | null;
  /** The person's diet setting ("kosher,vegetarian"), applied unless `anyDiet`. */
  diet?: string | null;
  anyDiet?: boolean;
  /** Narrow to the starred dishes, or to what the kitchen can make right now. */
  only?: "starred" | "canMake" | null;
  favorites?: readonly string[];
  /** Food ids in the kitchen, staples included — what "can make" reads. */
  have?: ReadonlySet<string> | null;
};

const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
const byId = new Map(FOODS.map((f) => [f.id, f]));

export function foodsOf(meal: Pick<Meal, "uses">): Food[] {
  return meal.uses.map((id) => byId.get(id)).filter((f): f is Food => !!f);
}

/** Lower-case, no Hebrew points, no punctuation — so "ג׳" and "ג'" and "ג" meet. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[׳'"״`’]/g, "")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Everything a search can match a recipe by: its names, its foods, its steps. */
function haystack(meal: Meal, recipe: Recipe | undefined): string {
  const foods = foodsOf(meal).flatMap((f) => [f.he, f.en, ...f.match]);
  return norm([meal.he.title, meal.en.title, meal.he.how, meal.en.how, ...foods, ...(recipe?.he ?? []), ...(recipe?.en ?? [])].join(" "));
}
const HAY = new Map(MEALS.map((m) => [m.id, haystack(m, RECIPES[m.id])]));

export function matchesFilter(meal: Meal, filter: BookFilter): boolean {
  const r = RECIPES[meal.id];
  switch (filter) {
    case "quick":
      return !!r && r.minutes <= 15;
    case "protein":
      return meal.protein >= 25;
    case "veggie":
      return foodsDietOk(foodsOf(meal), "vegetarian");
    default:
      return !!r && r.tags.includes(filter);
  }
}

/** The recipes a search and filters leave: breakfast to snacks, quickest first within a meal. */
export function searchBook(q: BookQuery): Meal[] {
  const words = norm(q.query ?? "").split(" ").filter((w) => w.length > 0);
  return MEALS.filter((m) => RECIPES[m.id])
    .filter((m) => !q.slot || q.slot === "all" || m.slot === q.slot)
    .filter((m) => !q.filter || matchesFilter(m, q.filter))
    .filter((m) => q.anyDiet || dietOk(m, q.diet))
    .filter((m) => q.only !== "starred" || (q.favorites ?? []).includes(m.id))
    // Makeable as the menu means it: everything there, or a stand-in for it.
    .filter((m) => q.only !== "canMake" || !q.have || missingFor(m, q.have)?.length === 0)
    .filter((m) => {
      if (words.length === 0) return true;
      const hay = HAY.get(m.id) ?? "";
      // Every word must appear, each also without a leading Hebrew ו/ה/ב/ל
      // ("ועוף", "בטחינה" find chicken and tahini).
      return words.every((w) => hay.includes(w) || (w.length > 2 && /^[והבלמש]/.test(w) && hay.includes(w.slice(1))));
    })
    .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || (RECIPES[a.id]!.minutes - RECIPES[b.id]!.minutes));
}

/** How many library recipes pass the person's diet setting. */
export function bookSize(diet?: string | null): number {
  return MEALS.filter((m) => RECIPES[m.id] && dietOk(m, diet)).length;
}

/** The diets a dish breaks for this person, for the warning on its page. */
export function dietWarnings(meal: Meal, diet: string | null | undefined) {
  return dietList(diet).filter((d) => !dietOk(meal, d));
}

/** Grams of each ingredient for `servings` portions. */
export function scaledGrams(meal: Meal, foodId: string, servings: number): number {
  return Math.round(mealAmount(meal, foodId).g * servings);
}

/** A recipe as plain text, for sharing on WhatsApp or anywhere else. */
export function shareText(
  meal: Meal,
  locale: "he" | "en",
  servings: number,
  labels: { ingredients: string; steps: string; footer: string; minutes: string; gram: string },
): string {
  const r = RECIPES[meal.id];
  const copy = locale === "he" ? meal.he : meal.en;
  const lines = [copy.title, r ? labels.minutes : "", "", `${labels.ingredients}:`];
  for (const f of foodsOf(meal)) {
    lines.push(`• ${locale === "he" ? f.he : f.en} — ${scaledGrams(meal, f.id, servings)} ${labels.gram}`);
  }
  if (r) {
    lines.push("", `${labels.steps}:`);
    (locale === "he" ? r.he : r.en).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  lines.push("", labels.footer);
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n");
}
