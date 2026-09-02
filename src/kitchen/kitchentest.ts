/**
 * Tests for the kitchen engine. The point of these is the reading: a real
 * shopping list is messy — commas, plurals, whole words that contain a food's
 * name by accident — and none of that should break the match.
 */
import { dailyTarget, dietOk, goalFit, mealPhotoUrl, readPantry, readPantryFull, suggestMeals, slotForHour, yourPlate } from "./index";
import type { Meal } from "./data";
import { MEALS, FOODS, adhocFood, foodNutrition } from "./data";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}
const ids = (list: { id: string }[]) => list.map((f) => f.id).sort();

// --- reads a plain comma list
{
  const p = readPantry("ביצים, עגבנייה, מלפפון, שמן זית");
  check("comma list is read", ids(p).join() === ["cucumber", "egg", "oliveOil", "tomato"].sort().join(), ids(p).join());
}

// --- reads a free-text sentence, not just a list
{
  const p = readPantry("קניתי היום קצת עוף וגם אורז וברוקולי לארוחת צהריים");
  check("a sentence is read like a list", ids(p).join() === ["broccoli", "chicken", "rice"].sort().join(), ids(p).join());
}

// --- plurals and variants match
{
  const p = readPantry("עגבניות ומלפפונים");
  check("plurals match", ids(p).join() === ["cucumber", "tomato"].sort().join(), ids(p).join());
}

// --- the longest phrase wins: whole-grain bread, not plain bread
{
  const p = readPantry("לחם מלא");
  check("whole-grain bread beats plain bread", ids(p).join() === "wholeBread", ids(p).join());
}

// --- English works too
{
  const p = readPantry("eggs, tomato, cucumber, olive oil");
  check("english list is read", ids(p).join() === ["cucumber", "egg", "oliveOil", "tomato"].sort().join(), ids(p).join());
}

// --- a word that merely contains a food name is not a false match
{
  // "בצלחת" (on a plate) contains "בצל" (onion) but must not match it.
  const p = readPantry("הנחתי את זה בצלחת");
  check("a food name inside another word is not matched", !p.some((f) => f.id === "onion"), ids(p).join());
}

// --- empty / nonsense text yields nothing, not a crash
{
  check("empty text is empty", readPantry("").length === 0);
  check("nonsense text is empty", readPantry("שלום מה נשמע").length === 0);
}

// --- a full pantry produces ready meals ranked by fit
{
  const r = suggestMeals("ביצים, עגבנייה, מלפפון, שמן זית, יוגורט יווני, בננה, שיבולת שועל, אגוזים");
  check("ready meals are found", r.ready.length >= 2, `ready=${r.ready.length}`);
  check("every ready meal really has all its ingredients", r.ready.every((m) => m.missing.length === 0));
  check(
    "ready meals are sorted by goal fit",
    r.ready.every((m, i) => i === 0 || r.ready[i - 1].fit >= m.fit),
  );
}

// --- an almost-meal surfaces with its short shopping gap
{
  const r = suggestMeals("חזה עוף, אורז"); // broccoli missing for chicken-rice-broccoli
  const chickenRice = [...r.ready, ...r.almost].find((m) => m.meal.id === "chicken-rice-broccoli");
  check("a one-ingredient-away meal appears", Boolean(chickenRice));
  check("its single gap is named", chickenRice?.missing.some((f) => f.id === "broccoli") ?? false);
  check("almost meals are never marked ready", r.almost.every((m) => !m.ready));
}

// --- almost meals are ordered by how few items are missing
{
  const r = suggestMeals("חזה עוף, אורז, טונה");
  check(
    "closest meals come first",
    r.almost.every((m, i) => i === 0 || r.almost[i - 1].missing.length <= m.missing.length),
  );
}

// --- goal fit: a light high-protein meal beats a heavy low-protein one
{
  const tuna = MEALS.find((m) => m.id === "tuna-salad")!;
  const pasta = MEALS.find((m) => m.id === "pasta-veg")!;
  check("high-protein light meal scores above a heavy low-protein one", goalFit(tuna) > goalFit(pasta));
}

// --- nutrition figures are present and sane on every meal
{
  const sane = MEALS.every((m) => m.kcal > 100 && m.kcal < 900 && m.protein >= 0 && m.protein < 60);
  check("every meal carries sane nutrition", sane);
  check("every meal uses at least two ingredients", MEALS.every((m) => m.uses.length >= 2));
}


// --- goal changes what leads: bulk should not top the list with a snack
{
  const list = "חזה עוף, אורז, ברוקולי, יוגורט יווני, פירות יער, בננה, אגוזים, שיבולת שועל";
  const cut = suggestMeals(list, { goal: "cut" }).ready[0];
  const bulk = suggestMeals(list, { goal: "bulk" }).ready[0];
  check("cut and bulk can lead with different meals", Boolean(cut) && Boolean(bulk));
  check("bulk does not lead with a light snack", bulk ? bulk.meal.kcal >= 300 : false, bulk?.meal.id);
}

// --- goal fit ordering differs by goal for the same meal set
{
  const heavy = MEALS.find((m) => m.id === "beef-rice")!;
  const snack = MEALS.find((m) => m.id === "yogurt-berries")!;
  check("cut favours the lean snack over the heavy plate", goalFit(snack, "cut") > goalFit(heavy, "cut"));
  check("bulk favours the heavy plate over the lean snack", goalFit(heavy, "bulk") > goalFit(snack, "bulk"));
}

// --- time of day lifts the matching slot to the top when goal ties allow
{
  const list = "ביצים, עגבנייה, מלפפון, שמן זית, חזה עוף, אורז, ברוקולי";
  const morning = suggestMeals(list, { goal: "maintain", slot: "breakfast" }).ready;
  check("a breakfast leads in the morning", morning[0]?.meal.slot === "breakfast", morning[0]?.meal.id);
}

// --- slotForHour maps the clock sensibly
{
  check("08:00 is breakfast", slotForHour(8) === "breakfast");
  check("13:00 is lunch", slotForHour(13) === "lunch");
  check("19:00 is dinner", slotForHour(19) === "dinner");
  check("22:00 is snack", slotForHour(22) === "snack");
}

// --- every food carries a colour and a drawable shape (the images need both)
{
  const shapes = new Set(["round","long","leaf","grain","slice","blob","drop"]);
  check("every food has a hex colour", FOODS.every((f) => /^#[0-9A-Fa-f]{6}$/.test(f.color)));
  check("every food has a known shape", FOODS.every((f) => shapes.has(f.shape)));
}


// --- every meal builds a valid, distinct photo URL from its ingredients
{
  const urls = MEALS.map((m) => mealPhotoUrl(m, { width: 320, height: 150 }));
  check("every photo url is https and from the free service",
    urls.every((u) => u.startsWith("https://image.pollinations.ai/prompt/")));
  check("every photo url carries size and a seed",
    urls.every((u) => /width=\d+/.test(u) && /height=\d+/.test(u) && /seed=\d+/.test(u)));
  check("photo urls are per-meal distinct", new Set(urls).size === urls.length);
  check("a meal's url mentions its own ingredients",
    mealPhotoUrl(MEALS.find((m) => m.id === "tuna-salad")!, { width: 10, height: 10 })
      .includes(encodeURIComponent("tuna")));
  check("the url is properly encoded (no raw spaces)", urls.every((u) => !u.includes(" ")));
}


// --- an unknown food is captured as an extra, not dropped
{
  const full = readPantryFull("שניצל, אורז, קטע מוזר12");
  check("known foods still recognised alongside unknowns", full.known.some((f) => f.id === "rice"));
  check("an unknown food (שניצל) becomes an extra", full.extras.includes("שניצל"));
}

// --- stopwords never become ingredients
{
  const full = readPantryFull("קניתי היום עם קצת אורז");
  check("stopwords are not extras", !full.extras.includes("קניתי") && !full.extras.includes("עם"));
}

// --- your-plate builds a meal from any items, with a nutrition estimate
{
  const items = [FOODS.find((f) => f.id === "chicken")!, adhocFood("שניצל")];
  const plate = yourPlate(items, "lunch");
  check("your-plate uses every item", plate.uses.length === 2);
  check("your-plate estimates calories", plate.kcal > 0 && plate.protein > 0);
  check("your-plate leaves no unfilled token in its text", !/\{[a-z]+\}/.test(plate.he.how));
}

// --- category nutrition gives any food a sane estimate
{
  const n = foodNutrition(adhocFood("משהו"));
  check("an unknown food gets a sane calorie estimate", n.kcal > 0 && n.kcal < 900);
}

// --- daily targets shift with the goal
{
  const cut = dailyTarget(80, "cut");
  const bulk = dailyTarget(80, "bulk");
  const maintain = dailyTarget(80, "maintain");
  check("a cut targets fewer calories than maintenance", cut.kcal < maintain.kcal);
  check("a bulk targets more calories than maintenance", bulk.kcal > maintain.kcal);
  check("a cut sets higher protein per kilo than a bulk", cut.protein > bulk.protein);
  check("no weight still yields a usable target", dailyTarget(undefined, "maintain").kcal >= 1200);
  check("targets never drop below a floor", dailyTarget(30, "cut").kcal >= 1200);
}

// --- dietary filters (kosher / vegetarian)
{
  const mk = (uses: string[]): Meal => ({
    id: "t", he: { title: "", how: "" }, en: { title: "", how: "" },
    uses, slot: "lunch", notes: [], kcal: 0, protein: 0,
  });
  check("everything passes the 'all' filter", dietOk(mk(["pork", "milk"]), "all"));
  check("pork is not kosher", !dietOk(mk(["pork", "rice"]), "kosher"));
  check("meat + dairy is not kosher", !dietOk(mk(["chicken", "yellowCheese"]), "kosher"));
  check("chicken + rice is kosher", dietOk(mk(["chicken", "rice"]), "kosher"));
  check("fish + cheese stays kosher (fish is pareve)", dietOk(mk(["salmon", "feta"]), "kosher"));
  check("chicken is not vegetarian", !dietOk(mk(["chicken", "rice"]), "vegetarian"));
  check("eggs + veg is vegetarian", dietOk(mk(["egg", "tomato", "cheese"]), "vegetarian"));
  check("shrimp is neither kosher nor vegetarian",
    !dietOk(mk(["shrimp"]), "kosher") && !dietOk(mk(["shrimp"]), "vegetarian"));
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
