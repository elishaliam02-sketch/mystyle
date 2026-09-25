/**
 * "I ate two eggs and rice" → a diary entry.
 *
 * The coach should be able to *do* the thing, not just talk about it: type what
 * you ate and it lands in today's food log with an estimate. This reads the
 * sentence against the food library the kitchen already knows, pulls a quantity
 * off the front of each food when one is written, and sums the calories and
 * protein. Pure — the screen does the actual logging — so it is fully testable
 * and can never write junk it did not mean to.
 */
import { FOODS, gramsNutrition, portion, readPantry, type Food } from "@/kitchen";

export type EatenItem = {
  food: Food;
  count: number;
  /** The weight this reading comes to — what the calculator puts on the plate. */
  grams: number;
  label: string;
  kcal: number;
  protein: number;
};

export type EatenMeal = {
  items: EatenItem[];
  kcal: number;
  protein: number;
};

/** Verbs that mean "I consumed this", in both languages. */
const EAT_WORDS = [
  "אכלתי", "אכלנו", "אכל", "שתיתי", "שתינו", "טרפתי", "זללתי", "נשנשתי",
  "ate", "eaten", "had", "drank", "ate a", "just ate", "i had",
];

/** Number words → their value, for "שתי ביצים", "three eggs". */
const NUMBER_WORDS: Record<string, number> = {
  "חצי": 0.5,
  "אחד": 1, "אחת": 1, "one": 1, "a": 1, "an": 1,
  "שתי": 2, "שתיים": 2, "שני": 2, "two": 2, "couple": 2,
  "שלוש": 3, "שלושה": 3, "three": 3,
  "ארבע": 4, "ארבעה": 4, "four": 4,
  "חמש": 5, "חמישה": 5, "five": 5,
  "שש": 6, "שישה": 6, "six": 6,
  "שבע": 7, "שבעה": 7, "seven": 7,
  "שמונה": 8, "eight": 8,
  "תשע": 9, "תשעה": 9, "nine": 9,
  "עשר": 10, "עשרה": 10, "ten": 10,
};

/** Is this message telling the coach about something that was eaten? */
export function eatIntent(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return EAT_WORDS.some((w) => t.includes(` ${w} `) || t.includes(`${w} `));
}

const MAX_COUNT = 50;

/** No sensible meal holds more than this many grams of one food. */
const MAX_GRAMS = 2000;

/** Where a food's name starts among the tokens, or -1. */
function foodAt(tokens: string[], foodTerms: string[]): number {
  const firstWords = foodTerms.map((s) => s.toLowerCase().split(/\s+/)[0]!);
  const bare = (tok: string) => (tok.length > 2 && /^[והבל]/.test(tok) ? tok.slice(1) : tok);
  for (let i = 0; i < tokens.length; i++) {
    if (firstWords.includes(tokens[i]!) || firstWords.includes(bare(tokens[i]!))) return i;
  }
  return -1;
}

function numberOf(tok: string | undefined): number | null {
  if (!tok) return null;
  const word = tok.replace(/^ו/, "");
  if (NUMBER_WORDS[word] !== undefined) return NUMBER_WORDS[word]!;
  if (!/\d/.test(tok)) return null;
  const digits = Number(tok.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(digits) && digits > 0 ? digits : null;
}

/** The household measures people write between a number and a food. */
export type Unit =
  | "slice" | "cup" | "tbsp" | "tsp" | "bowl" | "plate" | "portion" | "piece"
  | "scoop" | "can" | "bottle" | "bag" | "handful";

/** "פרוסות", "כוס", "tbsp" → the measure; null for any other word. Fixed
 * prefixes only, so nothing is built from what was typed. */
export function unitOf(token: string): Unit | null {
  const w = token.length > 2 && /^[וה]/.test(token) ? token.slice(1) : token;
  if (w.startsWith("פרוס") || /^slices?$/.test(w)) return "slice";
  if (w === "כוס" || w === "כוסות" || /^(cups?|glass(es)?)$/.test(w)) return "cup";
  if (w === "כפית" || w === "כפיות" || /^(tsp|teaspoons?)$/.test(w)) return "tsp";
  if (w === "כף" || w === "כפות" || /^(tbsp|tablespoons?|spoons?)$/.test(w)) return "tbsp";
  if (w.startsWith("קער") || /^bowls?$/.test(w)) return "bowl";
  if (w.startsWith("צלחת") || w === "צלחות" || /^plates?$/.test(w)) return "plate";
  if (w === "מנה" || w === "מנת" || w === "מנות" || /^(servings?|portions?)$/.test(w)) return "portion";
  if (w.startsWith("חתיכ") || w.startsWith("יחיד") || /^(pieces?|units?)$/.test(w)) return "piece";
  if (w.startsWith("סקופ") || /^scoops?$/.test(w)) return "scoop";
  if (w.startsWith("פחי") || /^cans?$/.test(w)) return "can";
  if (w.startsWith("בקבוק") || /^bottles?$/.test(w)) return "bottle";
  if (w.startsWith("שקי") || /^(bags?|packs?)$/.test(w)) return "bag";
  if (w.startsWith("חופן") || w === "חופנים" || /^handfuls?$/.test(w)) return "handful";
  return null;
}

/** How the food's own standard portion is written in each measure. */
const UNIT_IN_PORTION: Record<Unit, RegExp> = {
  slice: /פרוס/, cup: /כוס/, tbsp: /(^|\s)(כף|כפות)(\s|$)/, tsp: /כפי(ת|ות)/, bowl: /קער/,
  plate: /צלחת/, portion: /מנה/, piece: /(יחיד|חתיכ)/, scoop: /סקופ/, can: /פחית/,
  bottle: /בקבוק/, bag: /שקית/, handful: /חופן/,
};

/** A measure the food's portion does not use, in grams — a household guess. */
const UNIT_GRAMS: Partial<Record<Unit, number>> = {
  slice: 30, cup: 200, tbsp: 15, tsp: 5, scoop: 30, can: 330, bottle: 500, bag: 50, handful: 30,
};

/** How many of its measure a standard portion is: "2 ביצים" → 2, "חצי כוס" → ½. */
function unitsInPortion(he: string): number {
  if (/^חצי/.test(he)) return 0.5;
  if (/^רבע/.test(he)) return 0.25;
  return Number(/^(\d+)\s/.exec(he)?.[1] ?? 1) || 1;
}

/** The grams in one of `unit` of this food. */
function unitGrams(food: Food, unit: Unit, cookedCup: boolean): number {
  const std = portion(food.id);
  if (UNIT_IN_PORTION[unit].test(std.he)) {
    // A dry grain's "cup" in a sentence is a cup of it cooked — about 60 g dry.
    if (unit === "cup" && cookedCup && /יבש/.test(std.he)) return 60;
    return std.g / unitsInPortion(std.he);
  }
  if (unit === "cup" && cookedCup && /יבש/.test(std.he)) return 60;
  // A slice of something served in pieces (pizza, cake, melon) is one piece.
  if ((unit === "slice" || unit === "piece") && /(משולש|ריבוע|פלח|יחיד|חתיכ)/.test(std.he)) {
    return std.g / unitsInPortion(std.he);
  }
  return UNIT_GRAMS[unit] ?? std.g / unitsInPortion(std.he);
}

/** The amount written before a food's name: a count ("2 ביצים"), a count of a
 * measure ("3 פרוסות לחם", "כוס חלב", "חצי פיתה"), or null when none is. */
function amountBefore(tokens: string[], foodTerms: string[]): { n: number; unit: Unit | null } | null {
  const at = foodAt(tokens, foodTerms);
  if (at <= 0) return null;
  const prev = tokens[at - 1]!;
  const unit = unitOf(prev);
  if (unit) {
    // "כוס חלב" is one cup; "2 כוסות חלב" two; "חצי כוס" half.
    const n = numberOf(tokens[at - 2]) ?? 1;
    return { n: Math.min(MAX_COUNT, n), unit };
  }
  const n = numberOf(prev);
  return n === null ? null : { n: Math.min(MAX_COUNT, n), unit: null };
}

/** Is there any amount in this text — a number, a number word or a measure? */
export function mentionsAmount(text: string): boolean {
  const tokens = text.toLowerCase().split(/[\s,.;:/()·|\n\t]+/).filter(Boolean);
  return tokens.some((t) => numberOf(t) !== null || unitOf(t) !== null);
}

/** Dry staples whose cooked twin is what a sentence means ("אורז" on a plate is
 * cooked rice, weighed cooked) unless it says dry. */
const COOKED_TWIN: Record<string, string> = { rice: "cookedRice", pasta: "cookedPasta" };

/**
 * Reads a "what I ate" sentence into diary items. Returns null when no food in
 * the library is recognised — the coach then answers in words instead of
 * logging a guess.
 */
export function parseEaten(text: string, locale: "he" | "en" = "he"): EatenMeal | null {
  const lower = text.toLowerCase();
  const saysDry = /(יבש|לא מבושל|\bdry\b|\braw\b|\buncooked\b)/.test(lower);
  const found = readPantry(text);
  if (found.length === 0) return null;
  // Rice and pasta in a sentence are the cooked food: keep the words the
  // person wrote (they are the dry food's match terms) but weigh it cooked.
  const foods: { food: Food; terms: string[] }[] = [];
  for (const food of found) {
    const twin = !saysDry && COOKED_TWIN[food.id] ? FOODS.find((f) => f.id === COOKED_TWIN[food.id]) : undefined;
    const use = twin ?? food;
    if (foods.some((x) => x.food.id === use.id)) continue;
    foods.push({ food: use, terms: twin ? [...food.match, ...twin.match] : food.match });
  }

  const tokens = lower.split(/[\s,.;:/()·|\n\t]+/).filter(Boolean);
  // In the order they were written, so the reading reads like the sentence.
  const where = (terms: string[]) => {
    const at = terms.map((x) => lower.indexOf(x.toLowerCase())).filter((i) => i >= 0);
    return at.length ? Math.min(...at) : Number.MAX_SAFE_INTEGER;
  };
  foods.sort((a, b) => where(a.terms) - where(b.terms));

  const items: EatenItem[] = [];
  for (const { food, terms } of foods) {
    const name = locale === "he" ? food.he : food.en;
    const std = portion(food.id);
    // A portion written as "2 ביצים" or "5 כדורים" is several units; a number
    // the person writes counts units, not portions — "2 ביצים" is two eggs,
    // not two portions of two.
    const perPortion = Number(/^(\d+)\s/.exec(std.he)?.[1] ?? 1) || 1;
    const unitG = std.g / perPortion;

    let grams: number;
    let count: number;
    let label: string;
    const weighed = gramsBefore(lower, terms) ?? gramsAfter(lower, terms);
    if (weighed !== null) {
      grams = weighed;
      count = Math.round((grams / unitG) * 10) / 10;
      label = `${name} · ${grams} ${locale === "he" ? "ג'" : "g"}`;
    } else {
      const written = amountBefore(tokens, terms);
      if (written !== null && written.unit) {
        count = written.n;
        grams = Math.round(written.n * unitGrams(food, written.unit, !saysDry));
        label = written.n === 1 ? name : `${written.n}× ${name}`;
      } else if (written !== null) {
        count = written.n;
        grams = Math.round(count * unitG);
        label = count === 1 ? name : `${count}× ${name}`;
      } else {
        // No number: one of it when the word itself is singular and the food
        // has a plural ("ביצה" beside "ביצים"), otherwise a normal portion.
        count = perPortion > 1 && saidOne(tokens, terms) ? 1 : perPortion;
        grams = Math.round(count * unitG);
        label = name;
      }
    }
    grams = Math.min(MAX_GRAMS, Math.max(1, grams));
    const n = gramsNutrition(food, grams);
    if (n.kcal <= 0) continue;
    items.push({ food, count, grams, label, kcal: n.kcal, protein: n.protein });
  }
  if (items.length === 0) return null;

  return {
    items,
    kcal: items.reduce((n, i) => n + i.kcal, 0),
    protein: items.reduce((n, i) => n + i.protein, 0),
  };
}

/** A weight and its unit, then whatever follows: "200 גרם חזה עוף". Fixed,
 * so no pattern is ever built from text. */
const WEIGHED = /(\d+(?:[.,]\d+)?)\s*(?:גרם|גר'|גר|ג'|ג׳|grams|gram|gr|g)\s+(?:של\s+)?/g;

/** "200 גרם חזה עוף", "150g rice" → the grams written before the food. */
function gramsBefore(text: string, terms: string[]): number | null {
  const names = terms.map((x) => x.toLowerCase());
  for (const m of text.matchAll(WEIGHED)) {
    const rest = text.slice((m.index ?? 0) + m[0].length).replace(/^ה/, "");
    if (!names.some((n) => rest.startsWith(n))) continue;
    const g = Number(m[1]!.replace(",", "."));
    if (Number.isFinite(g) && g > 0) return Math.min(MAX_GRAMS, Math.round(g));
  }
  return null;
}

/** A weight written after the food: "חזה עוף 200 גרם", "rice 150g". */
const WEIGHED_AFTER = /^\s*(\d+(?:[.,]\d+)?)\s*(?:גרם|גר'|גר|ג'|ג׳|grams|gram|gr|g)(?![a-zא-ת])/;

function gramsAfter(text: string, terms: string[]): number | null {
  for (const term of terms.map((x) => x.toLowerCase())) {
    let at = text.indexOf(term);
    while (at !== -1) {
      const m = WEIGHED_AFTER.exec(text.slice(at + term.length));
      if (m) {
        const g = Number(m[1]!.replace(",", "."));
        if (Number.isFinite(g) && g > 0) return Math.min(MAX_GRAMS, Math.round(g));
      }
      at = text.indexOf(term, at + 1);
    }
  }
  return null;
}

/** True when the food was named in the singular and it has a plural too. */
function saidOne(tokens: string[], terms: string[]): boolean {
  const lower = terms.map((x) => x.toLowerCase());
  return tokens.some((tok) => {
    const bare = tok.replace(/^[וה]/, "");
    if (!lower.includes(bare) || /(ים|ות|s)$/.test(bare)) return false;
    const stem = bare.slice(0, -1);
    return lower.some((x) => x !== bare && x.startsWith(stem) && /(ים|ות|s)$/.test(x));
  });
}

/** The single diary line for a logged meal. */
export function eatenLabel(meal: EatenMeal): string {
  return meal.items.map((i) => i.label).slice(0, 4).join(", ");
}
