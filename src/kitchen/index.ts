import { FOODS, MEALS, type Food, type Meal, type MealNote, type MealSlot } from "./data";

export type { Food, Meal, MealNote, MealSlot, FoodTag, Shape } from "./data";
export { FOODS, MEALS } from "./data";

/**
 * The kitchen engine: read a shopping list the way a person wrote it, and rank
 * the meals it can build toward the weight-loss goal.
 *
 * The list is free text, so ingredients are found by scanning the whole thing
 * for the words each food answers to — the longest phrase wins, so "לחם מלא"
 * is caught as whole-grain bread rather than twice as plain "לחם". Nothing is
 * parsed line by line; a comma list, a paragraph, or one word all work.
 *
 * A meal's fit depends on the goal — cut, maintain, or bulk — and on the time
 * of day, so the same list serves up different plates for different people and
 * different hours, without ever prescribing a number to hit. The figures shown
 * are rounded home-portion estimates, labelled as such in the UI.
 */

/** Punctuation and whitespace that cleanly separate words. */
const BREAK = /[\s,.;:/\-()·|\n\t]/;

/**
 * The single-letter prefixes Hebrew glues onto the front of a noun — and (ו),
 * the (ה), in (ב), to (ל), from (מ), that (ש), like (כ). A real list is full
 * of them: "עוף וברוקולי", "הבצל". They must read as a word boundary, or half
 * an ordinary shopping list goes unrecognised. English has no equivalent, so
 * this only ever helps.
 */
const HE_PREFIX = new Set(["ו", "ה", "ב", "ל", "מ", "ש", "כ"]);

export function readPantry(text: string): Food[] {
  const hay = ` ${text.toLowerCase()} `;
  const found = new Map<string, Food>();

  // Longer phrases first: matching "לחם מלא" must consume before plain "לחם"
  // gets a chance, or a whole-grain loaf reads as white bread.
  const byLongest = FOODS.flatMap((food) =>
    food.match.map((term) => ({ food, term: term.toLowerCase() })),
  ).sort((a, b) => b.term.length - a.term.length);

  const okBefore = (s: string, i: number): boolean => {
    const c = s[i];
    if (c === undefined || BREAK.test(c)) return true;
    // A lone Hebrew prefix letter counts as a boundary, but only when it is
    // itself at the start of a word — so "וברוקולי" matches, "מרק" does not
    // lose its "רק".
    if (HE_PREFIX.has(c)) {
      const p = s[i - 1];
      return p === undefined || BREAK.test(p);
    }
    return false;
  };
  const okAfter = (s: string, i: number): boolean => {
    const c = s[i];
    return c === undefined || BREAK.test(c);
  };

  let masked = hay;
  for (const { food, term } of byLongest) {
    if (found.has(food.id)) continue;
    // Scan every occurrence: the first might sit inside a longer word while a
    // later one is a real mention.
    let from = 0;
    for (;;) {
      const idx = masked.indexOf(term, from);
      if (idx === -1) break;
      if (okBefore(masked, idx - 1) && okAfter(masked, idx + term.length)) {
        found.set(food.id, food);
        // Blank the span so a shorter term cannot re-match these letters
        // ("לחם" inside the "לחם מלא" we just claimed).
        masked = masked.slice(0, idx) + " ".repeat(term.length) + masked.slice(idx + term.length);
        break;
      }
      from = idx + term.length;
    }
  }

  return [...found.values()];
}

/**
 * What the person is training for. The same list of ingredients should serve
 * up different meals depending on this, which is the whole point of asking:
 *  - cut (חיטוב): the most protein for the fewest calories, kept light.
 *  - maintain (שמירה): balance — enough protein, nothing extreme either way.
 *  - bulk (מסה): protein still matters, but so does eating enough; a light
 *    300-calorie plate is the wrong answer here even if its protein is dense.
 */
export type Goal = "cut" | "maintain" | "bulk";

export type MealMatch = {
  meal: Meal;
  have: Food[];
  missing: Food[];
  /** True when every ingredient is on hand. */
  ready: boolean;
  /** 0–1: how well the meal fits the chosen goal. */
  fit: number;
};

/** g of protein per 100 kcal — the axis every goal cares about, differently. */
function proteinDensity(meal: Meal): number {
  return meal.protein / (meal.kcal / 100);
}

/**
 * How well a meal serves a goal, 0–1. Protein density is the backbone for all
 * three; what changes is how calories are read — a cost when cutting, a
 * requirement when bulking, and neither at maintenance.
 */
export function goalFit(meal: Meal, goal: Goal = "cut"): number {
  const density = proteinDensity(meal); // ~0–9 across the menu
  const light = meal.notes.includes("light") || meal.notes.includes("veg") ? 1 : 0;
  const hearty = meal.notes.includes("hearty") ? 1 : 0;

  let raw: number;
  if (goal === "cut") {
    // Protein per calorie, with a nudge toward the lighter plates.
    raw = density / 8 + light * 0.15 - hearty * 0.1;
  } else if (goal === "bulk") {
    // Reward real protein grams and enough energy to grow on; a tiny plate,
    // however lean, does little here.
    raw = meal.protein / 45 + Math.min(meal.kcal, 600) / 1500 + hearty * 0.1;
  } else {
    // Maintenance sits in the middle: decent density, no calorie agenda.
    raw = density / 10 + 0.35 + light * 0.05;
  }
  return Math.max(0, Math.min(1, raw));
}

/** Rough calories a portion should sit near, per goal — for gentle guidance. */
export function slotFitsGoal(meal: Meal, goal: Goal): boolean {
  if (goal === "cut") return meal.kcal <= 430;
  if (goal === "bulk") return meal.kcal >= 380;
  return true;
}

export type KitchenResult = {
  /** Meals every ingredient of which is on hand, best fit first. */
  ready: MealMatch[];
  /** Meals a shop or two away, fewest gaps first. */
  almost: MealMatch[];
  /** Foods recognised in the list, for showing back what was understood. */
  pantry: Food[];
};

export type SuggestOptions = {
  goal?: Goal;
  /** The time of day the person is looking, so the right meals lead. */
  slot?: MealSlot;
  /** How many missing ingredients still counts as "almost". */
  almostGap?: number;
};

/**
 * The whole thing: from a list to ranked meals, for a goal and a time of day.
 *
 * Ranking is layered so the result feels like it was chosen, not sorted: meals
 * that suit the current part of the day rise above ones that don't, and within
 * each, goal fit decides. The time nudge is a tie-breaker, never a filter — a
 * great dinner you can make now still shows at breakfast, just lower.
 */
export function suggestMeals(pantryText: string, opts: SuggestOptions = {}): KitchenResult {
  const goal = opts.goal ?? "cut";
  const almostGap = opts.almostGap ?? 2;
  const pantry = readPantry(pantryText);
  const have = new Set(pantry.map((f) => f.id));
  const food = (id: string) => FOODS.find((f) => f.id === id);

  const matches: MealMatch[] = MEALS.map((meal) => {
    const haveFoods = meal.uses.map(food).filter((f): f is Food => !!f && have.has(f.id));
    const missingFoods = meal.uses.map(food).filter((f): f is Food => !!f && !have.has(f.id));
    return {
      meal,
      have: haveFoods,
      missing: missingFoods,
      ready: missingFoods.length === 0,
      fit: goalFit(meal, goal),
    };
  });

  const rightTime = (m: MealMatch) => (opts.slot && m.meal.slot === opts.slot ? 1 : 0);
  const byGoalThenTime = (a: MealMatch, b: MealMatch) =>
    rightTime(b) - rightTime(a) || b.fit - a.fit;

  const ready = matches.filter((m) => m.ready).sort(byGoalThenTime);

  const almost = matches
    .filter((m) => !m.ready && m.missing.length <= almostGap && m.have.length >= 1)
    // Closest to cookable first; then the same goal-and-time order.
    .sort((a, b) => a.missing.length - b.missing.length || byGoalThenTime(a, b));

  return { ready, almost, pantry };
}

/** A few meals that fit the goal, to show before any list exists. */
export function starterMeals(goal: Goal = "cut"): Meal[] {
  return [...MEALS].sort((a, b) => goalFit(b, goal) - goalFit(a, goal)).slice(0, 4);
}

/** Label a meal leads with, most goal-relevant first. */
export function primaryNote(meal: Meal): MealNote {
  const order: MealNote[] = ["protein", "light", "veg", "hearty", "balanced"];
  return order.find((n) => meal.notes.includes(n)) ?? "balanced";
}

/** The current slot from the clock, so the kitchen opens on the right meals. */
export function slotForHour(hour: number): MealSlot {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
