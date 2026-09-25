import {
  addFood, addGrams, clampGrams, cookedFirst, fromAnalysis, itemNutrition, label, matchFood, MAX_GRAMS, MAX_ITEMS,
  aiFood, macros, portions, removeFood, setGrams, step, stepFor, total, type CalcItem,
} from "./calc";
import { FOODS, adhocFood, portion } from "./data";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const food = (id: string) => FOODS.find((f) => f.id === id)!;
const egg = food("egg");
const rice = food("rice") ?? FOODS.find((f) => f.tags[0] === "carb")!;
const oil = FOODS.find((f) => f.tags[0] === "fat")!;

// ---- the arithmetic, which ends up in someone's calorie diary
{
  const one: CalcItem = { food: egg, grams: 100 };
  const n = itemNutrition(one);
  // Eggs are 143 kcal and 12.6 g protein per 100 g (USDA) — their own row in
  // the nutrition table, no longer the protein category's 165/22.
  check("100 g of a protein food is its per-100 figure", n.kcal === 143 && n.protein === 13,
    JSON.stringify(n));
  check("half the weight is half the calories",
    itemNutrition({ food: egg, grams: 50 }).kcal === 72,
    String(itemNutrition({ food: egg, grams: 50 }).kcal));
  check("zero grams is zero calories", itemNutrition({ food: egg, grams: 0 }).kcal === 0);

  // The total must equal the rows a person is reading, near enough that it
  // never looks wrong — it is rounded once at the end, so allow one unit.
  const plate: CalcItem[] = [
    { food: egg, grams: 120 }, { food: rice, grams: 180 }, { food: oil, grams: 12 },
  ];
  const t = total(plate);
  const summed = plate.reduce((a, i) => a + itemNutrition(i).kcal, 0);
  check("the total matches the sum of its rows", Math.abs(t.kcal - summed) <= 1,
    `${t.kcal} vs ${summed}`);
  check("an empty plate is zero, not NaN", total([]).kcal === 0 && total([]).protein === 0);
  check("every total is a whole number",
    Number.isInteger(t.kcal) && Number.isInteger(t.protein), JSON.stringify(t));
}

// ---- adversarial weights: nothing may poison a day's total
{
  for (const bad of [NaN, Infinity, -Infinity, -50, -0]) {
    const n = itemNutrition({ food: egg, grams: bad as number });
    check(`${bad} grams yields a real number`, Number.isFinite(n.kcal) && n.kcal >= 0, String(n.kcal));
  }
  check("a typo'd weight is capped", clampGrams(999999) === MAX_GRAMS, String(clampGrams(999999)));
  check("and the cap holds through the arithmetic",
    itemNutrition({ food: oil, grams: 999999 }).kcal === Math.round((884 * MAX_GRAMS) / 100));
  check("a fractional weight is rounded, not carried", clampGrams(10.6) === 11);
  check("NaN grams is zero, never NaN", clampGrams(NaN) === 0);
  const poisoned = total([{ food: egg, grams: NaN as number }, { food: rice, grams: 100 }]);
  check("one bad row cannot poison the plate's total", Number.isFinite(poisoned.kcal) && poisoned.kcal > 0,
    String(poisoned.kcal));
}

// ---- adding and stepping
{
  let items: CalcItem[] = [];
  items = addFood(items, egg);
  check("adding a food starts it at one portion", items[0]?.grams === stepFor(egg),
    String(items[0]?.grams));
  items = addFood(items, egg);
  check("adding it again is two portions, not two rows",
    items.length === 1 && items[0]!.grams === stepFor(egg) * 2, JSON.stringify(items.map(i=>i.grams)));
  items = step(items, egg.id, -1);
  check("stepping down removes one portion", items[0]!.grams === stepFor(egg));
  items = step(items, egg.id, -1);
  check("stepping to nothing removes the row", items.length === 0, JSON.stringify(items));
  check("stepping a food that is not there changes nothing",
    step([], "nope", 1).length === 0);
  check("removing a food that is not there changes nothing",
    removeFood([{ food: egg, grams: 50 }], "nope").length === 1);

  // The plate cannot grow without bound.
  let many: CalcItem[] = [];
  for (const f of FOODS.slice(0, MAX_ITEMS + 5)) many = addFood(many, f);
  check("the plate stops at its cap", many.length === MAX_ITEMS, String(many.length));
  // ...but adding more of something already on it still works at the cap.
  const before = many[0]!.grams;
  many = addFood(many, many[0]!.food);
  check("at the cap you can still add more of what is there",
    many.length === MAX_ITEMS && many[0]!.grams > before);
}

// ---- typed weights
{
  const items = setGrams([{ food: egg, grams: 50 }], egg.id, 250);
  check("a typed weight is taken", items[0]!.grams === 250);
  check("a typed weight is still capped",
    setGrams(items, egg.id, 99999)[0]!.grams === MAX_GRAMS);
  check("a typed weight of nonsense becomes zero rather than NaN",
    setGrams(items, egg.id, NaN)[0]!.grams === 0);
}

// ---- portions label
{
  check("one standard portion reads as 1", portions({ food: egg, grams: stepFor(egg) }) === 1);
  check("one and a half reads as 1.5",
    portions({ food: egg, grams: Math.round(stepFor(egg) * 1.5) }) === 1.5,
    String(portions({ food: egg, grams: Math.round(stepFor(egg) * 1.5) })));
  check("the portion step is the food's own portion", stepFor(egg) === portion(egg.id).g);
  check("a food with no portion entry still steps by something sane",
    stepFor(adhocFood("משהו")) >= 1);
}

// ---- the diary label
{
  check("one food names itself", label([{ food: egg, grams: 50 }], "he") === egg.he);
  check("three foods are all named",
    label([{food:egg,grams:1},{food:rice,grams:1},{food:oil,grams:1}], "he").split(",").length === 3);
  const four = label([{food:egg,grams:1},{food:rice,grams:1},{food:oil,grams:1},{food:FOODS[10]!,grams:1}], "he");
  check("four foods are summarised rather than listed", four.includes("ועוד"), four);
  check("an empty plate still has a name", label([], "he").length > 0);
  check("and in English too", label([], "en").length > 0);
}

// ---- reading a photograph's result back into editable rows
{
  const read = fromAnalysis([{ label: "ביצים", grams: 120 }, { label: "אורז", grams: 200 }], "he");
  check("a recognised name becomes a real food",
    read.length === 2 && !read[0]!.food.id.startsWith("x:"), JSON.stringify(read.map(r=>r.food.id)));
  check("and keeps the weight the model read", read[0]!.grams === 120);

  const unknown = fromAnalysis([{ label: "שקשוקה של סבתא" }], "he");
  check("a name we do not know is still a row, not a silent drop", unknown.length === 1);
  check("and it gets a sane default weight", unknown[0]!.grams >= 1);

  // The model's own calorie numbers are never used — we recompute. This is
  // what stops a hallucinated 5,000-calorie salad reaching the diary.
  const wild = fromAnalysis([{ label: "חסה", grams: 999999 }], "he");
  check("a model's absurd weight is capped like any other",
    wild[0]!.grams === MAX_GRAMS, String(wild[0]!.grams));
  check("an empty name is dropped", fromAnalysis([{ label: "  " }], "he").length === 0);
  check("a duplicate name is merged into one row",
    fromAnalysis([{label:"ביצים",grams:50},{label:"ביצים",grams:50}], "he").length === 1);
  check("and the merged row carries both weights",
    fromAnalysis([{label:"ביצים",grams:50},{label:"ביצים",grams:50}], "he")[0]!.grams === 100);
  check("a long list is cut to the cap",
    fromAnalysis(Array.from({length:50},()=>({label:"ביצים"})), "he").length <= MAX_ITEMS);
  check("nothing read is nothing added", fromAnalysis([], "he").length === 0);
}

// ---- matching names to foods
{
  check("an exact Hebrew name matches", matchFood("ביצים", "he")?.id === "egg");
  check("an exact English name matches", matchFood("eggs", "en")?.id === "egg");
  check("a search term matches", matchFood("egg", "en")?.id === "egg");
  check("case does not matter", matchFood("EGGS", "en")?.id === "egg");
  check("a name inside a phrase still matches",
    matchFood("grilled chicken breast", "en")?.id === "chicken",
    String(matchFood("grilled chicken breast", "en")?.id));
  check("nonsense matches nothing", matchFood("קשקושבלבל", "he") === null);
  check("an empty name matches nothing", matchFood("", "he") === null);
  check("whitespace matches nothing", matchFood("   ", "he") === null);
}

// ---- the whole library holds up
{
  const bad = FOODS.filter((f) => {
    const n = itemNutrition({ food: f, grams: stepFor(f) });
    return !Number.isFinite(n.kcal) || n.kcal < 0 || n.kcal > 3000 || !Number.isFinite(n.protein);
  });
  check("every food in the library gives a sane portion figure", bad.length === 0,
    bad.map((f) => f.id).join(", "));
  check("every food has a step of at least one gram", FOODS.every((f) => stepFor(f) >= 1));
  check("no two foods share an id", new Set(FOODS.map((f) => f.id)).size === FOODS.length);
}

// Carbs and fat: only from foods whose split is known.
{
  check("an empty plate has no macro split", macros([]) === null);
  const m = macros([{ food: egg, grams: 100 }]);
  check("100 g of egg has its real fat (~9.5 g)", m !== null && m.fat >= 9 && m.fat <= 11 && !m.partial, JSON.stringify(m));
  const ai = aiFood("mystery stew", 300, 450, 20);
  check("a photo-only food has no split", macros([{ food: ai, grams: 300 }]) === null);
  const mixed = macros([{ food: egg, grams: 100 }, { food: ai, grams: 300 }]);
  check("a plate with a photo-only food is marked partial", mixed !== null && mixed.partial, JSON.stringify(mixed));
  check("…and its fat is the egg's alone", mixed !== null && m !== null && mixed.fat === m.fat);
  const bad = macros([{ food: egg, grams: NaN as number }]);
  check("a NaN weight is zero, not NaN", bad !== null && bad.carbs === 0 && bad.fat === 0);
}

// A typed meal's rows merge into the plate; cooked rice leads the search.
{
  const rice = FOODS.find((f) => f.id === "rice")!;
  const cooked = FOODS.find((f) => f.id === "cookedRice")!;
  let plate: CalcItem[] = addGrams([], cooked, 150);
  plate = addGrams(plate, cooked, 50);
  check("adding a read food twice merges its grams", plate.length === 1 && plate[0]!.grams === 200);
  check("a zero reading adds nothing", addGrams([], cooked, 0).length === 0);
  check("cooked rice is offered before dry rice", cookedFirst([rice])[0]!.id === "cookedRice");
  check("cookedFirst keeps every other food", cookedFirst([rice, cooked]).filter((f) => f.id === "cookedRice").length === 1);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
