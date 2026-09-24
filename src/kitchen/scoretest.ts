import { FOODS } from "./data";
import { bandOf, scoreAnything, scoreFood, scoreWords } from "./score";

/**
 * The food score, checked for the thing that actually matters: the order.
 *
 * An exact number is a matter of taste and will be tuned; what must never drift
 * is which food beats which. If a sausage ever outscores a lentil the feature is
 * broken no matter how confident the decimal looks.
 */

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const food = (id: string) => FOODS.find((f) => f.id === id)!;
const score = (id: string) => scoreFood(food(id)).value;

// --- every food gets a usable number
{
  const all = FOODS.map((f) => scoreFood(f));
  check("every food scores inside the scale", all.every((s) => s.value >= 0 && s.value <= 10));
  check("nothing is written off entirely", all.every((s) => s.value > 1));
  check("nothing is perfect either", all.every((s) => s.value < 10));
  check("every score is one decimal place",
    all.every((s) => Math.abs(s.value * 10 - Math.round(s.value * 10)) < 1e-9));
  check("every food says why", all.every((s) => s.reasons.length >= 1));
  check("no food gives more than three reasons", all.every((s) => s.reasons.length <= 3));
  check("a library food knows it is known", all.every((s) => s.known));
}

// --- the orderings that must hold
{
  check("salmon beats sausage", score("salmon") > score("sausage"),
    `${score("salmon")} vs ${score("sausage")}`);
  check("lentils beat white bread", score("lentils") > score("bread"),
    `${score("lentils")} vs ${score("bread")}`);
  check("whole-grain bread beats white bread", score("wholeBread") > score("bread"),
    `${score("wholeBread")} vs ${score("bread")}`);
  check("brown rice beats white rice", score("brownRice") > score("rice"));
  check("olive oil beats mayonnaise", score("oliveOil") > score("mayo"),
    `${score("oliveOil")} vs ${score("mayo")}`);
  check("broccoli beats a bagel", score("broccoli") > score("bagel"));
  check("cottage cheese beats yellow cheese", score("cottage") > score("yellowCheese"));
  check("an apple beats dates", score("apple") > score("dates"));
  check("chicken beats beef", score("chicken") > score("beef"));
  check("oats beat cornflakes", score("oats") > score("cornflakes"),
    `${score("oats")} vs ${score("cornflakes")}`);
  check("nuts beat butter", score("nuts") > score("butter"));
  check("tuna scores well", score("tuna") >= 8.4, String(score("tuna")));
  check("salmon scores above tuna", score("salmon") > score("tuna"),
    `${score("salmon")} vs ${score("tuna")}`);
  check("a sausage scores badly", score("sausage") <= 4, String(score("sausage")));
}

// --- the bands read the way a person would say them
{
  check("a top score reads great", bandOf(9.1) === "great");
  check("the middle reads ok", bandOf(6.0) === "ok");
  check("a low score reads rarely", bandOf(2.0) === "rarely");
  check("no band is called bad",
    ["great", "good", "ok", "sometimes", "rarely"].includes(bandOf(1)));
  // Nearly every vegetable, but not quite all of them: ketchup is filed under
  // vegetables and is mostly sugar, and the score is right to say so.
  const veg = FOODS.filter((f) => f.tags[0] === "veg");
  const topTwo = veg.filter((f) => ["great", "good"].includes(scoreFood(f).band));
  check("vegetables land in the top two bands", topTwo.length >= veg.length - 2,
    `${topTwo.length}/${veg.length}`);
  check("except the ones that are really a sauce", score("ketchup") < 5, String(score("ketchup")));
}

// --- typing a food the library knows
{
  const { score: s, food: f } = scoreAnything("tuna");
  check("a known food is recognised", f?.id === "tuna");
  check("and scored as itself", s.value === score("tuna"), String(s.value));
  check("it is not marked a guess", s.known);

  const he = scoreAnything("טונה");
  check("Hebrew finds the same food", he.food?.id === "tuna");
  check("and the same score", he.score.value === score("tuna"));

  const longer = scoreAnything("whole bread");
  check("the longest name wins, as in the pantry", longer.food?.id === "wholeBread", longer.food?.id);
}

// --- and something it has never heard of
{
  const cake = scoreWords("chocolate cake");
  check("cake scores low", cake.value < 4, String(cake.value));
  check("and says it is a guess", cake.reasons.includes("guess"));
  check("a guess is marked as one", !cake.known);

  const salad = scoreWords("big green salad");
  check("a salad scores well even unknown", salad.value > 6.5, String(salad.value));
  check("soda scores worse than salad", scoreWords("cola soda").value < salad.value);
  check("an unknown word lands in the middle rather than nowhere",
    Math.abs(scoreWords("qwertyfood").value - 5.4) < 0.1, String(scoreWords("qwertyfood").value));

  // Hebrew carries the same weight as English — the app is Hebrew first.
  check("Hebrew cake scores low", scoreWords("עוגת שוקולד").value < 4, String(scoreWords("עוגת שוקולד").value));
  check("Hebrew salad scores well", scoreWords("סלט ירקות").value > 6.5, String(scoreWords("סלט ירקות").value));
  check("Hebrew fried scores below plain", scoreWords("שניצל מטוגן").value < scoreWords("שניצל").value);
}

// --- how a food is cooked changes it, even when the food is known
{
  const plain = scoreAnything("chicken");
  const fried = scoreAnything("fried chicken");
  check("frying a known food costs it", fried.score.value < plain.score.value,
    `${fried.score.value} vs ${plain.score.value}`);
  check("the fried version still knows what it is", fried.food?.id === "chicken");
  const grilled = scoreAnything("grilled chicken");
  check("grilling it does not", grilled.score.value >= plain.score.value,
    `${grilled.score.value} vs ${plain.score.value}`);
  // Praise is capped and blame is not: a cooking method must not be able to
  // push a food to the top of the scale, or the top of the scale means nothing.
  const grilledSalmon = scoreAnything("grilled salmon");
  check("a way of cooking cannot make a food perfect",
    grilledSalmon.score.value <= scoreAnything("salmon").score.value + 0.5,
    `${grilledSalmon.score.value} vs ${scoreAnything("salmon").score.value}`);
  check("but frying can still ruin one",
    scoreAnything("fried salmon").score.value < scoreAnything("salmon").score.value - 1);
}

// --- nothing thrown at it should throw back
{
  for (const text of ["", "   ", "!!!", "123", "🍕", "a".repeat(300)]) {
    const out = scoreAnything(text);
    check(`"${text.slice(0, 12)}" is answered rather than crashed on`,
      out.score.value >= 0 && out.score.value <= 10);
  }
}

// --- the new foods are read for what they are, not as plain whole foods
{
  const v = (id: string) => scoreFood(FOODS.find((f) => f.id === id)!).value;
  check("pizza scores below a chopped salad", v("pizza") < v("israeliSalad"));
  check("cola is a 'rarely'", bandOf(v("cola")) === "rarely", String(v("cola")));
  check("tilapia scores like lean fish (good or better)", v("tilapia") >= 7, String(v("tilapia")));
  check("fries score below a baked potato", v("fries") < v("potato"));
  check("a cake scores below an apple", v("cake") < v("apple"));
  check("black coffee is not punished", v("coffee") >= 5.5, String(v("coffee")));
  check("\"פיצה\" is now a known food", scoreAnything("פיצה").score.known && scoreAnything("פיצה").food?.id === "pizza");
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
