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
import { foodNutrition, readPantry, type Food } from "@/kitchen";

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

/** The quantity written just before a food's name, or 1 when none is. */
function countBefore(tokens: string[], foodTerms: string[]): number {
  const lowerTerms = foodTerms.map((s) => s.toLowerCase());
  // find where the food's first word appears
  let at = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (lowerTerms.some((term) => term.split(/\s+/)[0] === tokens[i])) {
      at = i;
      break;
    }
  }
  if (at <= 0) return 1;
  const prev = tokens[at - 1]!;
  if (NUMBER_WORDS[prev] !== undefined) return Math.min(MAX_COUNT, NUMBER_WORDS[prev]!);
  const digits = Number(prev.replace(/[^\d.]/g, ""));
  if (Number.isFinite(digits) && digits > 0) return Math.min(MAX_COUNT, digits);
  return 1;
}

/**
 * Reads a "what I ate" sentence into diary items. Returns null when no food in
 * the library is recognised — the coach then answers in words instead of
 * logging a guess.
 */
export function parseEaten(text: string, locale: "he" | "en" = "he"): EatenMeal | null {
  const foods = readPantry(text);
  if (foods.length === 0) return null;

  const tokens = text.toLowerCase().split(/[\s,.;:/()·|\n\t]+/).filter(Boolean);

  const items: EatenItem[] = [];
  for (const food of foods) {
    const count = countBefore(tokens, food.match);
    const per = foodNutrition(food);
    const kcal = Math.round(per.kcal * count);
    const protein = Math.round(per.protein * count);
    if (kcal <= 0) continue;
    const name = locale === "he" ? food.he : food.en;
    items.push({
      food,
      count,
      label: count === 1 ? name : `${count}× ${name}`,
      kcal,
      protein,
    });
  }
  if (items.length === 0) return null;

  return {
    items,
    kcal: items.reduce((n, i) => n + i.kcal, 0),
    protein: items.reduce((n, i) => n + i.protein, 0),
  };
}

/** The single diary line for a logged meal. */
export function eatenLabel(meal: EatenMeal): string {
  return meal.items.map((i) => i.label).slice(0, 4).join(", ");
}
