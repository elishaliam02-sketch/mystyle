/**
 * Coach tests. Two things must hold: the question is routed to the right topic
 * in both languages, and the answer quotes this person's real numbers rather
 * than generic filler.
 */
import { classify, coachReply, suggestedQuestions, type CoachContext } from "./index";
import { eatIntent, eatenLabel, parseEaten } from "./logfood";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const ctx: CoachContext = {
  name: "ליאם",
  goal: "cut",
  kcalTarget: 2000,
  kcalEaten: 1400,
  proteinTarget: 150,
  proteinEaten: 90,
  waterCups: 1250,
  waterGoal: 2500,
  steps: 6000,
  stepGoal: 10000,
  weeklyChangeKg: -0.6,
  bodyFat: 18.4,
  planDays: 4,
  trainedToday: false,
};

// --- routing, Hebrew
check("a calorie question routes to calories", classify("כמה קלוריות נשארו לי היום?") === "calories");
check("a protein question routes to protein", classify("כמה חלבון אני צריך") === "protein");
check("a water question routes to water", classify("כמה מים לשתות ביום") === "water");
check("a steps question routes to steps", classify("כמה צעדים עשיתי") === "steps");
check("a stuck-weight question routes to weight", classify("למה המשקל שלי תקוע") === "weight");
check("a plan question routes to the plan", classify("מה התוכנית אימון שלי") === "plan");
check("a cardio question routes to cardio", classify("כמה אירובי לעשות") === "cardio");
check("a kosher question routes to kosher", classify("איך אני מסנן כשר") === "kosher");
check("a soreness question routes to soreness", classify("יש לי כאבי שרירים") === "soreness");
check("a motivation question routes to motivation", classify("אין לי מוטיבציה נמאס לי") === "motivation");
check("a body-fat question routes to body fat", classify("מה אחוז שומן שלי") === "bodyfat");

// --- routing, English
check("English calories route", classify("how many calories left today") === "calories");
check("English plateau routes to weight", classify("why is my weight stuck on a plateau") === "weight");
check("English plan routes to plan", classify("what does my workout plan say") === "plan");

// --- unknown is honest rather than a wrong guess
check("gibberish is not forced into a topic", classify("קשקושבלבל") === "unknown");
check("an empty question is unknown", classify("   ") === "unknown");

// --- answers use the person's real numbers
{
  const r = coachReply("כמה קלוריות נשארו לי?", ctx, "he");
  check("the calorie answer states the remaining number", r.text.includes("600"), r.text.slice(0, 120));
  check("the calorie answer names the target", r.text.includes("2000"));
}
{
  const over = coachReply("כמה קלוריות נשארו לי?", { ...ctx, kcalEaten: 2300 }, "he");
  check("going over is reported without shaming", over.text.includes("300") && !over.text.includes("נכשל"), over.text.slice(0, 120));
}
{
  const r = coachReply("כמה חלבון", ctx, "he");
  check("the protein answer states what is left", r.text.includes("60"), r.text.slice(0, 120));
}
{
  const r = coachReply("כמה מים שתיתי", ctx, "he");
  check("the water answer says the litres left", r.text.includes("1.3") && r.text.includes("2.5"), r.text.slice(0, 120));
}
{
  const r = coachReply("למה אני תקוע", ctx, "he");
  check("a losing week is reported as progress", r.text.includes("0.6"), r.text.slice(0, 120));
  check("the weekly average is explained over a single weigh-in", r.text.includes("ממוצע"));
}
{
  const flat = coachReply("למה אני תקוע", { ...ctx, weeklyChangeKg: 0 }, "he");
  check("a flat week is not called failure", flat.text.includes("בסיס"), flat.text.slice(0, 120));
}
{
  const r = coachReply("מה התוכנית שלי", ctx, "he");
  check("the plan answer names the goal", r.text.includes("חיטוב"), r.text.slice(0, 120));
  check("the plan answer names the weekly frequency", r.text.includes("4"));
  check("not having trained today is mentioned", r.text.includes("אימון"));
}
{
  const r = coachReply("מה אחוז השומן שלי", ctx, "he");
  check("the body-fat answer quotes the estimate", r.text.includes("18.4"), r.text.slice(0, 120));
  const none = coachReply("מה אחוז השומן שלי", { ...ctx, bodyFat: null }, "he");
  check("with no estimate it says what is missing", none.text.includes("מותן"), none.text.slice(0, 120));
}
{
  const r = coachReply("אין לי מוטיבציה", ctx, "he");
  check("the motivation answer uses the person's name", r.text.includes("ליאם"), r.text.slice(0, 80));
}

// --- safety: no medical advice, and supplements defer to a professional
{
  const r = coachReply("כדאי לי לקחת קריאטין?", ctx, "he");
  check("a supplement question defers to a professional", r.text.includes("רופא") || r.text.includes("דיאטן"), r.text.slice(0, 140));
}
{
  const r = coachReply("יש לי כאב חד בברך", ctx, "he");
  check("sharp pain is sent to a professional", r.text.includes("מקצוע"), r.text.slice(0, 140));
}

// --- both languages always answer with something
{
  for (const q of [...suggestedQuestions("he"), ...suggestedQuestions("en")]) {
    const loc = /[֐-׿]/.test(q) ? "he" : "en";
    const r = coachReply(q, ctx, loc);
    if (r.text.trim().length < 20) check(`a suggested question is answered: ${q}`, false, r.text);
  }
  check("every suggested opener gets a real answer", true);
}
check("six openers are offered in each language",
  suggestedQuestions("he").length === 6 && suggestedQuestions("en").length === 6);

// --- an unknown question still offers a way forward
{
  const r = coachReply("קשקושבלבל", ctx, "he");
  check("an unknown question lists what the coach can do", r.text.includes("קלוריות") && r.text.includes("חלבון"), r.text.slice(0, 140));
}

// --- logging a meal from chat ("I ate ...")
{
  check("an 'I ate' sentence is recognised as eating", eatIntent("אכלתי 2 ביצים ואורז"));
  check("an English 'I had' is recognised", eatIntent("I had two eggs and rice"));
  check("a plain question is not eating", !eatIntent("כמה קלוריות נשארו לי"));
  check("asking about food is not eating", !eatIntent("מה כדאי לאכול"));

  const m = parseEaten("אכלתי 2 ביצים ואורז", "he");
  check("known foods are pulled from the sentence", !!m && m.items.length >= 2, JSON.stringify(m?.items?.map(i=>i.label)));
  check("a quantity before a food multiplies it", (() => {
    const eggs = m?.items.find((i) => i.food.id === "egg");
    return !!eggs && eggs.count === 2 && eggs.kcal > 0;
  })(), JSON.stringify(m?.items));
  check("calories and protein are summed", !!m && m.kcal > 0 && m.protein > 0);
  check("the diary label lists the foods", !!m && eatenLabel(m).includes("ביצים"));

  check("a sentence with no known food logs nothing", parseEaten("אכלתי משהו טעים", "he") === null);
  check("a Hebrew number word is understood", (() => {
    const two = parseEaten("אכלתי שתי ביצים", "he");
    const eggs = two?.items.find((i) => i.food.id === "egg");
    return !!eggs && eggs.count === 2;
  })());
  check("no quantity means one", (() => {
    const one = parseEaten("אכלתי ביצה", "he");
    const eggs = one?.items.find((i) => i.food.id === "egg");
    return !!eggs && eggs.count === 1;
  })(), JSON.stringify(parseEaten("אכלתי ביצה","he")));
  check("two eggs are two eggs, not two portions of two", (() => {
    const two = parseEaten("אכלתי 2 ביצים", "he");
    return !!two && two.kcal === 143;
  })(), String(parseEaten("אכלתי 2 ביצים", "he")?.kcal));
  check("one egg is half the two-egg portion", parseEaten("אכלתי ביצה", "he")?.kcal === 72);
  check("grams written are grams eaten", parseEaten("אכלתי 200 גרם חזה עוף", "he")?.kcal === 330);
  check("three falafel are three balls", parseEaten("אכלתי 3 פלאפל", "he")?.kcal === 170);
  check("a named portion with no number is one portion", parseEaten("אכלתי שניצל", "he")?.kcal === 387);
  check("an absurd quantity is capped", (() => {
    const lots = parseEaten("אכלתי 9999 ביצים", "he");
    const eggs = lots?.items.find((i) => i.food.id === "egg");
    return !!eggs && eggs.count <= 50;
  })());
}

// --- the questions people actually type
{
  const ctx = { name: "דני", goal: "cut" as const, kcalTarget: 2200, kcalEaten: 1400, steps: 5000, stepGoal: 8000,
    weeklyChangeKg: -0.5, currentKg: 88, goalKg: 80 };
  const ask = (q: string) => coachReply(q, ctx, "he");
  check("'can I eat pizza' is about pizza", ask("מותר לי פיצה?").topic === "canEat" && ask("מותר לי פיצה?").text.includes("/10"));
  check("'what to eat tonight' names dishes", ask("מה לאכול בערב?").topic === "mealIdea" && ask("מה לאכול בערב?").text.includes("•"));
  check("hunger gets hunger advice", ask("אני רעב מה לעשות").topic === "hunger");
  check("belly fat is answered honestly", ask("איך מורידים בטן?").topic === "belly");
  check("'how long' uses the real pace", ask("כמה זמן עד היעד?").text.includes("16 שבועות"), ask("כמה זמן עד היעד?").text);
  check("a hello gets a hello", ask("היי").topic === "greeting");
  check("'can't stick to it' is motivation", ask("אני לא מצליח להתמיד").topic === "motivation");
  check("3,000 steps is about 30 minutes, not 2", ask("כמה צעדים עשיתי").text.includes("30 דקות"));
}

// Amounts the way people write them: measures, weights after the food, cooked grains.
{
  const g = (text: string, id: string) => parseEaten(text, "he")?.items.find((i) => i.food.id === id)?.grams;
  check("'3 פרוסות לחם' is three slices", g("3 פרוסות לחם", "bread") === 90, String(g("3 פרוסות לחם", "bread")));
  check("'2 ביצים ופרוסת לחם' reads both", g("2 ביצים ופרוסת לחם", "egg") === 100 && g("2 ביצים ופרוסת לחם", "bread") === 30);
  check("'חזה עוף 200 גרם' — the weight after the food", g("חזה עוף 200 גרם", "chicken") === 200, String(g("חזה עוף 200 גרם", "chicken")));
  check("'2 כוסות חלב' is two cups of milk and nothing else",
    g("2 כוסות חלב", "milk") === 400 && parseEaten("2 כוסות חלב", "he")!.items.length === 1);
  check("'2 כפות טחינה' is two spoons", g("2 כפות טחינה", "tahini") === 40);
  check("'כפית סוכר' is a teaspoon", (g("כפית סוכר", "sugar") ?? 0) <= 5);
  check("rice on a plate is weighed cooked", g("אכלתי אורז", "cookedRice") === 150);
  check("dry rice stays dry when said", g("100 גרם אורז יבש", "rice") === 100);
  check("a slice of pizza is one slice, not 30 g", (g("2 פרוסות פיצה", "pizza") ?? 0) >= 200);
  check("'סקופ חלבון' is a scoop of protein powder", g("סקופ חלבון", "proteinPowder") === 30);
  check("'חומוס' is the spread", parseEaten("חומוס", "he")?.items[0]?.food.id === "hummusSpread");
}

// Word starts, not substrings; and the answers that must be safe.
{
  const topic = (q: string) => coachReply(q, ctx, "he").topic;
  check("'פעמים' is not water", topic("כמה פעמים בשבוע להתאמן") === "plan", topic("כמה פעמים בשבוע להתאמן"));
  check("a crash target is refused with the healthy pace", topic("אני רוצה לרדת 10 קילו בחודש") === "crash"
    && coachReply("אני רוצה לרדת 10 קילו בחודש", ctx, "he").text.includes("חצי עד קילו"));
  check("skipping food is answered with 'eat now'", topic("לא אכלתי כל היום") === "crash");
  check("a teenager gets a safe yes", topic("אני בן 15 אפשר להתאמן") === "youth");
  check("knee pain is a pain answer", topic("כואב לי הברך") === "soreness");
  check("a bad night is a sleep answer", topic("לא ישנתי טוב") === "sleep");
  check("thanks is answered", topic("תודה") === "thanks");
  check("feeling fat gets support, not a diet", topic("אני מרגיש שמן") === "bodyImage");
  check("'how many calories in a banana' looks the food up", topic("כמה קלוריות יש בבננה") === "canEat");
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
