/**
 * The classifier speaks in its own English dish names ("Shakshouka",
 * "Chicken schnitzel", "Hummus"); the app counts calories for its own foods.
 * This finds the library food each label means, so a recognised photo lands
 * in the calculator with real nutrition — or returns null, and the screen
 * offers the label to search instead of inventing a number.
 */
import { FOODS, type Food } from "@/kitchen";

/** Labels whose library food is not spelled the same way. */
const ALIASES: Record<string, string> = {
  shakshouka: "shakshuka",
  shakshuka: "shakshuka",
  "hummus": "hummusSpread",
  "falafel": "falafel",
  "schnitzel": "schnitzel",
  "wiener schnitzel": "schnitzel",
  "chicken schnitzel": "schnitzel",
  "pita": "pita",
  "pita bread": "pita",
  "omelette": "omelette",
  "omelet": "omelette",
  "fried egg": "egg",
  "boiled egg": "egg",
  "scrambled eggs": "egg",
  "french fries": "fries",
  "chips": "fries",
  "hamburger": "burger",
  "cheeseburger": "burger",
  "pizza": "pizza",
  "margherita pizza": "pizza",
  "sushi": "sushi",
  "spaghetti": "cookedPasta",
  "pasta": "cookedPasta",
  "penne": "cookedPasta",
  "white rice": "cookedRice",
  "rice": "cookedRice",
  "steamed rice": "cookedRice",
  "salad": "israeliSalad",
  "greek salad": "israeliSalad",
  "israeli salad": "israeliSalad",
  "yogurt": "greekYogurt",
  "cottage cheese": "cottage",
  "grilled chicken": "chicken",
  "roast chicken": "chicken",
  "chicken breast": "chicken",
  "steak": "beef",
  "beef steak": "beef",
  "salmon": "salmon",
  "tuna": "tuna",
  "avocado toast": "avocado",
  "oatmeal": "oats",
  "porridge": "oats",
  "pancake": "pancakes",
  "pancakes": "pancakes",
  "bagel": "bagel",
  "bread": "bread",
  "toast": "bread",
  "banana": "banana",
  "apple": "apple",
  "watermelon": "watermelon",
};

const byId = new Map(FOODS.map((f) => [f.id, f]));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Every English name a library food answers to, longest first. */
const TERMS: { term: string; food: Food }[] = FOODS.flatMap((f) =>
  [f.en, ...f.match]
    .filter((t) => /^[a-z0-9 ']+$/i.test(t))
    .map((t) => ({ term: norm(t), food: f })),
).sort((a, b) => b.term.length - a.term.length);

export function labelToFood(label: string): Food | null {
  const l = norm(label);
  if (!l) return null;
  const alias = ALIASES[l];
  if (alias && byId.has(alias)) return byId.get(alias)!;
  const exact = TERMS.find((t) => t.term === l);
  if (exact) return exact.food;
  // Otherwise the dish's head noun — the end of an English dish name: "grilled
  // salmon" is salmon, "key lime pie" is a pie (not lime), "West Slavic
  // cereal soups" is a soup (not cornflakes). Longest names first, so "sweet
  // potato" beats "potato".
  const tail = TERMS.find((t) => t.term.length >= 4 && (l === t.term || l.endsWith(` ${t.term}`)));
  if (tail) return tail.food;
  for (const [k, id] of Object.entries(ALIASES)) {
    if (l.endsWith(` ${k}`) && byId.has(id)) return byId.get(id)!;
  }
  return null;
}
