import { FOODS, SCORE_EXTRA, portion, type Food, type FoodTag } from "./data";

/**
 * "Can I eat this?" — a food, priced out of ten.
 *
 * Somebody types what they feel like eating and gets a number back: 8.4 for
 * tuna, 2.6 for a sausage. The number is the point of the feature, so it has to
 * mean something rather than being a vibe with a decimal place on it.
 *
 * It is worked out here, on the device, from what the food *is*: its category,
 * then the handful of properties that actually separate two foods in the same
 * category. A lentil and a slice of white bread are both carbohydrate; what
 * makes one better dinner than the other is fibre, processing and what happens
 * to blood sugar — so those are what the modifiers below say, one list each,
 * the same way the dietary filters are written in `index.ts`.
 *
 * Three things this deliberately is not:
 *
 * - It is not a calorie count. A score answers "is this a good idea", which is
 *   the question actually being asked; calories are already elsewhere.
 * - It is not a verdict on a person. Nothing scores zero, nothing is forbidden,
 *   and the bands are named "sometimes" and "rarely" rather than "bad" — an app
 *   that tells someone their dinner is worthless is not helping them lose
 *   weight, it is teaching them to hide it.
 * - It is not a lab measurement, and the UI says so. These are the same honest
 *   ballparks as the rest of the kitchen.
 *
 * It runs offline, on every keystroke, and nothing about what somebody typed
 * leaves the phone to produce it.
 */

export type ScoreBand = "great" | "good" | "ok" | "sometimes" | "rarely";

/** Why a food scored what it did. The words live in `src/i18n`. */
export type ScoreReason =
  | "protein"
  | "fibre"
  | "wholegrain"
  | "omega3"
  | "fermented"
  | "goodFat"
  | "refined"
  | "addedSugar"
  | "processed"
  | "satFat"
  | "salt"
  | "energyDense"
  | "wholeFood"
  | "guess";

export type FoodScore = {
  /** 0–10, to one decimal. */
  value: number;
  band: ScoreBand;
  /** The three things that moved the number most, best news first. */
  reasons: ScoreReason[];
  /** False when the food is not in the library and the score is read off words. */
  known: boolean;
};

/**
 * Where each category starts before anything is known about the particular
 * food. Vegetables lead because almost nothing about a vegetable can drag it
 * down; fat starts low and is lifted by `GOOD_FAT`, because olive oil and
 * mayonnaise genuinely do not belong at the same number.
 */
const BASE: Record<FoodTag, number> = {
  veg: 8.4,
  fruit: 7.8,
  protein: 7.0,
  dairy: 6.4,
  carb: 6.0,
  fat: 5.6,
  // A seasoning is neither good nor bad by itself; a drink is judged by what
  // is in it; a sweet starts where a treat belongs.
  spice: 5.6,
  drink: 6.0,
  sweet: 3.4,
};

/** Whole grains: the fibre and the slower release are the whole difference. */
const WHOLEGRAIN = new Set([
  "oats", "quinoa", "bulgur", "freekeh", "barley", "buckwheat", "brownRice",
  "millet", "wholeBread", "pitaWhole",
]);

/** Refined starch: the same grain with the part that fills you up taken out. */
const REFINED = new Set([
  "bread", "rice", "pasta", "couscous", "tortilla", "bagel", "noodles", "pita",
  "cornflakes", "riceCakes",
]);

/** Made in a factory rather than a kitchen. */
const PROCESSED = new Set([
  "sausage", "mayo", "ketchup", "creamCheese", "yellowCheese", "cornflakes",
  "proteinPowder", "pork",
]);

/** Sugar that was added rather than grown. */
const ADDED_SUGAR = new Set(["honey", "granola", "ketchup", "cornflakes"]);

/** Meaningful saturated fat. */
const SAT_FAT = new Set([
  "butter", "creamCheese", "yellowCheese", "beef", "lamb", "pork", "sausage",
  "darkChocolate", "mozzarella",
]);

/** Red and processed meat, which is its own line in every dietary guideline. */
const RED_MEAT = new Set(["beef", "lamb", "pork", "sausage"]);

/** Oily fish — the omega-3 is the reason these are singled out everywhere. */
const OILY_FISH = new Set(["salmon", "sardines", "mackerel"]);

/** The leaner fish and seafood: some of the same benefit, less of the oil. */
const LIGHT_FISH = new Set(["tuna", "fish", "shrimp"]);

/** Lean protein: the protein without much that comes with it. */
const LEAN_PROTEIN = new Set([
  "chicken", "turkey", "egg", "tofu", "tempeh", "fish", "tuna", "shrimp",
  "edamame", "cottage", "skyr", "greekYogurt",
]);

/** Pulses: protein and fibre in the same mouthful. */
const LEGUME = new Set([
  "lentils", "chickpeas", "beans", "blackBeans", "fava", "edamame", "peas",
  "hummusSpread",
]);

/** Where the fibre actually is. */
const HIGH_FIBRE = new Set([
  "lentils", "chickpeas", "beans", "blackBeans", "fava", "peas", "berries",
  "apple", "pear", "broccoli", "brusselsSprouts", "artichoke", "chia",
  "flaxseed", "oats", "barley", "freekeh", "avocado", "raspberries",
]);

/** Fermented foods, for what they do for the gut. */
const FERMENTED = new Set([
  "kimchi", "kefir", "skyr", "greekYogurt", "labneh", "tempeh", "cottage",
]);

/** The fats worth eating. Without this every fat would score like butter. */
const GOOD_FAT = new Set([
  "oliveOil", "tahini", "nuts", "almonds", "walnuts", "pumpkinSeeds",
  "sunflowerSeeds", "chia", "flaxseed", "peanutButter", "olives", "avocado",
]);

/** Salty enough to matter if it is a daily habit. */
const SALTY = new Set(["olives", "feta", "sausage", "sardines", "kimchi", "ketchup"]);

/** Easy to eat a lot of without noticing. */
const ENERGY_DENSE = new Set([
  "butter", "mayo", "oliveOil", "peanutButter", "nuts", "darkChocolate",
  "granola", "dates",
]);

// The foods of ./foods2.ts say what they are in their own row; fold that in so
// a pizza is read as processed and a tilapia as lean fish, like the rest.
for (const [letter, set] of [
  ["p", PROCESSED], ["s", ADDED_SUGAR], ["r", REFINED], ["w", WHOLEGRAIN], ["l", LEGUME],
  ["o", GOOD_FAT], ["n", LEAN_PROTEIN], ["x", SAT_FAT], ["m", RED_MEAT], ["y", SALTY],
  ["e", ENERGY_DENSE], ["k", FERMENTED], ["f", HIGH_FIBRE], ["3", OILY_FISH], ["4", LIGHT_FISH],
] as const) {
  for (const id of SCORE_EXTRA[letter] ?? []) set.add(id);
}

/** Each nudge, and the reason it prints. Order is the order they are shown. */
const MODIFIERS: { set: Set<string>; delta: number; reason: ScoreReason }[] = [
  { set: OILY_FISH, delta: 1.3, reason: "omega3" },
  { set: LIGHT_FISH, delta: 0.5, reason: "omega3" },
  { set: WHOLEGRAIN, delta: 1.3, reason: "wholegrain" },
  { set: LEGUME, delta: 0.9, reason: "fibre" },
  { set: GOOD_FAT, delta: 1.6, reason: "goodFat" },
  { set: LEAN_PROTEIN, delta: 0.6, reason: "protein" },
  { set: HIGH_FIBRE, delta: 0.5, reason: "fibre" },
  { set: FERMENTED, delta: 0.4, reason: "fermented" },
  { set: REFINED, delta: -1.4, reason: "refined" },
  { set: ADDED_SUGAR, delta: -1.6, reason: "addedSugar" },
  { set: PROCESSED, delta: -2.4, reason: "processed" },
  { set: SAT_FAT, delta: -1.1, reason: "satFat" },
  { set: RED_MEAT, delta: -0.9, reason: "satFat" },
  { set: SALTY, delta: -0.7, reason: "salt" },
  { set: ENERGY_DENSE, delta: -0.8, reason: "energyDense" },
];

/** The most a way of cooking can add to a food the library already knows. */
const PRAISE_CAP = 0.4;

/** Nothing is forbidden and nothing is perfect — the ends are never reached. */
const FLOOR = 1.2;
const CEILING = 9.8;

export function bandOf(value: number): ScoreBand {
  if (value >= 8.5) return "great";
  if (value >= 7) return "good";
  if (value >= 5.5) return "ok";
  if (value >= 3.5) return "sometimes";
  return "rarely";
}

/** A food out of ten, with the reasons that got it there. */
export function scoreFood(food: Food): FoodScore {
  const tag = food.tags[0] ?? "carb";
  let value = BASE[tag];
  const up: ScoreReason[] = [];
  const down: ScoreReason[] = [];

  for (const { set, delta, reason } of MODIFIERS) {
    if (!set.has(food.id)) continue;
    value += delta;
    const into = delta > 0 ? up : down;
    if (!into.includes(reason)) into.push(reason);
  }

  // A little credit for protein density, which is what makes a food filling
  // per calorie — the one thing that matters for weight loss across every
  // category, rather than within one.
  const perHundred = proteinPerHundred(food);
  if (perHundred >= 10) {
    value += Math.min(0.6, (perHundred - 10) / 25);
    if (!up.includes("protein")) up.push("protein");
  }

  // A plain whole food — a cucumber, a pear — trips none of the lists above,
  // and "no reason given" reads as the app having nothing to say about it. What
  // it has to say is exactly that: this is a food, not a product.
  if (up.length === 0 && down.length === 0) up.push("wholeFood");

  value = Math.max(FLOOR, Math.min(CEILING, value));
  return {
    value: Math.round(value * 10) / 10,
    band: bandOf(value),
    // Good news first: somebody reading a 4.1 is better served by "it does have
    // protein" ahead of the two things dragging it down, and the list is short
    // enough that the bad news is never buried.
    reasons: [...up, ...down].slice(0, 3),
    known: !food.id.startsWith("x:"),
  };
}

function proteinPerHundred(food: Food): number {
  const tag = food.tags[0] ?? "carb";
  const byTag: Record<FoodTag, number> = {
    protein: 22, dairy: 9, carb: 5, veg: 2, fruit: 1, fat: 8, spice: 2, drink: 0.5, sweet: 5,
  };
  // Portion size is not nutrition, but a food stored in 15 g spoons is a
  // condiment and one stored in 150 g servings is dinner, and treating a spoon
  // of tahini as a protein source is how a score stops being believable.
  const g = portion(food.id).g;
  return g < 25 ? byTag[tag] * 0.6 : byTag[tag];
}

/**
 * Words that price a food the library has never heard of.
 *
 * Somebody typing "fried schnitzel" deserves an answer, and "I don't know" is
 * not one. How a thing is cooked and what kind of thing it is carry most of the
 * signal, in both languages — and the result is always marked as a guess, so
 * the number is never dressed up as more than it is.
 */
const WORD_HINTS: { words: string[]; delta: number; reason: ScoreReason }[] = [
  { words: ["fried", "deep fried", "מטוגן", "מטוגנת", "בטיגון"], delta: -2.2, reason: "processed" },
  { words: ["cake", "cookie", "biscuit", "donut", "pastry", "candy", "chocolate bar", "עוגה", "עוגת", "עוגיה", "עוגייה", "עוגיות", "סופגניה", "ממתק", "ממתקים", "מאפה"], delta: -3.2, reason: "addedSugar" },
  { words: ["soda", "cola", "energy drink", "משקה מוגז", "משקאות מוגזים", "קולה", "משקה אנרגיה"], delta: -3.6, reason: "addedSugar" },
  { words: ["chips", "crisps", "צ'יפס", "חטיף", "חטיפים", "במבה", "ביסלי"], delta: -3.0, reason: "processed" },
  { words: ["burger", "pizza", "shawarma", "hot dog", "המבורגר", "פיצה", "שווארמה", "נקניקייה"], delta: -2.4, reason: "processed" },
  { words: ["schnitzel", "שניצל"], delta: -1.8, reason: "processed" },
  { words: ["juice", "מיץ"], delta: -1.4, reason: "addedSugar" },
  { words: ["white bread", "לחם לבן"], delta: -1.4, reason: "refined" },
  { words: ["salad", "סלט"], delta: 1.8, reason: "fibre" },
  { words: ["soup", "מרק"], delta: 1.0, reason: "fibre" },
  { words: ["grilled", "baked", "steamed", "boiled", "roast", "בגריל", "בתנור", "מאודה", "מבושל", "צלוי", "אפוי"], delta: 1.2, reason: "protein" },
  { words: ["vegetables", "veggies", "greens", "ירקות", "עלים ירוקים"], delta: 1.6, reason: "fibre" },
  { words: ["whole grain", "wholemeal", "wholegrain", "מלא", "מחיטה מלאה"], delta: 1.2, reason: "wholegrain" },
  { words: ["fish", "דג", "דגים"], delta: 1.0, reason: "omega3" },
  { words: ["yogurt", "יוגורט"], delta: 0.8, reason: "fermented" },
];

/** Where an unknown food starts: squarely in the middle, committing to nothing. */
const UNKNOWN_BASE = 5.4;

/**
 * A score for something the library does not know, read off the words. Always
 * flagged as a guess.
 */
export function scoreWords(text: string): FoodScore {
  const hay = ` ${text.toLowerCase().trim()} `;
  let value = UNKNOWN_BASE;
  const up: ScoreReason[] = [];
  const down: ScoreReason[] = [];

  for (const { words, delta, reason } of WORD_HINTS) {
    if (!words.some((w) => hay.includes(` ${w} `) || hay.includes(`${w} `) || hay.includes(` ${w}`))) {
      continue;
    }
    value += delta;
    const into = delta > 0 ? up : down;
    if (!into.includes(reason)) into.push(reason);
  }

  value = Math.max(FLOOR, Math.min(CEILING, value));
  return {
    value: Math.round(value * 10) / 10,
    band: bandOf(value),
    reasons: [...up, ...down, "guess" as const].slice(0, 3),
    known: false,
  };
}

/**
 * The score for anything somebody types: the library's answer when it knows the
 * food, and the words' answer when it does not.
 */
export function scoreAnything(text: string): { score: FoodScore; food: Food | null } {
  const word = text.trim();
  if (!word) return { score: scoreWords(""), food: null };

  const hay = ` ${word.toLowerCase()} `;
  // The longest matching name wins, exactly as the pantry reader does it, so
  // "whole grain bread" is not read as "bread".
  let best: { food: Food; length: number } | null = null;
  for (const food of FOODS) {
    for (const name of food.match) {
      if (!hay.includes(name.toLowerCase())) continue;
      if (!best || name.length > best.length) best = { food, length: name.length };
    }
  }

  // A known food inside a longer phrase is only the answer when the phrase adds
  // nothing: "tuna" is tuna, but "fried tuna" is not simply tuna, and the words
  // know that where the library does not.
  if (best && word.length <= best.length + 3) {
    return { score: scoreFood(best.food), food: best.food };
  }
  if (best) {
    const fromFood = scoreFood(best.food);
    const fromWords = scoreWords(word);
    // Blend: the library knows the ingredient, the words know what was done to
    // it. Neither alone is right for "fried chicken".
    //
    // The two directions are not symmetrical, deliberately. Frying a good food
    // genuinely ruins it, so the whole penalty lands; grilling a good food is
    // merely the absence of ruining it, and letting a cooking method push
    // salmon to 9.8 makes the top of the scale meaningless. Praise is capped,
    // blame is not.
    const shift = fromWords.value - UNKNOWN_BASE;
    const value = Math.max(
      FLOOR,
      Math.min(CEILING, fromFood.value + Math.min(shift, PRAISE_CAP)),
    );
    return {
      score: {
        value: Math.round(value * 10) / 10,
        band: bandOf(value),
        reasons: [
          ...new Set([...fromWords.reasons.filter((r) => r !== "guess"), ...fromFood.reasons]),
        ].slice(0, 3),
        known: true,
      },
      food: best.food,
    };
  }
  return { score: scoreWords(word), food: null };
}
