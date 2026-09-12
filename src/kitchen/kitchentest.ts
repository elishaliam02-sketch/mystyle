/**
 * Tests for the kitchen engine. The point of these is the reading: a real
 * shopping list is messy — commas, plurals, whole words that contain a food's
 * name by accident — and none of that should break the match.
 */
import { dailyTarget, dietOk, dietHidden, foodDietOk, plateForGoal, searchFoods, shoppingList, goalFit, commonsSearchUrl, creditFor, pickPhoto, photoQueries, readPantry, readPantryFull, suggestMeals, slotForHour, starterMeals, yourPlate } from "./index";
import type { CommonsPage } from "./index";
import type { Meal } from "./data";
import { MEALS, FOODS, adhocFood, foodNutrition, portion } from "./data";

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


// --- every meal can be searched for as a real photograph
{
  check("every meal carries a photo search phrase",
    MEALS.every((m) => m.photo.trim().length > 0));
  check("photo phrases are English (the search is against Commons)",
    MEALS.every((m) => !/[א-ת]/.test(m.photo)));

  const urls = MEALS.map((m) => commonsSearchUrl(m.photo, 320));
  check("every search url is https and goes to Commons",
    urls.every((u) => u.startsWith("https://commons.wikimedia.org/w/api.php?")));
  check("the search url is properly encoded (no raw spaces)",
    urls.every((u) => !u.includes(" ")));
  check("the search url asks for files only, at the width we want",
    urls.every((u) => u.includes("gsrnamespace=6") && u.includes("iiurlwidth=320")));
  check("the search url is readable cross-origin (web builds need this)",
    urls.every((u) => u.includes("origin=*")));

  // A dish Commons cannot picture must still have something to fall back to.
  const tuna = MEALS.find((m) => m.id === "tuna-salad")!;
  const queries = photoQueries(tuna);
  check("a meal's own phrase is searched first", queries[0] === "tuna salad");
  check("the lead ingredient is the fallback query", queries.includes("tuna food"));
  check("every meal has at least one query", MEALS.every((m) => photoQueries(m).length >= 1));

  // "Your plate" keeps one id while its ingredients change under it, so the
  // queries — which is what the photo cache is keyed on — have to change with
  // them. Keyed by id instead, that card kept the first fridge's photo.
  const f = (id: string) => FOODS.find((x) => x.id === id)!;
  const chicken = yourPlate([f("chicken"), f("rice")], "lunch");
  const fish = yourPlate([f("salmon"), f("broccoli")], "lunch");
  check("your-plate reuses the one id", chicken.id === fish.id);
  check("but a different fridge searches for something different",
    photoQueries(chicken).join("|") !== photoQueries(fish).join("|"));
  check("your-plate searches for its own ingredients",
    photoQueries(chicken)[0] === "chicken breast rice");
}

// --- the picker keeps photographs and rejects everything else
{
  // Every fixture carries a licence that needs no credit, so these checks stay
  // about "is this a photograph"; the licence rules get their own block below.
  const free = { LicenseShortName: { value: "CC0" } };
  const page = (over: Partial<CommonsPage> & { info?: Record<string, unknown> }): CommonsPage => ({
    title: "File:Some dish.jpg",
    index: 1,
    imageinfo: [{ thumburl: "https://upload.wikimedia.org/x.jpg", mime: "image/jpeg", width: 2000, height: 1400, extmetadata: free, ...over.info }],
    ...over,
  });

  check("a plain photograph is taken", pickPhoto([page({})])?.url === "https://upload.wikimedia.org/x.jpg");
  check("nothing at all yields null", pickPhoto([]) === null);
  check("a diagram (png) is rejected", pickPhoto([page({ info: { mime: "image/png" } })]) === null);
  check("an svg is rejected", pickPhoto([page({ info: { mime: "image/svg+xml" } })]) === null);
  check("a too-small image is rejected", pickPhoto([page({ info: { width: 120 } })]) === null);
  check("an entry with no thumbnail is rejected",
    pickPhoto([page({ info: { thumburl: undefined } })]) === null);
  check("a coat of arms is rejected by name",
    pickPhoto([page({ title: "File:Coat of arms of Tomato.jpg" })]) === null);
  check("a logo is rejected by name", pickPhoto([page({ title: "File:Chicken logo.jpg" })]) === null);

  // Search rank leads; a landscape frame breaks a tie because the card crops wide.
  const ranked = pickPhoto([
    page({ index: 2, info: { thumburl: "https://upload.wikimedia.org/second.jpg" } }),
    page({ index: 1, info: { thumburl: "https://upload.wikimedia.org/first.jpg" } }),
  ]);
  check("the best-ranked photo wins", ranked?.url === "https://upload.wikimedia.org/first.jpg");

  const tall = pickPhoto([
    page({ index: 1, info: { thumburl: "https://upload.wikimedia.org/tall.jpg", width: 900, height: 1600 } }),
    page({ index: 1, info: { thumburl: "https://upload.wikimedia.org/wide.jpg", width: 1600, height: 900 } }),
  ]);
  check("a landscape frame breaks a tie", tall?.url === "https://upload.wikimedia.org/wide.jpg");

  // The first usable one is taken even when junk outranks it.
  const skipped = pickPhoto([
    page({ index: 0, title: "File:Salad diagram.jpg" }),
    page({ index: 1, info: { thumburl: "https://upload.wikimedia.org/real.jpg" } }),
  ]);
  check("junk is skipped rather than returned", skipped?.url === "https://upload.wikimedia.org/real.jpg");
}


// --- a media archive is full of food that is not a meal, and art that is not a photo
{
  const shot = (over: { title?: string; categories?: string; date?: string }): CommonsPage => ({
    title: over.title ?? "File:Some dish.jpg",
    index: 1,
    imageinfo: [{
      thumburl: "https://upload.wikimedia.org/x.jpg", mime: "image/jpeg", width: 2000, height: 1400,
      extmetadata: {
        LicenseShortName: { value: "CC0" },
        ...(over.categories ? { Categories: { value: over.categories } } : {}),
        ...(over.date ? { DateTimeOriginal: { value: over.date } } : {}),
      },
    }],
  });

  check("an ordinary photo still passes", pickPhoto([shot({})]) !== null);

  // The first contact sheet put a moth on the oats card and a sack of dried
  // chickpeas on the stew — both real photographs, neither of them dinner.
  check("a moth on an oat stalk is not a meal",
    pickPhoto([shot({ title: "File:Oat plant.jpg", categories: "Insects on plants|Moths" })]) === null);
  check("nor is a field of a crop",
    pickPhoto([shot({ categories: "Barley fields in Germany" })]) === null);

  // And a seventeenth-century still life of fish is a JPEG like any other.
  check("a painting is rejected even when the file name says nothing",
    pickPhoto([shot({ categories: "Still life paintings of fish" })]) === null);
  check("so is anything photographed before food photography existed",
    pickPhoto([shot({ date: "1662" })]) === null);
  check("a modern photo with a date is kept", pickPhoto([shot({ date: "2019-04-11 13:20:02" })]) !== null);
  check("a museum plate is rejected", pickPhoto([shot({ categories: "Rijksmuseum|Museums of Amsterdam" })]) === null);

  // The second contact sheet's own findings: a mackerel tabby over the mackerel
  // toast, a market stall over the kohlrabi, the inside of a fridge over the
  // pear and cheese. Every one of them a photograph, none of them a meal.
  check("a cat is not a mackerel",
    pickPhoto([shot({ title: "File:Mackerel tabby.jpg", categories: "Cats|Kittens" })]) === null);
  check("a market stall is not a snack",
    pickPhoto([shot({ categories: "Vegetable stalls|Farmers' markets in Canada" })]) === null);
  check("the inside of a fridge is not a plate",
    pickPhoto([shot({ categories: "Refrigerators" })]) === null);
}


// --- the query ladder falls toward a cooked plate, not toward a raw ingredient
{
  const stew = MEALS.find((m) => m.id === "chickpea-stew") ?? MEALS[0];
  const q = photoQueries(stew);
  check("the dish's own phrase still leads", q[0] === stew.photo, q[0]);
  check("two ingredients, cooked, come before one ingredient alone",
    q.findIndex((s) => s.includes(" cooked")) < q.findIndex((s) => s.endsWith(" food")),
    q.join(" | "));
  check("the bare ingredient is the last resort", q[q.length - 1].endsWith(" food"), q.join(" | "));
  check("no query is repeated", new Set(q).size === q.length, q.join(" | "));
  check("every meal still has a ladder to walk", MEALS.every((m) => photoQueries(m).length >= 2));
}


// --- a photo we cannot credit is a photo we cannot use
{
  const img = (extmetadata: Record<string, { value?: string }>) => ({
    thumburl: "https://upload.wikimedia.org/x.jpg",
    mime: "image/jpeg",
    width: 2000,
    height: 1400,
    extmetadata,
  });
  const pageOf = (extmetadata: Record<string, { value?: string }>): CommonsPage => ({
    title: "File:Some dish.jpg", index: 1, imageinfo: [img(extmetadata)],
  });

  check("a public-domain photo needs no credit line",
    creditFor(img({ LicenseShortName: { value: "Public domain" } })) === null);
  check("so does CC0", creditFor(img({ LicenseShortName: { value: "CC0" } })) === null);

  const by = creditFor(img({
    LicenseShortName: { value: "CC BY-SA 4.0" },
    Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Someone">Jane Doe</a>' },
  }));
  check("a CC BY-SA photo is credited to its photographer", by === "Jane Doe · CC BY-SA 4.0", String(by));
  check("the credit is plain text, not the markup Commons stores",
    typeof by === "string" && !by.includes("<"), String(by));

  check("a licence that asks for credit, with nobody named, cannot be used",
    creditFor(img({ LicenseShortName: { value: "CC BY 3.0" } })) === undefined);
  check("and an image with no licence at all cannot be used either",
    creditFor(img({ Artist: { value: "Jane Doe" } })) === undefined);

  check("the picker passes over a photo it cannot credit",
    pickPhoto([pageOf({ LicenseShortName: { value: "CC BY 3.0" } })]) === null);

  const chosen = pickPhoto([
    pageOf({ LicenseShortName: { value: "CC BY 4.0" } }), // no artist — unusable
    { title: "File:Other dish.jpg", index: 2, imageinfo: [{
      ...img({ LicenseShortName: { value: "CC0" } }),
      thumburl: "https://upload.wikimedia.org/free.jpg",
    }] },
  ]);
  check("and takes the next one it can",
    chosen?.url === "https://upload.wikimedia.org/free.jpg", String(chosen?.url));
  check("a photographer's whole upload template is trimmed to a name",
    (creditFor(img({
      LicenseShortName: { value: "CC BY 4.0" },
      Artist: { value: "x".repeat(200) },
    })) ?? "").length < 80);
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
    uses, slot: "lunch", notes: [], kcal: 0, protein: 0, photo: "",
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
  check("bread is not gluten-free", !dietOk(mk(["bread", "egg"]), "glutenFree"));
  check("rice + chicken is gluten-free", dietOk(mk(["rice", "chicken"]), "glutenFree"));
}

// --- the shopping list behind the near-miss meals
{
  const f = (id: string) => FOODS.find((x) => x.id === id)!;
  const match = (missing: string[]) => ({
    meal: { id: "m", he: { title: "", how: "" }, en: { title: "", how: "" }, uses: [], slot: "lunch" as const, notes: [], kcal: 0, protein: 0, photo: "" },
    have: [], missing: missing.map(f), ready: false, fit: 0,
  });
  const list = shoppingList([match(["rice", "egg"]), match(["rice"]), match(["tuna"])]);
  check("each missing item appears once", list.length === 3, String(list.length));
  check("the most-needed item leads", list[0].food.id === "rice", list[0].food.id);
  check("its count is how many meals need it", list[0].count === 2, String(list[0].count));
  check("a one-meal item counts once", list.every((i) => i.food.id === "rice" || i.count === 1));
  check("no missing items yields an empty list", shoppingList([]).length === 0);
  check("a fully-ready meal adds nothing", shoppingList([match([])]).length === 0);
}

// --- searching the food library, for logging what you actually ate
{
  check("an empty query returns nothing", searchFoods("").length === 0);
  check("a Hebrew name is found", searchFoods("אורז").some((f) => f.id === "rice"));
  check("an English name is found", searchFoods("rice").some((f) => f.id === "rice"));
  check("a partial word still matches", searchFoods("עגבנ").some((f) => f.id === "tomato"));
  check("an exact name ranks first", searchFoods("ביצים")[0]?.id === "egg", searchFoods("ביצים")[0]?.id);
  check("nonsense finds nothing", searchFoods("קשקושבלבל").length === 0);
  check("results are capped", searchFoods("a", 5).length <= 5);
  check("no duplicate foods in results", (() => {
    const r = searchFoods("ג");
    return new Set(r.map((f) => f.id)).size === r.length;
  })());
}

// --- the plate is built for the goal, not just re-sorted
{
  const food = (id: string) => FOODS.find((f) => f.id === id)!;
  const fridge = ["chicken", "rice", "broccoli", "oliveOil", "banana", "yellowCheese"].map(food);
  const cut = plateForGoal(fridge, "lunch", "cut");
  const bulk = plateForGoal(fridge, "lunch", "bulk");
  const recomp = plateForGoal(fridge, "lunch", "recomp");
  const maintain = plateForGoal(fridge, "lunch", "maintain");

  check("a cut plate exists", !!cut);
  check("a bulk plate exists", !!bulk);
  check("cutting drops the carbs", !cut!.uses.includes("rice"), cut!.uses.join());
  check("cutting drops the oil", !cut!.uses.includes("oliveOil"), cut!.uses.join());
  check("bulking keeps the carbs", bulk!.uses.includes("rice"), bulk!.uses.join());
  check("bulking keeps the fats", bulk!.uses.includes("oliveOil"), bulk!.uses.join());
  check("a bulk plate outweighs a cut plate", bulk!.kcal > cut!.kcal, `${cut!.kcal} vs ${bulk!.kcal}`);
  check("every goal builds a different plate", new Set([cut, bulk, recomp, maintain].map((m) => `${m!.uses.join()}|${m!.kcal}|${m!.protein}`)).size === 4);
  check("a cut plate carries more protein per calorie than a bulk one", cut!.protein / cut!.kcal > bulk!.protein / bulk!.kcal);
  check("the goal is written on the plate", cut!.he.how.includes("לחיטוב") && bulk!.he.how.includes("למסה"));
  check("lamb is meat", !foodDietOk(food("lamb"), "vegetarian"));
  check("a bagel is not gluten-free", !foodDietOk(food("bagel"), "glutenFree"));
  check("the protein survives every goal", [cut, bulk, recomp, maintain].every((m) => m!.uses.includes("chicken")));
  check("plate items keep the order they were written in", (() => {
    const order = fridge.map((f) => f.id);
    const at = maintain!.uses.map((id) => order.indexOf(id));
    return at.every((n, i) => i === 0 || n > at[i - 1]!);
  })());

  // the dietary filter rewrites the plate rather than removing it
  const withPork = ["pork", "rice", "broccoli", "tomato"].map(food);
  const kosherPlate = plateForGoal(withPork, "lunch", "maintain", "kosher");
  check("kosher takes the pork off the plate", !!kosherPlate && !kosherPlate.uses.includes("pork"), kosherPlate?.uses.join());
  check("kosher still serves a plate", !!kosherPlate && kosherPlate.uses.length >= 2);
  const meatAndDairy = ["chicken", "yellowCheese", "rice", "tomato"].map(food);
  const noCheese = plateForGoal(meatAndDairy, "lunch", "maintain", "kosher");
  check("kosher keeps meat and dairy apart", !!noCheese && !noCheese.uses.includes("yellowCheese"), noCheese?.uses.join());
  const veg = plateForGoal(meatAndDairy, "lunch", "maintain", "vegetarian");
  check("vegetarian drops the chicken, keeps the cheese", !!veg && !veg.uses.includes("chicken") && veg.uses.includes("yellowCheese"), veg?.uses.join());
  const gf = plateForGoal(["bread", "chicken", "tomato"].map(food), "lunch", "maintain", "glutenFree");
  check("gluten-free drops the bread", !!gf && !gf.uses.includes("bread"), gf?.uses.join());

  check("a plate needs two ingredients", plateForGoal([food("chicken")], "lunch", "cut") === null);
  check("a filter that empties the fridge yields no plate", plateForGoal(["pork", "shrimp"].map(food), "lunch", "cut", "kosher") === null);
  check("a goal that wants none of the fridge still plates it", (() => {
    // cutting takes no carbs and no fats — a fridge of only those must still eat
    const m = plateForGoal(["rice", "pasta", "oliveOil"].map(food), "lunch", "cut");
    return !!m && m.uses.length >= 2;
  })());
  check("no ingredient is used twice", (() => {
    const m = plateForGoal(fridge, "lunch", "bulk")!;
    return new Set(m.uses).size === m.uses.length;
  })());
  check("a maintenance plate's calories are the plain sum of its parts", (() => {
    const m = plateForGoal(fridge, "lunch", "maintain")!;
    const sum = m.uses.reduce((n, id) => n + foodNutrition(food(id)).kcal, 0);
    return m.kcal === sum;
  })());
  check("a scaled plate stays within reach of its parts", (() => {
    const m = plateForGoal(fridge, "lunch", "bulk")!;
    const sum = m.uses.reduce((n, id) => n + foodNutrition(food(id)).kcal, 0);
    return m.kcal > sum && m.kcal < sum * 2;
  })());
  check("an unknown food can still be plated", (() => {
    const m = plateForGoal([adhocFood("שקשוקה"), food("chicken")], "lunch", "maintain");
    return !!m && m.uses.length === 2;
  })());
}

// --- one ingredient against a filter, and what a filter hides
{
  const food = (id: string) => FOODS.find((f) => f.id === id)!;
  check("everything passes the open filter", FOODS.every((f) => foodDietOk(f, "all")));
  check("pork is not kosher", !foodDietOk(food("pork"), "kosher"));
  check("fish is kosher", foodDietOk(food("salmon"), "kosher"));
  check("fish is not vegetarian", !foodDietOk(food("salmon"), "vegetarian"));
  check("eggs are vegetarian", foodDietOk(food("egg"), "vegetarian"));
  check("bread has gluten", !foodDietOk(food("bread"), "glutenFree"));
  check("rice has none", foodDietOk(food("rice"), "glutenFree"));

  const all = MEALS.map((meal) => ({ meal, have: [], missing: [], ready: true, fit: 0 }));
  check("nothing is hidden by the open filter", dietHidden(all, "all") === 0);
  check("the kosher filter hides something", dietHidden(all, "kosher") > 0, String(dietHidden(all, "kosher")));
  check("hidden plus shown is the whole menu", dietHidden(all, "vegetarian") + all.filter((m) => dietOk(m.meal, "vegetarian")).length === all.length);
}


// --- the food library holds together
{
  check("every food id is unique", new Set(FOODS.map((f) => f.id)).size === FOODS.length);
  check("the library is deep enough to recognise a real shopping list", FOODS.length >= 120,
    String(FOODS.length));

  // No two foods may claim the same word. The scanner takes the longest term
  // first and, on a tie, whichever food sits earlier in the list — so a
  // generic entry that still claims "שקדים" makes a dedicated almonds row
  // unreachable, and nothing tells you: the word simply keeps resolving to
  // the wrong food.
  const owners = new Map<string, string>();
  const clashes: string[] = [];
  for (const food of FOODS) {
    for (const term of food.match) {
      const key = term.toLowerCase();
      if (owners.has(key)) clashes.push(`${key}: ${owners.get(key)} vs ${food.id}`);
      else owners.set(key, food.id);
    }
  }
  check("no two foods claim the same word", clashes.length === 0, clashes.join(", "));

  // The same rule, seen from the other side: whoever wins the longest-first
  // sort must be the food that asked for the term.
  const terms = FOODS.flatMap((f) => f.match.map((t) => ({ id: f.id, term: t.toLowerCase() })));
  const winner = new Map<string, string>();
  for (const { id, term } of [...terms].sort((a, b) => b.term.length - a.term.length)) {
    if (!winner.has(term)) winner.set(term, id);
  }
  const shadowed = terms.filter((t) => winner.get(t.term) !== t.id).map((t) => `${t.term}→${t.id}`);
  check("no food is shadowed by another's word", shadowed.length === 0, shadowed.join(", "));

  check("every food has at least one word to match on", FOODS.every((f) => f.match.length > 0));
  check("every food names itself in both languages",
    FOODS.every((f) => f.he.trim().length > 0 && f.en.trim().length > 0));
  check("every food has a portion worth eating",
    FOODS.every((f) => portion(f.id).g > 0 && portion(f.id).he.trim() && portion(f.id).en.trim()));
}

// --- the healthy staples that were added second are really reachable
{
  const has = (id: string) => FOODS.some((f) => f.id === id);
  for (const id of ["freekeh", "buckwheat", "kale", "labneh", "kefir", "mackerel", "kohlrabi", "flaxseed"]) {
    check(`the library knows ${id}`, has(id));
  }

  // A real Hebrew list, written the way people write it: glued prefixes,
  // commas, and a specific food whose word a generic entry used to swallow.
  const list = readPantry("קניתי פריקה, קייל וקולרבי, שקדים, אגוזי מלך, לאבנה ותותים");
  const ids = new Set(list.map((f) => f.id));
  for (const id of ["freekeh", "kale", "kohlrabi", "almonds", "walnuts", "labneh", "strawberries"]) {
    check(`the scanner finds ${id} in a written list`, ids.has(id), [...ids].join(","));
  }
  check("the generic nuts row did not swallow the specific ones", !ids.has("nuts"));

  // Freekeh and barley are wheat and barley whatever the health aisle calls
  // them, and pita is bread — a gluten-free filter that served them would be
  // worse than no filter.
  for (const id of ["freekeh", "barley", "pita", "pitaWhole"]) {
    check(`${id} is not gluten-free`, !foodDietOk(FOODS.find((f) => f.id === id)!, "glutenFree"));
  }
  check("buckwheat is gluten-free despite the name",
    foodDietOk(FOODS.find((f) => f.id === "buckwheat")!, "glutenFree"));
  check("mackerel counts as flesh for a vegetarian",
    !foodDietOk(FOODS.find((f) => f.id === "mackerel")!, "vegetarian"));
}

// --- the menu itself holds together
{
  const foodIds = new Set(FOODS.map((f) => f.id));
  check("the menu is deep enough to rotate", MEALS.length >= 55, String(MEALS.length));
  check("every meal id is unique", new Set(MEALS.map((m) => m.id)).size === MEALS.length);
  check("every Hebrew title is unique", new Set(MEALS.map((m) => m.he.title)).size === MEALS.length, (() => {
    const seen = new Set<string>(); const d: string[] = [];
    for (const m of MEALS) { if (seen.has(m.he.title)) d.push(m.he.title); seen.add(m.he.title); }
    return d.join(",");
  })());
  check("every English title is unique", new Set(MEALS.map((m) => m.en.title)).size === MEALS.length, (() => {
    const seen = new Set<string>(); const d: string[] = [];
    for (const m of MEALS) { if (seen.has(m.en.title)) d.push(m.en.title); seen.add(m.en.title); }
    return d.join(",");
  })());
  check("every ingredient is a real food", MEALS.every((m) => m.uses.every((id) => foodIds.has(id))),
    MEALS.flatMap((m) => m.uses.filter((id) => !foodIds.has(id))).join(","));
  check("no meal repeats an ingredient",
    MEALS.every((m) => new Set(m.uses).size === m.uses.length),
    MEALS.filter((m) => new Set(m.uses).size !== m.uses.length).map((m) => m.id).join(","));
  check("every meal has at least two ingredients", MEALS.every((m) => m.uses.length >= 2));
  check("every meal has a note", MEALS.every((m) => m.notes.length >= 1));
  check("calories are plausible", MEALS.every((m) => m.kcal >= 100 && m.kcal <= 900),
    MEALS.filter((m) => m.kcal < 100 || m.kcal > 900).map((m) => `${m.id}:${m.kcal}`).join(","));
  check("protein never exceeds what the calories allow",
    MEALS.every((m) => m.protein * 4 <= m.kcal),
    MEALS.filter((m) => m.protein * 4 > m.kcal).map((m) => m.id).join(","));
  check("every slot has real choice", (["breakfast", "lunch", "dinner", "snack"] as const).every(
    (slot) => MEALS.filter((m) => m.slot === slot).length >= 8),
    (["breakfast", "lunch", "dinner", "snack"] as const)
      .map((s) => `${s}:${MEALS.filter((m) => m.slot === s).length}`).join(" "));
  check("every meal has a portion for each of its foods",
    MEALS.every((m) => m.uses.every((id) => portion(id).g > 0)));
}

// --- the same fridge does not serve the same plate for ever
{
  // a well-stocked kitchen, so there is genuinely something to rotate between
  const list = "ביצים, עגבנייה, מלפפון, לחם, לחם מלא, יוגורט יווני, קוטג', בננה, אורז, " +
    "חזה עוף, הודו, גבינה לבנה, גבינה צהובה, שמן זית, טונה, חסה, פלפל, בצל, שיבולת שועל, " +
    "חמאת בוטנים, אגוזים, אבוקדו, תפוח, בטטה, ברוקולי, קינואה, טחינה, חומוס, פטריות, תרד";
  const top = (seed: string) =>
    suggestMeals(list, { goal: "cut", slot: "lunch", seed }).ready.slice(0, 3).map((m) => m.meal.id).join(",");

  check("no seed is still deterministic", top("") === top(""));
  const days = new Set(["d1", "d2", "d3", "d4", "d5", "d6", "d7"].map(top));
  check("a week of seeds gives more than one line-up", days.size > 1, [...days].join(" | "));
  check("a week of seeds gives at least three different line-ups", days.size >= 3, String(days.size));
  check("two people with the same fridge get different plates",
    top("salt-a|2026-03-10") !== top("salt-b|2026-03-10"), top("salt-a|2026-03-10"));
  check("the same person on the same day gets the same plate",
    top("salt-a|2026-03-10") === top("salt-a|2026-03-10"));
  check("rotation never surfaces a dish that does not serve the goal", (() => {
    // whatever the seed, the three dishes on screen are all within a fifth of
    // the best available fit — variety must never cost quality
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const rows = suggestMeals(list, { goal: "cut", slot: "lunch", seed }).ready;
      const best = rows.reduce((n, m) => Math.max(n, m.fit), 0);
      for (const m of rows.slice(0, 3)) if (m.fit < best * 0.8) return false;
    }
    return true;
  })());
  check("the right time of day still leads", (() => {
    for (const seed of ["a", "b", "c", "d"]) {
      const rows = suggestMeals(list, { goal: "cut", slot: "lunch", seed }).ready;
      if (!rows.slice(0, 3).every((m) => m.meal.slot === "lunch")) return false;
    }
    return true;
  })());
  check("over a fortnight the kitchen serves a real variety of dishes", (() => {
    const seen = new Set<string>();
    for (let d = 0; d < 14; d++) {
      for (const m of suggestMeals(list, { goal: "cut", slot: "lunch", seed: `s|${d}` }).ready.slice(0, 3)) {
        seen.add(m.meal.id);
      }
    }
    return seen.size >= 4;
  })(), "");
  check("starter meals rotate too", (() => {
    const a = starterMeals("cut", "s1").map((m) => m.id).join();
    const b = starterMeals("cut", "s2").map((m) => m.id).join();
    return a !== b;
  })());
  check("starter meals still fit the goal", (() => {
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      for (const m of starterMeals("cut", seed)) if (goalFit(m, "cut") < 0.5) return false;
    }
    return true;
  })());
  check("every ready meal is genuinely cookable from the list", (() => {
    const rows = suggestMeals(list, { goal: "bulk", slot: "dinner", seed: "x" }).ready;
    return rows.every((m) => m.missing.length === 0);
  })());
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
