import { FOODS, MEALS, foodNutrition, type Food, type Meal, type MealNote, type MealSlot } from "./data";

export type { Food, Meal, MealNote, MealSlot, FoodTag, Shape } from "./data";
export { FOODS, MEALS, portion, adhocFood, foodNutrition } from "./data";
export type { Portion } from "./data";

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

/** Words that are not foods, so they never become a phantom ingredient. */
const STOPWORDS = new Set([
  "עם", "קצת", "גם", "וגם", "של", "קניתי", "יש", "לי", "היום", "עוד", "טרי", "טרייה",
  "טריים", "קצוץ", "קצוצה", "חצי", "כמה", "מעט", "וחצי", "בבית", "אוכל", "ארוחה",
  "the", "and", "with", "some", "of", "to", "fresh", "bought", "have", "today",
  "little", "bit", "half", "few", "food", "meal", "for",
]);

/**
 * Reads the list and returns both what it recognised and what it did not — so
 * nothing the person typed is silently dropped. Unknown words become ad-hoc
 * ingredients elsewhere, which is how the kitchen "recognises anything" without
 * a food API: a word it has never seen is still treated as something on the
 * plate, estimated by category.
 */
export function readPantryFull(text: string): { known: Food[]; extras: string[] } {
  const known = readPantry(text);

  // Every word any recognised food answers to, so we do not re-list it.
  const covered = new Set<string>();
  for (const f of known) {
    for (const term of f.match) for (const w of term.toLowerCase().split(/\s+/)) covered.add(w);
  }
  const stripPrefix = (w: string) => (w.length > 2 && HE_PREFIX.has(w[0]) ? w.slice(1) : w);

  const extras: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.toLowerCase().split(BREAK)) {
    if (!raw) continue;
    const w = stripPrefix(raw);
    if (w.length < 2) continue;
    if (STOPWORDS.has(w) || STOPWORDS.has(raw)) continue;
    if (covered.has(w) || covered.has(raw)) continue;
    if (!/[a-z\u05d0-\u05ea]/.test(w)) continue; // must hold a real letter
    if (seen.has(w)) continue;
    seen.add(w);
    extras.push(raw.trim());
    if (extras.length >= 8) break;
  }
  return { known, extras };
}

/**
 * A meal made of exactly what the person has — known foods and unknown ones
 * alike. This is what guarantees every list yields something to cook: even a
 * bag of groceries the recipe book has never met becomes "your plate", with a
 * calorie and protein estimate summed from each item's category.
 */
export function yourPlate(items: Food[], slot: MealSlot): Meal {
  let kcal = 0;
  let protein = 0;
  for (const f of items) {
    const n = foodNutrition(f);
    kcal += n.kcal;
    protein += n.protein;
  }
  const density = kcal > 0 ? protein / (kcal / 100) : 0;
  const hasVeg = items.some((f) => f.tags.includes("veg"));
  const notes: MealNote[] = [];
  if (density >= 6) notes.push("protein");
  if (kcal <= 400) notes.push("light");
  if (hasVeg) notes.push("veg");
  if (notes.length === 0) notes.push("balanced");

  const names = (lang: "he" | "en") => items.map((f) => (lang === "he" ? f.he : f.en)).join(", ");
  return {
    id: "your-plate",
    he: { title: "המנה שלך", how: `שילוב מהמצרכים שלך: ${names("he")}.` },
    en: { title: "Your plate", how: `Built from what you have: ${names("en")}.` },
    uses: items.map((f) => f.id),
    slot,
    notes,
    kcal,
    protein,
  };
}

/**
 * What the person is training for. The same list of ingredients should serve
 * up different meals depending on this, which is the whole point of asking:
 *  - cut (חיטוב): the most protein for the fewest calories, kept light.
 *  - maintain (שמירה): balance — enough protein, nothing extreme either way.
 *  - bulk (מסה): protein still matters, but so does eating enough; a light
 *    300-calorie plate is the wrong answer here even if its protein is dense.
 *  - recomp (מיצוק): build muscle while dropping fat at once — the hardest
 *    ask, and the one protein matters most for. It wants dense protein like a
 *    cut, and real protein grams like a bulk, while holding calories moderate
 *    rather than high. Neither the tiny plate nor the heavy one is the answer.
 */
export type Goal = "cut" | "maintain" | "bulk" | "recomp";

export type DailyTarget = { kcal: number; protein: number };

/**
 * A day's calorie and protein target from the person's weight and goal. A rough
 * coach's rule, not a clinical figure: maintenance is about 30 kcal per kilo,
 * a cut trims it, a bulk adds to it; protein is set per kilo, higher when the
 * aim is to hold muscle while losing fat. With no weight yet, a sane default
 * keeps the ring meaningful rather than blank.
 */
export function dailyTarget(weightKg: number | undefined, goal: Goal): DailyTarget {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  const maintenance = Math.round(w * 30);
  const kcal =
    goal === "cut" ? maintenance - 400 : goal === "bulk" ? maintenance + 350 : maintenance;
  const proteinPerKg = goal === "cut" || goal === "recomp" ? 2.0 : 1.8;
  return { kcal: Math.max(1200, kcal), protein: Math.round(w * proteinPerKg) };
}

/** Dietary filters the kitchen can apply to what it suggests. */
export type Diet = "all" | "kosher" | "vegetarian";

// Foods that are never kosher, the meats that may not share a plate with dairy,
// and every animal flesh (for the vegetarian filter). Fish and eggs are pareve,
// so fish-with-dairy stays kosher and eggs stay vegetarian.
const NON_KOSHER = new Set(["pork", "shrimp"]);
const MEAT = new Set(["chicken", "turkey", "beef", "pork", "sausage"]);
const FLESH = new Set([...MEAT, "fish", "tuna", "salmon", "shrimp"]);

/**
 * Whether a meal passes a dietary filter. Kosher is a practical simplification:
 * no non-kosher animal, and no meat sharing the plate with dairy (fish counts
 * as neither). Vegetarian excludes any animal flesh but keeps dairy and eggs.
 */
export function dietOk(meal: Meal, diet: Diet): boolean {
  if (diet === "all") return true;
  if (diet === "vegetarian") return !meal.uses.some((id) => FLESH.has(id));
  // kosher
  if (meal.uses.some((id) => NON_KOSHER.has(id))) return false;
  const hasMeat = meal.uses.some((id) => MEAT.has(id));
  const hasDairy = meal.uses.some((id) => {
    const f = FOODS.find((x) => x.id === id);
    return f ? f.tags.includes("dairy") : false;
  });
  return !(hasMeat && hasDairy);
}

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
  } else if (goal === "recomp") {
    // Both at once: dense protein like a cut, real grams like a bulk, calories
    // held moderate. A heavy plate is docked, a tiny one is not rewarded for
    // being tiny — the sweet spot is protein-rich and mid-weight.
    raw = density / 10 + meal.protein / 70 + light * 0.05 - (meal.kcal > 550 ? 0.12 : 0);
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
  if (goal === "recomp") return meal.kcal >= 280 && meal.kcal <= 560;
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

/**
 * A real photo for a meal, from a free image service — no key, no bill.
 *
 * The prompt is built from the dish and its actual ingredients, so the picture
 * is of this meal, not a stock stand-in, and it changes with the ingredients.
 * A stable seed per meal keeps the same dish looking the same across launches
 * (and lets the device cache it). English throughout: the model reads it best.
 *
 * This needs the network. The UI shows a drawn plate underneath and only swaps
 * to the photo once it loads, so offline the app still works — it just shows
 * the illustration instead.
 */
export function mealPhotoUrl(meal: Meal, size: { width: number; height: number }): string {
  const foods = meal.uses
    .map((id) => FOODS.find((f) => f.id === id))
    .filter((f): f is Food => !!f);
  const ingredients = foods.map((f) => f.en).join(", ");
  const prompt =
    `professional food photography of a full plate of ${meal.en.title}, ` +
    `made with ${ingredients}, the whole dish centred and fully in frame, ` +
    `wide overhead shot, natural daylight, fresh, appetizing, sharp focus, no text`;
  const seed = stableSeed(meal.id);
  const q = `width=${size.width}&height=${size.height}&nologo=true&seed=${seed}`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q}`;
}

/** A small deterministic number from a string, so one meal keeps one image. */
function stableSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100000;
}
