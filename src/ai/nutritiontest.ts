/**
 * Meal-photo parsing tests. The model's reply is untrusted text, and this is
 * the only thing standing between it and the person's food diary — so the
 * hostile cases matter more than the happy one.
 */
import {
  extractJson,
  MAX_ITEM_KCAL,
  MAX_ITEMS,
  mealLabel,
  mealPhotoPrompt,
  parseMealAnalysis,
} from "./nutrition";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const good = JSON.stringify({
  items: [
    { label: "חזה עוף", grams: 150, kcal: 250, protein: 46 },
    { label: "אורז", grams: 200, kcal: 260, protein: 5 },
  ],
  confidence: 0.8,
});

// --- the happy path
{
  const a = parseMealAnalysis(good)!;
  check("a clean reply parses", !!a);
  check("both items are kept", a.items.length === 2);
  check("totals are summed from the items", a.kcal === 510 && a.protein === 51, JSON.stringify(a));
  check("confidence is carried", a.confidence === 0.8);
  check("the diary label names the foods", mealLabel(a, "ארוחה").includes("חזה עוף"));
}

// --- shapes a model actually returns
check("a ```json fence is tolerated", !!parseMealAnalysis("```json\n" + good + "\n```"));
check("a bare fence is tolerated", !!parseMealAnalysis("```\n" + good + "\n```"));
check("chatter around the json is tolerated",
  !!parseMealAnalysis("Sure! Here you go:\n" + good + "\nHope that helps."));
check("numbers sent as strings are read",
  parseMealAnalysis('{"items":[{"label":"בננה","grams":"120","kcal":"105","protein":"1"}]}')?.kcal === 105);

// --- refusals: nothing unusable may reach the diary
check("prose with no json is refused", parseMealAnalysis("I think that's a salad.") === null);
check("broken json is refused", parseMealAnalysis('{"items":[{"label":') === null);
check("an empty item list is refused", parseMealAnalysis('{"items":[],"confidence":0}') === null);
check("a non-food photo is refused", parseMealAnalysis('{"items":[],"confidence":0}') === null);
check("an item with no name is dropped",
  parseMealAnalysis('{"items":[{"label":"","kcal":200}]}') === null);
check("an item with no calories is dropped",
  parseMealAnalysis('{"items":[{"label":"מים","protein":0}]}') === null);
check("a zero-calorie plate is refused",
  parseMealAnalysis('{"items":[{"label":"חסה","kcal":0}]}') === null);
check("empty input is refused", parseMealAnalysis("") === null);
check("null-ish input is refused", parseMealAnalysis("null") === null);

// --- clamping: a bad number cannot poison the diary
{
  const wild = parseMealAnalysis(
    '{"items":[{"label":"פיצה","grams":999999,"kcal":9999999,"protein":-50}]}',
  )!;
  check("an absurd calorie count is capped", wild.items[0]!.kcal === MAX_ITEM_KCAL, String(wild.items[0]!.kcal));
  check("a negative protein becomes zero", wild.items[0]!.protein === 0);
  check("an absurd gram count is capped", wild.items[0]!.grams <= 5000);
}
check("NaN calories are refused", parseMealAnalysis('{"items":[{"label":"x","kcal":"abc"}]}') === null);
{
  const many = { items: Array.from({ length: 40 }, (_, i) => ({ label: `f${i}`, kcal: 10 })) };
  const a = parseMealAnalysis(JSON.stringify(many))!;
  check("a runaway item list is truncated", a.items.length === MAX_ITEMS, String(a.items.length));
}
{
  const longName = parseMealAnalysis(
    JSON.stringify({ items: [{ label: "א".repeat(500), kcal: 100 }] }),
  )!;
  check("a mile-long name is trimmed", longName.items[0]!.label.length <= 60);
}
{
  const pct = parseMealAnalysis(JSON.stringify({ items: [{ label: "x", kcal: 100 }], confidence: 80 }))!;
  check("a confidence given as a percentage is normalised", pct.confidence === 0.8, String(pct.confidence));
  const none = parseMealAnalysis(JSON.stringify({ items: [{ label: "x", kcal: 100 }] }))!;
  check("a missing confidence defaults to the middle", none.confidence === 0.5);
}

// --- totals are the app's, not the model's
{
  const lying = parseMealAnalysis(
    '{"items":[{"label":"a","kcal":100},{"label":"b","kcal":100}],"kcal":99999}',
  )!;
  check("a total the model invented is ignored", lying.kcal === 200, String(lying.kcal));
}

// --- json extraction on its own
check("extractJson finds an object", typeof extractJson('noise {"a":1} noise') === "object");
check("extractJson refuses junk", extractJson("no braces here") === null);

// --- the prompt and the parser agree on the shape
{
  const p = mealPhotoPrompt("he");
  check("the prompt asks for the exact keys the parser reads",
    p.includes('"items"') && p.includes('"kcal"') && p.includes('"protein"') && p.includes('"confidence"'));
  check("the prompt asks for the right language", p.includes("Hebrew"));
  check("the English prompt asks for English", mealPhotoPrompt("en").includes("English"));
  check("the prompt tells the model what to do with a non-food photo", p.includes('"items":[]'));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
