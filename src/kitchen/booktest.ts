/**
 * The recipe book: every dish has a method, and search, filters and diet
 * narrowing return what a person would expect.
 */
import { MEALS } from "./data";
import { RECIPES, stepMinutes } from "./recipes";
import { bookSize, dietWarnings, matchesFilter, scaledGrams, searchBook, shareText } from "./book";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const ids = (ms: { id: string }[]) => ms.map((m) => m.id);

// --- every dish has a full method
{
  const missing = MEALS.filter((m) => !RECIPES[m.id]).map((m) => m.id);
  check("every dish in the kitchen has a recipe", missing.length === 0, missing.join(", "));
  const orphan = Object.keys(RECIPES).filter((id) => !MEALS.some((m) => m.id === id));
  check("no recipe points at a dish that does not exist", orphan.length === 0, orphan.join(", "));
  const uneven = Object.entries(RECIPES).filter(([, r]) => r.he.length !== r.en.length).map(([id]) => id);
  check("Hebrew and English methods have the same steps", uneven.length === 0, uneven.join(", "));
  const thin = MEALS.filter((m) => m.slot !== "snack" && (RECIPES[m.id]?.he.length ?? 0) < 3).map((m) => m.id);
  check("every meal (not a snack) has at least three steps", thin.length === 0, thin.join(", "));
  const noOptions = Object.entries(RECIPES).filter(([, r]) => r.options.length === 0).map(([id]) => id);
  check("every recipe offers at least one option for someone else", noOptions.length === 0, noOptions.join(", "));
  const badTime = Object.entries(RECIPES).filter(([, r]) => !(r.minutes > 0 && r.minutes <= 240)).map(([id]) => id);
  check("every recipe has a sane time", badTime.length === 0, badTime.join(", "));
  const empty = Object.entries(RECIPES).filter(([, r]) => [...r.he, ...r.en].some((s) => s.trim().length < 8)).map(([id]) => id);
  check("no step is empty or a stub", empty.length === 0, empty.join(", "));
  const hebrewInEnglish = Object.entries(RECIPES).filter(([, r]) => r.en.some((s) => /[֐-׿]/.test(s))).map(([id]) => id);
  check("English steps are in English", hebrewInEnglish.length === 0, hebrewInEnglish.join(", "));
  const englishInHebrew = Object.entries(RECIPES).filter(([, r]) => r.he.some((s) => !/[֐-׿]/.test(s))).map(([id]) => id);
  check("Hebrew steps are in Hebrew", englishInHebrew.length === 0, englishInHebrew.join(", "));
  check("the book is big enough to browse", MEALS.length >= 130, String(MEALS.length));
}

// --- search
{
  const tahini = ids(searchBook({ query: "טחינה" }));
  check("searching an ingredient finds dishes made with it", tahini.includes("hummus-bowl") && tahini.includes("sabich-bowl"), tahini.slice(0, 8).join(","));
  const prefixed = ids(searchBook({ query: "בטחינה" }));
  check("a Hebrew prefix letter does not hide the ingredient", prefixed.includes("hummus-bowl"), prefixed.slice(0, 5).join(","));
  const en = ids(searchBook({ query: "salmon", anyDiet: true }));
  check("English search works too", en.includes("salmon-poke") && en.includes("salmon-teriyaki"), en.join(","));
  const two = ids(searchBook({ query: "עוף אורז" }));
  check("every word of a search must match", two.includes("chicken-rice-broccoli") && !two.includes("tuna-salad"), two.join(","));
  check("nonsense finds nothing", searchBook({ query: "קקקקקק" }).length === 0);
}

// --- filters
{
  const breakfast = searchBook({ slot: "breakfast" });
  check("the meal filter keeps only that meal", breakfast.length > 10 && breakfast.every((m) => m.slot === "breakfast"));
  const quick = searchBook({ filter: "quick" });
  check("'quick' means 15 minutes or less", quick.length > 10 && quick.every((m) => RECIPES[m.id]!.minutes <= 15));
  const kids = searchBook({ filter: "kids" });
  check("there are dishes for kids", kids.length >= 8, String(kids.length));
  const veggie = searchBook({ filter: "veggie" });
  check("vegetarian leaves out meat and fish", veggie.length > 20 && !ids(veggie).includes("chicken-rice-broccoli") && !ids(veggie).includes("fish-chraime"));
  const protein = searchBook({ filter: "protein" });
  check("high protein means 25 g or more", protein.every((m) => m.protein >= 25) && protein.length > 20);
  check("a filter matches its own recipes", matchesFilter(MEALS.find((m) => m.id === "pita-pizza")!, "kids"));
  const all = searchBook({});
  const order = all.map((m) => m.slot);
  check("the book reads breakfast → lunch → dinner → snacks", order.indexOf("snack") > order.lastIndexOf("breakfast") && order.lastIndexOf("breakfast") < order.indexOf("dinner"));
}

// --- diet
{
  const kosher = ids(searchBook({ diet: "kosher" }));
  check("kosher hides meat with cheese", !kosher.includes("cheeseburger") && !kosher.includes("shrimp-stirfry"), kosher.length + "");
  check("kosher keeps the kosher dishes", kosher.includes("chicken-rice-broccoli") && kosher.includes("fish-chraime"));
  check("'show everything' ignores the diet setting", ids(searchBook({ diet: "kosher", anyDiet: true })).includes("cheeseburger"));
  check("the count follows the diet", bookSize("vegetarian") < bookSize(null) && bookSize(null) === MEALS.length);
  const cheeseburger = MEALS.find((m) => m.id === "cheeseburger")!;
  check("a dish that breaks the setting says which rule", dietWarnings(cheeseburger, "kosher,vegetarian").join(",") === "kosher,vegetarian", dietWarnings(cheeseburger, "kosher,vegetarian").join(","));
}

// --- servings, sharing, timers
{
  const shak = MEALS.find((m) => m.id === "shakshuka")!;
  check("four servings is four times the eggs", scaledGrams(shak, "egg", 4) === 400, String(scaledGrams(shak, "egg", 4)));
  const text = shareText(shak, "he", 2, { ingredients: "מצרכים", steps: "הכנה", footer: "APEX", minutes: "20 דק׳", gram: "גרם" });
  check("a shared recipe carries its title, amounts and numbered steps", text.startsWith("שקשוקה") && text.includes("ביצים — 200 גרם") && text.includes("1. ") && text.includes("APEX"), text);
  check("a step's minutes become a timer", stepMinutes("אופים 25 דקות עד שהתפוח רך.") === 25 && stepMinutes("Bake 18–20 minutes, turning") === 20);
  check("a step with no time has no timer", stepMinutes("חותכים עגבנייה") === null && stepMinutes("Cut the apple") === null);
  check("a ranged time uses the longer end", stepMinutes("מבשלים 5–6 דקות") === 6);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
