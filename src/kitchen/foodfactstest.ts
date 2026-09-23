import { foodFromFact, parseFoodFacts } from "./foodfacts";
import { per100For } from "./data";
import { itemNutrition } from "./calc";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const reply = {
  count: 5,
  products: [
    {
      code: "7290000000011",
      product_name: "Hummus",
      product_name_he: "חומוס אחלה",
      brands: "Achla, Strauss",
      nutriments: { "energy-kcal_100g": 268, proteins_100g: 7, carbohydrates_100g: 11.5, fat_100g: 21 },
    },
    // calories only in kJ
    { code: "2", product_name: "Protein bar", brands: "X", nutriments: { energy_100g: 1674, proteins_100g: 20 } },
    // no calories at all → dropped
    { code: "3", product_name: "Mystery", nutriments: { proteins_100g: 5 } },
    // impossible density → dropped
    { code: "4", product_name: "Typo", nutriments: { "energy-kcal_100g": 9000 } },
    // nameless → dropped
    { code: "5", nutriments: { "energy-kcal_100g": 100 } },
    // duplicate of the first by name+brand → dropped
    {
      code: "6",
      product_name: "Hummus",
      product_name_he: "חומוס אחלה",
      brands: "Achla",
      nutriments: { "energy-kcal_100g": 270 },
    },
    // silly macros are clamped, not trusted
    { code: "7", product_name: "Oil", nutriments: { "energy-kcal_100g": "884", fat_100g: 180, proteins_100g: -3 } },
  ],
};

const he = parseFoodFacts(reply, "he");
check("unusable rows are dropped", he.length === 3, JSON.stringify(he.map((h) => h.name)));
check("the Hebrew name is used in Hebrew", he[0]?.name === "חומוס אחלה");
check("the first brand is kept", he[0]?.brand === "Achla");
check("kcal and macros come through per 100 g",
  he[0]?.per100.kcal === 268 && he[0]?.per100.protein === 7 && he[0]?.per100.fat === 21);
check("kJ is converted to kcal (1674 kJ ≈ 400 kcal)", he[1]?.per100.kcal === 400, String(he[1]?.per100.kcal));
check("a string number is read", he[2]?.per100.kcal === 884);
check("an impossible fat figure is clamped to 100", he[2]?.per100.fat === 100);
check("a negative protein is clamped to 0", he[2]?.per100.protein === 0);

const en = parseFoodFacts(reply, "en");
check("the English name is used in English", en[0]?.name === "Hummus");

for (const junk of [null, undefined, 0, "x", [], {}, { products: "no" }, { products: [null, 1, "a"] }]) {
  check(`junk (${JSON.stringify(junk)}) parses to nothing`, parseFoodFacts(junk, "he").length === 0);
}

// A found product on a plate is priced by its own figures.
{
  const food = foodFromFact(he[0]!);
  check("a found product carries its own nutrition", per100For(food).source === "food" && food.src === "off");
  check("…and 60 g of it is 161 kcal (268 × 0.6)", itemNutrition({ food, grams: 60 }).kcal === 161);
  check("its id cannot collide with a library food", food.id.startsWith("off:"));
  check("its label names the brand", food.he.includes("Achla"));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
