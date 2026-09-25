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
import { gramsNutrition, portion, readPantry, type Food } from "@/kitchen";

export type EatenItem = {
  food: Food;
  count: number;
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

/** The quantity written just before a food's name, or null when none is. */
function countBefore(tokens: string[], foodTerms: string[]): number | null {
  const lowerTerms = foodTerms.map((s) => s.toLowerCase());
  // find where the food's first word appears
  let at = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (lowerTerms.some((term) => term.split(/\s+/)[0] === tokens[i])) {
      at = i;
      break;
    }
  }
  if (at <= 0) return null;
  const prev = tokens[at - 1]!;
  if (NUMBER_WORDS[prev] !== undefined) return Math.min(MAX_COUNT, NUMBER_WORDS[prev]!);
  const digits = Number(prev.replace(/[^\d.]/g, ""));
  if (Number.isFinite(digits) && digits > 0) return Math.min(MAX_COUNT, digits);
  return null;
}

/**
 * Reads a "what I ate" sentence into diary items. Returns null when no food in
 * the library is recognised — the coach then answers in words instead of
 * logging a guess.
 */
export function parseEaten(text: string, locale: "he" | "en" = "he"): EatenMeal | null {
  const foods = readPantry(text);
  if (foods.length === 0) return null;

  const lower = text.toLowerCase();
  const tokens = lower.split(/[\s,.;:/()·|\n\t]+/).filter(Boolean);

  const items: EatenItem[] = [];
  for (const food of foods) {
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
    const weighed = gramsBefore(lower, food.match);
    if (weighed !== null) {
      grams = weighed;
      count = Math.round((grams / unitG) * 10) / 10;
      label = `${name} · ${grams} ${locale === "he" ? "ג'" : "g"}`;
    } else {
      const written = countBefore(tokens, food.match);
      if (written !== null) {
        count = written;
        grams = Math.round(count * unitG);
        label = count === 1 ? name : `${count}× ${name}`;
      } else {
        // No number: one of it when the word itself is singular and the food
        // has a plural ("ביצה" beside "ביצים"), otherwise a normal portion.
        count = perPortion > 1 && saidOne(tokens, food.match) ? 1 : perPortion;
        grams = Math.round(count * unitG);
        label = name;
      }
    }
    const n = gramsNutrition(food, grams);
    if (n.kcal <= 0) continue;
    items.push({ food, count, label, kcal: n.kcal, protein: n.protein });
  }
  if (items.length === 0) return null;

  return {
    items,
    kcal: items.reduce((n, i) => n + i.kcal, 0),
    protein: items.reduce((n, i) => n + i.protein, 0),
  };
}

/** "200 גרם חזה עוף", "150g rice" → the grams written before the food. */
function gramsBefore(text: string, terms: string[]): number | null {
  for (const term of terms) {
    const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:גרם|גר'|גר|ג'|ג׳|grams|gram|gr|g)\\s+(?:של\\s+)?(?:ה)?${t}`);
    const m = re.exec(text);
    if (m) {
      const g = Number(m[1]!.replace(",", "."));
      if (Number.isFinite(g) && g > 0) return Math.min(MAX_GRAMS, Math.round(g));
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
