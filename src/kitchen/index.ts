import { DIET_CLASS, FOODS, MEALS, foodNutrition, gramsNutrition, portion, scaledHousehold, type Food, type Meal, type MealNote, type MealSlot, type FoodTag, type Portion } from "./data";

export type { Food, Meal, MealNote, MealSlot, FoodTag, Shape } from "./data";
export { FOODS, MEALS, portion, adhocFood, foodNutrition, gramsNutrition, mealAmount, scaledHousehold, timesLabel } from "./data";
export type { Portion } from "./data";
// The meal photographs: real pictures from Wikimedia Commons, the hosts they
// come from (which the privacy policy has to name), and the picker that keeps a
// media archive's diagrams and coats of arms off the plate. See `photo.ts`.
export {
  fetchMealPhoto,
  photoQueries,
  commonsSearchUrl,
  pickPhoto,
  clearPhotoCache,
  creditFor,
  PHOTO_HOSTS,
} from "./photo";
export type { CommonsPage, CommonsImage, Photo } from "./photo";
export { closestBundled, fetchFoodPhoto, foodPhotoQueries, mainIngredient, plateLook, WEAK_MEAL_PHOTOS, NATIVE_HEADERS } from "./photo";
export type { PlateLook } from "./photo";

// "Can I eat this?" — any food, priced out of ten, on the device. See `score.ts`.
export { scoreAnything, scoreFood, scoreWords, bandOf } from "./score";
export type { FoodScore, ScoreBand, ScoreReason } from "./score";

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

/**
 * Every single-word name a food answers to, for the forgiving second pass:
 * plurals, a missing or extra letter. Built once.
 */
const SINGLE_TERMS: Map<string, Food> = (() => {
  const m = new Map<string, Food>();
  for (const food of FOODS) {
    for (const t of food.match) {
      const term = t.toLowerCase();
      if (!term.includes(" ") && !m.has(term)) m.set(term, food);
    }
  }
  return m;
})();

/** The forms a typed word might be the plural or prefixed version of. */
function wordForms(word: string): string[] {
  // Up to two prefix letters: "והבצל" is and-the-onion.
  const bases = [word];
  if (word.length > 3 && HE_PREFIX.has(word[0]!)) {
    bases.push(word.slice(1));
    if (word.length > 4 && HE_PREFIX.has(word[1]!)) bases.push(word.slice(2));
  }
  const out: string[] = [];
  const add = (w: string) => {
    if (w.length >= 2 && !out.includes(w)) out.push(w);
  };
  for (const b of bases) {
    add(b);
    // Hebrew plurals: בצלים → בצל, נקניקיות → נקניקייה, עגבניות → עגבנייה
    if (b.endsWith("ים")) add(b.slice(0, -2));
    if (b.endsWith("יות")) {
      add(`${b.slice(0, -3)}ייה`);
      add(`${b.slice(0, -3)}יה`);
    }
    if (b.endsWith("ות")) {
      add(`${b.slice(0, -2)}ה`);
      add(`${b.slice(0, -2)}ת`);
      add(b.slice(0, -2));
    }
    // English plurals: berries → berry, tomatoes → tomato, onions → onion
    if (b.endsWith("ies")) add(`${b.slice(0, -3)}y`);
    if (b.endsWith("es")) add(b.slice(0, -2));
    if (b.endsWith("s")) add(b.slice(0, -1));
  }
  return out;
}

/** At most one letter added, dropped or changed — a typo, not another word. */
function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * The food a leftover word most likely means: its plural or prefixed form
 * first, then a one-letter typo of a name at least five letters long (short
 * words are too easily another word). Null when nothing is close.
 */
function forgivingMatch(word: string): Food | null {
  const forms = wordForms(word);
  for (const f of forms) {
    const hit = SINGLE_TERMS.get(f);
    if (hit) return hit;
  }
  for (const f of forms) {
    if (f.length < 5) continue;
    for (const [term, food] of SINGLE_TERMS) {
      if (term.length >= 5 && term[0] === f[0] && oneEdit(f, term)) return food;
    }
  }
  return null;
}

export function readPantry(text: string): Food[] {
  return scanPantry(text).foods;
}

/** The recognised foods, plus the typed words the forgiving pass claimed —
 * so readPantryFull does not list "בצלים" as unknown after reading it as onion. */
function scanPantry(text: string): { foods: Food[]; claimed: Set<string> } {
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

  // Second pass over what the exact names left: plurals, prefixes, typos.
  const claimed = new Set<string>();
  for (const raw of masked.split(BREAK)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    const food = forgivingMatch(raw);
    if (!food) continue;
    claimed.add(raw);
    if (!found.has(food.id)) found.set(food.id, food);
  }

  return { foods: [...found.values()], claimed };
}

/** Words that are not foods, so they never become a phantom ingredient. */
const STOPWORDS = new Set([
  "עם", "קצת", "גם", "וגם", "של", "קניתי", "יש", "לי", "היום", "עוד", "טרי", "טרייה",
  "טריים", "קצוץ", "קצוצה", "חצי", "כמה", "מעט", "וחצי", "בבית", "אוכל", "ארוחה",
  "the", "and", "with", "some", "of", "to", "fresh", "bought", "have", "today",
  "little", "bit", "half", "few", "food", "meal", "for",
  // How it is cooked or what state it is in — a description, not a food:
  // "ביצים קשות" is eggs, "בשר קפוא" is meat.
  "סלט", "מרק", "ירקות", "פירות",
  "קשות", "קשה", "קשים", "רכה", "רכות", "מבושל", "מבושלת", "מבושלים", "מבושלות",
  "מטוגן", "מטוגנת", "מטוגנים", "צלוי", "צלויה", "צלויים", "אפוי", "אפויה", "קלוי", "קלויה",
  "קפוא", "קפואה", "קפואים", "קפואות", "מיובש", "מיובשים", "טחון", "טחונה", "פרוס", "פרוסות",
  "מלא", "מלאה", "מלאים", "אורגני", "אורגנית", "ביתי", "ביתית", "גדול", "גדולה", "קטן", "קטנה",
  "אדום", "אדומה", "ירוק", "ירוקה", "צהוב", "צהובה", "שחור", "שחורה", "לבן",
  "boiled", "fried", "grilled", "roasted", "frozen", "dried", "sliced", "whole", "organic",
  "red", "green", "yellow", "black", "white", "large", "small", "big",
  // How it is sold or how much: "2 קילו עגבניות", "קופסת טונה", "מארז ביצים".
  "קילו", "קג", "ק\"ג", "גרם", "גרמים", "גר", "ליטר", "ליטרים", "חבילה", "חבילת", "חבילות",
  "קופסה", "קופסא", "קופסת", "קופסאות", "שקית", "שקיות", "בקבוק", "בקבוקי", "בקבוקים",
  "פחית", "פחיות", "מארז", "מארזים", "מגש", "יחידה", "יחידות", "צנצנת", "קרטון", "תבנית",
  "סלסלה", "סלסלת", "חתיכה", "חתיכות", "נתח", "נתחי", "פילה", "אריזה", "אריזת", "תריסר", "זוג",
  "kg", "gr", "gram", "grams", "liter", "litre", "pack", "packet", "can", "cans", "bottle",
  "bottles", "bag", "box", "jar", "carton", "tray", "dozen", "pieces", "piece",
  // Household measures in a meal sentence: "2 כוסות חלב" is milk, not buckwheat.
  "כוס", "כוסות", "כף", "כפות", "כפית", "כפיות", "פרוסה", "פרוסת", "קערה", "קערת", "צלחת",
  "מנה", "מנת", "מנות", "סקופ", "סקופים", "חופן", "חופנים",
  "cup", "cups", "glass", "tbsp", "tsp", "spoon", "slice", "slices", "bowl", "plate", "serving", "scoop",
]);

/**
 * Reads the list and returns both what it recognised and what it did not — so
 * nothing the person typed is silently dropped. Unknown words become ad-hoc
 * ingredients elsewhere, which is how the kitchen "recognises anything" without
 * a food API: a word it has never seen is still treated as something on the
 * plate, estimated by category.
 */
export function readPantryFull(text: string): { known: Food[]; extras: string[] } {
  const { foods: known, claimed } = scanPantry(text);

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
    if (covered.has(w) || covered.has(raw) || claimed.has(raw)) continue;
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
    // This plate has no name to search for — it is whatever the person bought.
    // The two ingredients it leads with are the best description of it there
    // is, and Commons has photos of most pairs ("chicken rice", "tuna salad").
    // Failing that, `photoQueries` falls back to the lead ingredient alone.
    photo: items.slice(0, 2).map((f) => f.en).join(" "),
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
export type Diet = "all" | "kosher" | "vegetarian" | "glutenFree";

/** The filters a person can switch on, in the order the screen shows them. */
export const DIETS: Exclude<Diet, "all">[] = ["kosher", "vegetarian", "glutenFree"];

/**
 * The switched-on filters from the stored value. Kosher and vegetarian are not
 * alternatives — plenty of people are both — so the setting holds a list
 * ("kosher,vegetarian"); a single value from before still reads the same, and
 * "all" or nothing means no filter.
 */
export function dietList(spec: string | undefined | null): Exclude<Diet, "all">[] {
  if (!spec) return [];
  const parts = spec.split(",").map((x) => x.trim());
  return DIETS.filter((d) => parts.includes(d));
}

/** The stored value for a set of filters. */
export function dietSpec(list: readonly Diet[]): string {
  const on = DIETS.filter((d) => list.includes(d));
  return on.length ? on.join(",") : "all";
}

/**
 * What a typed word the library does not know says about itself — "חזיר
 * בגריל" is pork whatever else it is. Only the unmistakable words: a guess
 * that hides someone's lunch is worse than one that lets it through.
 */
const TREIF_WORDS = ["חזיר", "בייקון", "שרימפס", "קלמרי", "סרטנ", "לובסטר", "פירות ים", "צדפ", "pork", "bacon", " ham ", "shrimp", "prawn", "crab", "lobster", "squid", "octopus", "clam", "oyster", "mussel"];
const MEAT_WORDS = ["בשר", "עוף", "הודו", "כבש", "טלה", "פרגית", "שניצל", "נקניק", "קבב", "סטייק", "meat", "chicken", "beef", "turkey", "lamb", "sausage", "steak"];
const FLESH_WORDS = [...MEAT_WORDS, "דג ", "דגים", "fish", ...TREIF_WORDS];
const GLUTEN_WORDS = ["לחם", "פיתה", "קמח", "בצק", "מאפה", "עוגה", "עוגי", "פסטה", "bread", "flour", "wheat", "pasta", "cake", "cookie", "pastry"];
const DAIRY_WORDS = ["חלב", "גבינ", "שמנת", "יוגורט", "חמאה", "צ'יז", "צ׳יז", "מוצרלה", "פרמזן", "milk", "cheese", "cream", "yogurt", "butter"];

/** The typed word, padded, when the food is one the library does not know. */
function adhocWord(food: Food): string | null {
  return food.id.startsWith("x:") ? ` ${food.he.toLowerCase()} ` : null;
}
const says = (word: string, list: string[]) => list.some((w) => word.includes(w));

function isTreif(f: Food): boolean {
  const w = adhocWord(f);
  return w ? says(w, TREIF_WORDS) : DIET_CLASS.treif.has(f.id);
}
function isFlesh(f: Food): boolean {
  const w = adhocWord(f);
  return w ? says(w, FLESH_WORDS) : DIET_CLASS.flesh.has(f.id);
}
function isGluten(f: Food): boolean {
  const w = adhocWord(f);
  return w ? says(w, GLUTEN_WORDS) : DIET_CLASS.gluten.has(f.id);
}
/** Meat for the kosher meat-and-dairy rule (fish is neither). */
export function isMeat(f: Food): boolean {
  const w = adhocWord(f);
  return w ? says(w, MEAT_WORDS) : DIET_CLASS.meat.has(f.id);
}
/** Dairy for the kosher meat-and-dairy rule. */
export function isDairy(f: Food): boolean {
  const w = adhocWord(f);
  return w ? says(w, DAIRY_WORDS) : DIET_CLASS.dairy.has(f.id) || f.tags.includes("dairy");
}

const foodOf = (id: string): Food | undefined => FOODS.find((f) => f.id === id);

/**
 * Whether a set of foods passes every switched-on filter. Kosher is the
 * practical rule a kitchen can check: no non-kosher animal, and no meat on the
 * same plate as dairy (fish and eggs are neither). Vegetarian excludes any
 * animal flesh but keeps dairy and eggs. Gluten-free excludes wheat, barley,
 * rye and uncertified oats.
 */
export function foodsDietOk(foods: readonly Food[], diet: string | undefined | null): boolean {
  for (const d of dietList(diet)) {
    if (d === "vegetarian" && foods.some(isFlesh)) return false;
    if (d === "glutenFree" && foods.some(isGluten)) return false;
    if (d === "kosher") {
      if (foods.some(isTreif)) return false;
      if (foods.some(isMeat) && foods.some(isDairy)) return false;
    }
  }
  return true;
}

/** Whether a meal passes every switched-on filter. */
export function dietOk(meal: Meal, diet: string | undefined | null): boolean {
  return foodsDietOk(meal.uses.map(foodOf).filter((f): f is Food => !!f), diet);
}

/** The switched-on filters a food someone looks up breaks — for the small
 * "not kosher" note beside it. Takes every reading of what was typed (the
 * library food it matched, and the words themselves), so "שניצל עם גבינה"
 * is caught as meat with dairy even though the library only knows schnitzel. */
export function dietConflicts(foods: readonly Food[], diet: string | undefined | null): Exclude<Diet, "all">[] {
  return dietList(diet).filter((d) => !foodsDietOk(foods, d));
}

/** The words of a query, each also without a leading Hebrew "and"/"the"
 * (ו / ה), so "ופיתה" and "הביצה" are read as "פיתה" and "ביצה". */
function queryWords(q: string): string[] {
  const out: string[] = [];
  for (const w of q.split(/[\s,.;:!?()\-\/+&]+/)) {
    if (!w) continue;
    out.push(w);
    if (w.length > 3 && /^[וה]/.test(w)) out.push(w.slice(1));
  }
  return out;
}

/**
 * Free-text search across the food library, for logging what you actually ate
 * rather than only the curated dishes. Matches any of a food's names, ranks an
 * exact/prefix hit above a mid-word one, and never returns the whole library.
 *
 * This is the piece that makes the diary usable for someone who eats a
 * schnitzel and a pita, not a recipe.
 */
export function searchFoods(query: string, limit = 12): Food[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const food of FOODS) {
    let best = -1;
    for (const term of [food.he, food.en, ...food.match]) {
      const t = term.toLowerCase();
      const at = t.indexOf(q);
      if (at === -1) continue;
      // an exact name beats a prefix, a prefix beats a mid-word hit
      const score = t === q ? 3 : at === 0 ? 2 : 1;
      if (score > best) best = score;
    }
    if (best > 0) scored.push({ food, score: best });
  }
  // Nothing held the whole query: look for a food named INSIDE it, so "חומוס
  // אחלה" or "chicken breast grilled" still finds hummus and chicken instead of
  // an empty list. Only whole words count here — a mid-word fragment of a long
  // query is noise, not a match.
  if (scored.length === 0) {
    const words = ` ${queryWords(q).join(" ")} `;
    for (const food of FOODS) {
      const hit = [food.he, food.en, ...food.match].some((term) => {
        const t = term.toLowerCase();
        return t.length >= 2 && words.includes(` ${t} `);
      });
      if (hit) scored.push({ food, score: 0.5 });
    }
  }
  // Still nothing: a plural, a prefix or a one-letter typo ("שניצלים",
  // "והפיתה", "ברוקלי") — the same forgiveness the fridge list gets.
  if (scored.length === 0) {
    for (const w of q.split(/\s+/)) {
      const food = w.length >= 3 ? forgivingMatch(w) : null;
      if (food && !scored.some((x) => x.food.id === food.id)) scored.push({ food, score: 0.4 });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.he.localeCompare(b.food.he))
    .slice(0, limit)
    .map((x) => x.food);
}

/** What any kitchen already has, so no dish waits on it and no list asks for it. */
export const STAPLES: ReadonlySet<string> = new Set([
  "oliveOil", "canolaOil", "salt", "blackPepper",
  ...FOODS.filter((f) => f.tags[0] === "spice").map((f) => f.id),
]);

/** One thing to buy, and how many of the near-miss meals it would unlock. */
export type ShoppingItem = { food: Food; count: number };

/**
 * The one shopping list behind a set of near-miss meals. Each missing
 * ingredient appears once, carrying how many of those meals it would unlock, so
 * the item that opens the most dishes sits at the top — buy that first.
 */
export function shoppingList(matches: MealMatch[]): ShoppingItem[] {
  const byId = new Map<string, ShoppingItem>();
  for (const m of matches) {
    for (const food of m.missing) {
      const seen = byId.get(food.id);
      if (seen) seen.count += 1;
      else byId.set(food.id, { food, count: 1 });
    }
  }
  return [...byId.values()].sort(
    (a, b) => b.count - a.count || a.food.he.localeCompare(b.food.he),
  );
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
  /**
   * What makes this person's list *theirs*, and today's list different from
   * yesterday's. Two dishes whose goal fit is within a few percent are equally
   * good advice, so which one leads is arbitrary — and an arbitrary choice
   * that never changes is what makes a kitchen feel like it is stuck. The seed
   * decides those ties: fold in a per-device salt and the date and the same
   * fridge serves a different plate each morning, and a different one to your
   * flatmate.
   */
  seed?: string;
};

/**
 * A small stable number from a string — same input, same answer, every run.
 *
 * The final avalanche is not decoration. Without it, FNV's last multiply leaves
 * a one-character difference sitting in the low bits, so `id|seed` values stay
 * in the same relative order for every seed and the "rotation" rotates nothing.
 * The seed also goes first, so it is mixed through the whole hash.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/**
 * How good a meal is *relative to the best one available right now*, as a
 * coarse tier. Everything within a fifth of the best is tier 2 — all of it is
 * sound advice for this goal, so which one leads is arbitrary and the seed may
 * decide. That arbitrary choice is where the variety comes from: rotate inside
 * a tier and the menu genuinely changes day to day without ever promoting a
 * dish that does not serve the goal.
 *
 * Absolute bands were the first attempt and rotated almost nothing: with three
 * dishes at 0.94–1.00 fit and the next at 0.68, only the top three ever moved,
 * and they moved among themselves.
 */
function fitTier(fit: number, best: number): number {
  if (best <= 0) return 0;
  const share = fit / best;
  if (share >= 0.8) return 2;
  if (share >= 0.55) return 1;
  return 0;
}

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
  // Oil, salt, pepper and the spice rack are in every kitchen whether or not
  // they made the list: an omelette is not "almost ready — buy olive oil".
  const have = new Set([...pantry.map((f) => f.id), ...STAPLES]);
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
  const seed = opts.seed ?? "";
  const jitter = (m: MealMatch) => (seed ? hash(`${seed}|${m.meal.id}`) : 0);
  const bestFit = matches.reduce((n, m) => Math.max(n, m.fit), 0);
  const byGoalThenTime = (a: MealMatch, b: MealMatch) =>
    rightTime(b) - rightTime(a) ||
    // Equally-good dishes are ordered by the seed rather than by whichever one
    // happens to sit earlier in the file.
    fitTier(b.fit, bestFit) - fitTier(a.fit, bestFit) ||
    jitter(a) - jitter(b) ||
    b.fit - a.fit;

  const ready = matches.filter((m) => m.ready).sort(byGoalThenTime);

  const almost = matches
    .filter((m) => !m.ready && m.missing.length <= almostGap && m.have.length >= 1)
    // Closest to cookable first; then the same goal-and-time order.
    .sort((a, b) => a.missing.length - b.missing.length || byGoalThenTime(a, b));

  return { ready, almost, pantry };
}

/** A few meals that fit the goal, to show before any list exists. */
export function starterMeals(goal: Goal = "cut", seed = ""): Meal[] {
  const best = MEALS.reduce((n, m) => Math.max(n, goalFit(m, goal)), 0);
  return [...MEALS]
    .sort(
      (a, b) =>
        fitTier(goalFit(b, goal), best) - fitTier(goalFit(a, goal), best) ||
        (seed ? hash(`${seed}|${a.id}`) - hash(`${seed}|${b.id}`) : 0) ||
        goalFit(b, goal) - goalFit(a, goal),
    )
    .slice(0, 4);
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
 * Whether a single ingredient passes the filters on its own. The kosher
 * meat-and-dairy rule is about a *combination*, so it cannot be judged here —
 * `plateForGoal` applies it once the plate is assembled.
 */
export function foodDietOk(food: Food, diet: string | undefined | null): boolean {
  for (const d of dietList(diet)) {
    if (d === "vegetarian" && isFlesh(food)) return false;
    if (d === "glutenFree" && isGluten(food)) return false;
    if (d === "kosher" && isTreif(food)) return false;
  }
  return true;
}

/**
 * How many of a set of meals the dietary filter takes off the table. The
 * kitchen shows this number, because a filter that silently removes nothing
 * visible is indistinguishable from a filter that is broken.
 */
export function dietHidden(matches: MealMatch[], diet: string | undefined | null): number {
  return matches.filter((m) => !dietOk(m.meal, diet)).length;
}

/**
 * How many items of each kind a plate takes, per goal. This is what makes the
 * same fridge produce four different plates: cutting drops the carbs and the
 * oil and leans on protein and vegetables; a bulk piles on carbs and fats;
 * recomp is protein-forward but moderate; maintenance is the even plate.
 */
const PLATE_SHAPE: Record<Goal, Record<FoodTag, number>> = {
  cut: { protein: 2, carb: 0, veg: 3, fat: 0, fruit: 1, dairy: 1, spice: 0, drink: 0, sweet: 0 },
  recomp: { protein: 3, carb: 1, veg: 2, fat: 0, fruit: 1, dairy: 1, spice: 0, drink: 0, sweet: 0 },
  maintain: { protein: 2, carb: 2, veg: 2, fat: 1, fruit: 1, dairy: 1, spice: 0, drink: 0, sweet: 0 },
  bulk: { protein: 3, carb: 3, veg: 1, fat: 2, fruit: 1, dairy: 2, spice: 0, drink: 0, sweet: 0 },
};

/** Which kind of food this is, for plate-building. */
function kindOf(food: Food): FoodTag {
  return food.tags[0] ?? "carb";
}

/** Dairy that belongs with fruit and cereal rather than beside meat. */
const SWEET_DAIRY = new Set(["greekYogurt", "skyr", "kefir", "milk", "cottage", "proteinYogurt", "milky", "leben", "proteinPudding", "chocolateMilk", "iceCream"]);

/** The most ingredients one suggested plate carries. */
const MAX_PLATE = 5;

/** Salt, a coffee or a cake is on the list, but is not what a plate is made of. */
const NOT_A_PLATE = new Set<FoodTag>(["spice", "drink", "sweet"]);

/**
 * The plate the person's own groceries make *for the goal they chose*.
 *
 * The old version dumped every recognised item onto one card, so switching
 * from cut to bulk changed nothing on screen — the complaint that started this.
 * Now the goal decides how many of each kind of food go on the plate, and the
 * dietary filter decides which ingredients are eligible at all, so both
 * controls visibly rewrite the dish instead of only re-sorting the list below.
 *
 * Returns null when nothing survives the filter — two items is the least that
 * reads as a meal.
 */
export function plateForGoal(
  items: Food[],
  slot: MealSlot,
  goal: Goal,
  diet: string = "all",
): Meal | null {
  let eligible = items.filter((f) => !NOT_A_PLATE.has(kindOf(f)) && foodDietOk(f, diet));
  // Kosher's one combination rule: meat and dairy do not share a plate. The
  // meat stays (it is the protein the plate is built on), the dairy steps off.
  if (dietList(diet).includes("kosher") && eligible.some(isMeat)) {
    eligible = eligible.filter((f) => !isDairy(f));
  }
  if (eligible.length < 2) return null;

  const shape = PLATE_SHAPE[goal];
  // Within a kind, take the items that serve the goal best: the leanest,
  // most protein-dense ones when cutting or recomping; the most calorie-dense
  // ones when bulking; the middle ground otherwise.
  const rank = (f: Food) => {
    const n = foodNutrition(f);
    const density = n.kcal > 0 ? n.protein / (n.kcal / 100) : 0;
    if (goal === "cut") return density * 10 - n.kcal / 100;
    if (goal === "recomp") return density * 6 + n.protein;
    if (goal === "bulk") return n.kcal / 10 + n.protein;
    return density * 4 + n.protein / 2;
  };

  const byKind = new Map<FoodTag, Food[]>();
  for (const f of eligible) {
    const k = kindOf(f);
    const list = byKind.get(k);
    if (list) list.push(f);
    else byKind.set(k, [f]);
  }

  // Morning and snack plates are built on eggs, dairy or plant protein when
  // the fridge has them: chicken breast at 8 a.m. is a valid answer, but not
  // the one a person opening the app at breakfast expects.
  const lightMeal = slot === "breakfast" || slot === "snack";
  const morningProtein = (f: Food) => f.id === "egg" || f.id === "omelette" || f.id === "eggWhite" || !isFlesh(f);
  const proteinRank = (f: Food) => rank(f) + (lightMeal && morningProtein(f) ? 1000 : 0);

  const chosen: Food[] = [];
  for (const [kind, all] of byKind) {
    const take = shape[kind] ?? 1;
    const order = kind === "protein" ? proteinRank : rank;
    const list = kind === "protein" && lightMeal && all.some(morningProtein) ? all.filter(morningProtein) : all;
    chosen.push(...[...list].sort((a, b) => order(b) - order(a)).slice(0, take));
  }

  // One plate, one idea. With meat or fish on it, the yogurt and the banana
  // belong to another meal — chicken, broccoli, yogurt, banana and eggs on a
  // single card read as a fridge inventory, not a dish. Hard cheeses and
  // labneh stay: they go with savoury food.
  if (chosen.some((f) => kindOf(f) === "protein" && isFlesh(f))) {
    for (let i = chosen.length - 1; i >= 0; i--) {
      const f = chosen[i]!;
      if (kindOf(f) === "fruit" || SWEET_DAIRY.has(f.id)) chosen.splice(i, 1);
    }
  }
  // And five things at most: protein and carbs first, then the vegetables
  // and the rest, so a long list still yields a plate someone would cook.
  if (chosen.length > MAX_PLATE) {
    const priority: FoodTag[] = ["protein", "carb", "veg", "fat", "dairy", "fruit"];
    chosen.sort((a, b) => priority.indexOf(kindOf(a)) - priority.indexOf(kindOf(b)));
    chosen.length = MAX_PLATE;
  }
  // A goal that wants none of what is in the fridge must still yield a plate:
  // top it up with whatever ranks best among the leftovers.
  if (chosen.length < 2) {
    const rest = eligible
      .filter((f) => !chosen.includes(f))
      .sort((a, b) => rank(b) - rank(a));
    for (const f of rest) {
      if (chosen.length >= 2) break;
      chosen.push(f);
    }
  }
  if (chosen.length < 2) return null;

  // Keep the order the person wrote their list in, so the plate reads back
  // like their own groceries rather than a re-shuffled set.
  const ordered = eligible.filter((f) => chosen.includes(f));
  const base = yourPlate(ordered, slot);

  // A small fridge cannot always yield four different ingredient lists — with
  // one carb on the shelf, every goal keeps that carb. What still changes is
  // how much of it goes on the plate, which is the advice a coach would give
  // anyway: on a cut the protein grows and the carbs and oil shrink; on a bulk
  // both go up. So the portions carry the goal even when the ingredients cannot.
  //
  // The card lists each ingredient's scaled amount, and the totals are the
  // sum of exactly those amounts — grams on the card and calories on the card
  // can never disagree.
  //
  // Two proteins on one plate share the protein portion rather than each
  // taking a whole one: shawarma and chicken thighs for a cut is one big
  // portion of meat between them, not 380 g. The same goes for carbs, fats and
  // dairy. Vegetables are the exception — a plate can hold a full portion of
  // each.
  const mult = PLATE_PORTION[goal];
  const perKind = new Map<FoodTag, number>();
  for (const f of ordered) perKind.set(kindOf(f), (perKind.get(kindOf(f)) ?? 0) + 1);
  const amounts: Record<string, Portion> = {};
  let kcal = 0;
  let protein = 0;
  for (const f of ordered) {
    const kind = kindOf(f);
    const whole = mult[kind] ?? 1;
    const share = kind === "veg" ? 1 : perKind.get(kind) ?? 1;
    const m = share > 1 ? Math.max(0.5, Math.round((whole / share) * 4) / 4) : whole;
    const std = portion(f.id);
    const g = m === 1 ? std.g : Math.max(1, Math.round((std.g * m) / 5) * 5);
    amounts[f.id] = g === std.g ? std : { g, he: scaledHousehold(std.he, g / std.g, "he"), en: scaledHousehold(std.en, g / std.g, "en") };
    const n = gramsNutrition(f, g);
    kcal += n.kcal;
    protein += n.protein;
  }
  const note = PORTION_NOTE[goal];
  return {
    ...base,
    amounts,
    kcal,
    protein,
    he: { ...base.he, how: `${base.he.how} ${note.he}` },
    en: { ...base.en, how: `${base.en.how} ${note.en}` },
  };
}

/** How big each part of the plate is, per goal — see plateForGoal. */
const PLATE_PORTION: Record<Goal, Partial<Record<FoodTag, number>>> = {
  cut: { protein: 1.25, carb: 0.6, fat: 0.5, fruit: 0.8 },
  recomp: { protein: 1.25, carb: 0.85, fat: 0.75 },
  maintain: {},
  bulk: { protein: 1.2, carb: 1.6, fat: 1.4, dairy: 1.2, fruit: 1.2 },
};

/** The one line that tells the person what the goal did to their portions. */
const PORTION_NOTE: Record<Goal, { he: string; en: string }> = {
  cut: { he: "לחיטוב: מנת חלבון גדולה, פחמימה ושומן במנה קטנה.", en: "Cutting: a big protein portion, carbs and fat kept small." },
  recomp: { he: "למיצוק: חלבון מוגדל, פחמימה ושומן מתונים.", en: "Recomp: protein up, carbs and fat moderate." },
  maintain: { he: "לשמירה: מנות רגילות, צלחת מאוזנת.", en: "Maintaining: normal portions, an even plate." },
  bulk: { he: "למסה: מנה גדולה — פחמימה ושומן מוגדלים.", en: "Bulking: a big plate — carbs and fat scaled up." },
};
