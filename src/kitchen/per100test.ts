import { FOODS, per100For, foodNutrition, adhocFood } from "./data";
import { NUTRITION, atwater } from "./nutrition";
import { aiFood, fromAnalysis, groundAnalysis, itemNutrition, matchFood, total } from "./calc";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const food = (id: string) => FOODS.find((f) => f.id === id)!;

// ---------------------------------------------------------------- coverage
const missing = FOODS.filter((f) => !NUTRITION[f.id]).map((f) => f.id);
check("every library food has its own nutrition row", missing.length === 0, missing.join(","));
const ids = new Set(FOODS.map((f) => f.id));
const orphans = Object.keys(NUTRITION).filter((id) => !ids.has(id));
check("no nutrition row for a food that does not exist", orphans.length === 0, orphans.join(","));

// ------------------------------------------------------- every row is sane
for (const [id, n] of Object.entries(NUTRITION)) {
  const nums = [n.kcal, n.protein, n.carbs, n.fat];
  const finite = nums.every((x) => Number.isFinite(x) && x >= 0);
  const bounded = n.kcal <= 900 && n.protein + n.carbs + n.fat <= 100.5;
  // The Atwater cross-check: calories must agree with 4P + 4C + 9F. Fibre and
  // rounding move it a little; a typo'd digit moves it a lot.
  const diff = Math.abs(n.kcal - atwater(n));
  const tolerance = Math.max(15, 0.2 * n.kcal);
  if (!finite || !bounded || diff > tolerance) {
    check(`${id} is internally consistent`, false, JSON.stringify({ ...n, atwater: atwater(n) }));
  }
}
check("every row passes range and Atwater checks", results.every(([, ok]) => ok));

// ---------------------------------- the figures the category table got wrong
check("avocado is ~160 kcal/100g, not 600", per100For(food("avocado")).kcal === 160);
check("salmon and chicken no longer share one number",
  per100For(food("salmon")).kcal !== per100For(food("chicken")).kcal);
check("dry rice is priced dry (~365), not cooked", per100For(food("rice")).kcal > 300);
check("olive oil is the densest thing in the kitchen",
  FOODS.every((f) => per100For(f).kcal <= per100For(food("oliveOil")).kcal));
check("cucumber is lighter than an apple, lighter than bread",
  per100For(food("cucumber")).kcal < per100For(food("apple")).kcal &&
  per100For(food("apple")).kcal < per100For(food("bread")).kcal);
check("chicken carries more protein per 100g than dry rice",
  per100For(food("chicken")).protein > per100For(food("rice")).protein);
check("library foods read from the table", per100For(food("egg")).source === "table");

// --------------------------------------------------------- the arithmetic
check("150 g of chicken is 248 kcal (165 × 1.5)",
  itemNutrition({ food: food("chicken"), grams: 150 }).kcal === 248);
check("100 g of avocado is 160 kcal",
  itemNutrition({ food: food("avocado"), grams: 100 }).kcal === 160);
check("a plate totals its rows",
  total([{ food: food("chicken"), grams: 100 }, { food: food("rice"), grams: 75 }]).kcal === 165 + 274);
check("a portion of eggs uses the egg row",
  foodNutrition(food("egg")).kcal === 143);

// -------------------------------------------------------------- fallbacks
check("an unknown word still gets a (category) number",
  per100For(adhocFood("משהו לא מוכר")).source === "category");
{
  const f = aiFood("שקשוקה", 250, 300, 18);
  check("an AI-read dish carries its own per-100 figure", per100For(f).source === "food" && f.src === "ai");
  check("…priced from the model's reading (300 kcal / 250 g = 120/100g)", per100For(f).kcal === 120);
  check("…and follows the weight when it is changed",
    itemNutrition({ food: f, grams: 500 }).kcal === 600);
  const silly = aiFood("x", 10, 5000, 0);
  check("a hallucinated density is capped at pure fat", per100For(silly).kcal === 900);
}

// ------------------------------------------------ photo readings, grounded
{
  // The model names a library food and guesses its calories badly: the
  // library's figure wins.
  const rows = fromAnalysis([{ label: "חזה עוף", grams: 200, kcal: 900, protein: 10 }], "he");
  check("a library food from a photo is priced by the table, not the model",
    rows.length === 1 && rows[0]!.food.id === "chicken" && itemNutrition(rows[0]!).kcal === 330);

  // A dish the library does not have keeps the model's estimate.
  const dish = fromAnalysis([{ label: "שקשוקה", grams: 300, kcal: 330, protein: 20 }], "he");
  check("an unknown dish keeps the model's calories", itemNutrition(dish[0]!).kcal === 330);

  // A partial-word match must not reprice a whole composite item.
  const salad = fromAnalysis([{ label: "סלט עם אבוקדו", grams: 250, kcal: 280, protein: 5 }], "he");
  check("'salad with avocado' is not priced as 250 g of avocado",
    salad[0]!.food.id !== "avocado" && itemNutrition(salad[0]!).kcal === 280);

  check("exact matching refuses a partial word",
    matchFood("סלט עם אבוקדו", "he", { exactOnly: true }) === null &&
    matchFood("סלט עם אבוקדו", "he")?.id === "avocado");

  const g = groundAnalysis(
    {
      items: [
        { label: "אורז", grams: 75, kcal: 999, protein: 1 },
        { label: "שקשוקה", grams: 300, kcal: 330, protein: 20 },
      ],
      kcal: 1329,
      protein: 21,
      confidence: 0.8,
    },
    "he",
  );
  check("grounded total = table rice + model shakshuka", g.kcal === 274 + 330, String(g.kcal));
  check("grounded total matches its own rows", g.kcal === g.items.reduce((n, i) => n + i.kcal, 0));
  check("confidence is carried through", g.confidence === 0.8);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
