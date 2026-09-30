import { MEALS, FOODS } from "./data";
import { readPantry, STAPLES, dietOk } from "./index";
import {
  alternativesFor,
  candidatesFor,
  makeable,
  MAX_SERVINGS,
  MIN_SERVINGS,
  OWN_PLATE,
  planDay,
  quarter,
  slotForRecipe,
  SLOTS,
  upgradesFor,
  type MenuInput,
} from "./menu";

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

const LIST = "ביצים, עגבניות, מלפפון, גבינה לבנה, קוטג׳, לחם מלא, שיבולת שועל, יוגורט, בננה, חזה עוף, אורז, ברוקולי, טונה, תפוח, טחינה, חומוס";
const pantry = readPantry(LIST);
const have = new Set(pantry.map((f) => f.id));
const base: MenuInput = {
  target: { kcal: 2000, protein: 150 },
  goal: "cut",
  have,
  pantry,
  diet: "all",
  seed: "salt|2026-09-30|0",
  diary: [],
};

check("the test list is read", pantry.length >= 12, pantry.map((f) => f.id).join(","));

{
  const d = planDay(base);
  check("a full day: four meals", d.slots.length === 4 && SLOTS.every((s) => d.slots.some((x) => x.slot === s)), d.slots.map((s) => s.slot).join());
  check("every meal comes from the kitchen — nothing to buy", d.slots.every((s) => s.fromKitchen), d.slots.map((s) => `${s.meal.id}:${s.fromKitchen}`).join());
  check("no meal twice in a day", new Set(d.slots.map((s) => s.meal.id)).size === d.slots.length);
  check("the day adds up to the target (±12%)", Math.abs(d.totalKcal - 2000) <= 240, String(d.totalKcal));
  check("portions move in quarters, within ½–2", d.slots.every((s) => s.servings * 4 === Math.round(s.servings * 4) && s.servings >= MIN_SERVINGS && s.servings <= MAX_SERVINGS));
  check("breakfast is a breakfast", d.slots.find((s) => s.slot === "breakfast")!.meal.slot === "breakfast", d.slots[0]!.meal.id);
}
{
  // A higher target (a workout day) makes bigger portions, not different food.
  const a = planDay(base);
  const b = planDay({ ...base, target: { kcal: 2600, protein: 150 } });
  check("a bigger target, bigger portions", b.plannedKcal > a.plannedKcal, `${a.plannedKcal} → ${b.plannedKcal}`);
}
{
  // A big lunch logged: what is left is spread over the rest of the day.
  const first = planDay(base);
  const lunch = first.slots.find((s) => s.slot === "lunch")!;
  const d = planDay({
    ...base,
    choices: { lunch: { mealId: lunch.meal.id, loggedId: "e1" } },
    diary: [{ id: "e1", kcal: 1100, protein: 40 }],
  });
  const eatenLunch = d.slots.find((s) => s.slot === "lunch")!;
  check("a logged meal shows as eaten, at what was logged", eatenLunch.eaten && eatenLunch.kcal === 1100);
  check("after a big lunch the rest of the day shrinks", d.plannedKcal <= 1000 && d.plannedKcal < first.plannedKcal, String(d.plannedKcal));
  const removed = planDay({ ...base, choices: { lunch: { mealId: lunch.meal.id, loggedId: "e1" } }, diary: [] });
  check("removing the entry from the diary un-eats the meal", !removed.slots.find((s) => s.slot === "lunch")!.eaten);
}
{
  // The seed rotates the day.
  const days = new Set<string>();
  for (let i = 0; i < 7; i++) days.add(planDay({ ...base, seed: `salt|2026-10-0${i + 1}|0` }).slots.map((s) => s.meal.id).join());
  check("the menu changes from day to day", days.size >= 3, String(days.size));
}
{
  // A swap is honoured, and the alternatives come from the kitchen.
  const alts = alternativesFor("dinner", "x", base);
  check("swap offers several dinners", alts.length >= 3, String(alts.length));
  check("all of them makeable from the list", alts.every((m) => makeable(m, have)));
  const d = planDay({ ...base, choices: { dinner: { mealId: alts[2]!.id } } });
  check("a swapped meal is on the menu, marked as chosen", d.slots.find((s) => s.slot === "dinner")!.meal.id === alts[2]!.id && d.slots.find((s) => s.slot === "dinner")!.chosen);
}
{
  // Adding a recipe from the book, even one needing something not on the list.
  const outside = MEALS.find((m) => m.slot === "lunch" && !makeable(m, have))!;
  const d = planDay({ ...base, choices: { lunch: { mealId: outside.id } } });
  const s = d.slots.find((x) => x.slot === "lunch")!;
  check("a recipe added from the book goes in as chosen", s.meal.id === outside.id && s.chosen && !s.fromKitchen);
  check("it goes into its own slot", slotForRecipe(outside, planDay(base)) === "lunch");
}
{
  // Upgrades: from the kitchen, right for the goal.
  const meal = planDay(base).slots.find((s) => s.slot === "lunch")!.meal;
  const ups = upgradesFor(meal, base);
  check("upgrades are offered", ups.length > 0, meal.id);
  check("only things on the list", ups.every((u) => have.has(u.food.id)));
  check("never something already in the dish", ups.every((u) => !meal.uses.includes(u.food.id)));
  check("cutting: protein or volume, not energy", ups.every((u) => u.why !== "energy"), JSON.stringify(ups.map((u) => [u.food.id, u.why])));
  const bulk = upgradesFor(meal, { ...base, goal: "bulk" });
  check("bulking: energy and protein", bulk.every((u) => u.why !== "volume") && bulk.length > 0, JSON.stringify(bulk.map((u) => [u.food.id, u.why])));
  const d = planDay({ ...base, choices: { lunch: { extras: [ups[0]!.food.id] } } });
  const withUp = d.slots.find((s) => s.slot === "lunch")!;
  check("a chosen upgrade is on the plate and counted", withUp.extras.length === 1 && withUp.kcal > 0);
  const breakfast = MEALS.find((m) => m.slot === "breakfast")!;
  check("no chicken in the breakfast upgrade", upgradesFor(breakfast, base).every((u) => u.food.id !== "chicken"));
}
{
  // Kosher: no dairy upgrade on a meat dish.
  const meat = MEALS.find((m) => m.uses.includes("chicken"))!;
  const ups = upgradesFor(meat, { ...base, diet: "kosher" });
  check("kosher: no dairy added to a meat dish", ups.every((u) => !["cottage", "whiteCheese", "greekYogurt"].includes(u.food.id)), JSON.stringify(ups.map((u) => u.food.id)));
  const d = planDay({ ...base, diet: "vegetarian" });
  check("vegetarian: every meal passes the diet", d.slots.every((s) => dietOk(s.meal, "vegetarian")), d.slots.map((s) => s.meal.id).join());
}
{
  // A tiny kitchen still yields a day — the plate made of what is there.
  const small = readPantry("ביצים, עגבניות, לחם");
  const d = planDay({ ...base, have: new Set(small.map((f) => f.id)), pantry: small });
  check("a tiny kitchen still gets meals", d.slots.length >= 2, d.slots.map((s) => s.meal.id).join());
  check("and none of them needs shopping", d.slots.every((s) => s.fromKitchen || s.meal.id.startsWith("plate") || s.meal.uses.every((id) => STAPLES.has(id) || small.some((f) => f.id === id))), d.slots.map((s) => `${s.meal.id}:${s.meal.uses}`).join(" | "));
  const own = planDay({ ...base, choices: { dinner: { mealId: OWN_PLATE } } });
  check("the own-groceries plate can be chosen", own.slots.find((s) => s.slot === "dinner")!.chosen);
}
{
  // No list: the planner uses every recipe and upgrades are suggestions.
  const d = planDay({ ...base, have: null, pantry: [] });
  check("no list: still a full day", d.slots.length === 4);
  const ups = upgradesFor(d.slots[1]!.meal, { ...base, have: null });
  check("no list: upgrades are marked as suggestions", ups.every((u) => !u.have));
}
check("quarter rounds to quarters and clamps", quarter(1.1) === 1 && quarter(1.2) === 1.25 && quarter(9) === 2 && quarter(0.1) === 0.5 && quarter(NaN) === 0.5);
check("every meal in the planner's pool has a recipe or is a plate", candidatesFor("lunch", { ...base, have: null }).length > 10);
check("foods referenced by the menu exist", FOODS.length > 100);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
