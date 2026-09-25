/**
 * The coach — a chat that answers from the person's own numbers.
 *
 * The app cannot reach Claude once it is installed on a phone (the sampling
 * runtime only exists in the web preview), and a hosted model would cost money
 * per message. So the coach is on the device: it reads the question, works out
 * what it is about, and answers using this person's actual goal, targets and
 * progress. That makes it free, instant, private and available with no signal —
 * and, because it quotes real numbers back, more useful than a generic bot.
 *
 * Pure and fully testable: no clock, no store, no network.
 */

import { FOODS, MEALS, foodNutrition, goalFit, scoreAnything, type Goal } from "@/kitchen";

export type Locale = "he" | "en";

/** Everything the coach is allowed to know about the person. */
export type CoachContext = {
  name?: string;
  goal: Goal;
  kcalTarget?: number;
  kcalEaten?: number;
  proteinTarget?: number;
  proteinEaten?: number;
  /** Water today and its goal, both in ml. */
  waterCups?: number;
  waterGoal?: number;
  steps?: number;
  stepGoal?: number;
  /** kg change of the weekly average against last week. Negative is a loss. */
  weeklyChangeKg?: number | null;
  bodyFat?: number | null;
  planDays?: number;
  trainedToday?: boolean;
  /** Latest weight and the goal weight, for "how long until I get there?". */
  currentKg?: number;
  goalKg?: number;
};

export type CoachTopic =
  | "calories"
  | "protein"
  | "water"
  | "steps"
  | "weight"
  | "plan"
  | "cardio"
  | "kosher"
  | "portions"
  | "soreness"
  | "sleep"
  | "motivation"
  | "supplements"
  | "bodyfat"
  | "start"
  | "greeting"
  | "canEat"
  | "mealIdea"
  | "hunger"
  | "belly"
  | "timeline"
  | "unknown";

export type CoachReply = { topic: CoachTopic; text: string };

/** Words that point at a topic, in both languages. Matched on a folded string. */
const KEYWORDS: Partial<Record<Exclude<CoachTopic, "unknown">, string[]>> = {
  calories: ["קלורי", "קלוריות", "לאכול", "אוכל", "דיאטה", "גירעון", "עודף", "calorie", "eat", "diet", "deficit"],
  protein: ["חלבון", "חלבונים", "protein", "whey", "אבקת"],
  water: ["מים", "שתי", "לשתות", "כוסות", "water", "drink", "hydrat"],
  steps: ["צעד", "צעדים", "הליכה", "ללכת", "step", "walk"],
  weight: ["משקל", "לרדת", "לעלות", "שוקל", "תקוע", "פלטו", "מאזניים", "weight", "lose", "gain", "plateau", "scale"],
  plan: ["תוכנית", "אימון", "אימונים", "תרגיל", "תרגילים", "סטים", "חזרות", "workout", "plan", "exercise", "sets", "reps", "train"],
  cardio: ["אירובי", "ריצה", "הליכון", "אופניים", "cardio", "run", "running", "bike"],
  kosher: ["כשר", "כשרות", "בשרי", "חלבי", "kosher", "vegetarian", "צמחוני", "טבעוני", "גלוטן", "gluten"],
  portions: ["מנה", "מנות", "כמות", "גרם", "לשקול", "portion", "serving", "grams", "how much"],
  soreness: ["כאב", "כאבים", "תפוס", "שרירים כואבים", "פציעה", "sore", "pain", "ache", "injury"],
  sleep: ["שינה", "לישון", "עייף", "sleep", "tired", "rest"],
  motivation: ["מוטיבציה", "אין לי כוח", "לוותר", "קשה לי", "נמאס", "להתמיד", "מתמיד", "עקביות", "נשבר", "motivation", "give up", "hard", "quit", "consistent", "stick to"],
  supplements: ["תוסף", "תוספים", "קריאטין", "ויטמין", "supplement", "creatine", "vitamin"],
  bodyfat: ["אחוז שומן", "שומן", "רזה", "body fat", "fat percent", "lean"],
  start: ["איך מתחילים", "מאיפה", "התחלה", "חדש", "how do i start", "where do i start", "beginner"],
};

/** Lowercased and stripped of punctuation, so matching is forgiving. */
function fold(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Questions that are about something specific enough to answer on their own
 * terms, checked before the keyword vote: "מותר לי פיצה?" is about pizza, not
 * about calories in general, and "מה לאכול בערב" wants dishes, not a number.
 */
const INTENTS: [Exclude<CoachTopic, "unknown">, RegExp][] = [
  ["canEat", /(מותר לי|אפשר לאכול|אפשר לי|זה בסדר לאכול|כדאי לי לאכול|can i (eat|have)|is .+ (ok|okay|bad|healthy))/],
  ["mealIdea", /(מה (כדאי )?(לאכול|להכין|אוכל)|רעיון ל(ארוחה|אוכל)|מה לבשל|ארוחת (ערב|בוקר|צהריים) (מה|רעיון)|what (should|can) i (eat|cook|make)|meal idea|dinner idea)/],
  ["hunger", /(רעב|רעבה|חשק|נשנוש|לנשנש|hungry|craving|snack)/],
  ["belly", /(בטן|כרס|שומן מקומי|קוביות|six ?pack|belly|abs\b|love handles)/],
  ["timeline", /(כמה זמן|מתי אגיע|עד היעד|תוך כמה|how long|when will i)/],
  ["greeting", /^(שלום|היי|הי|אהלן|מה קורה|מה נשמע|בוקר טוב|ערב טוב|hello|hi|hey|yo)[\s!?.]*$/],
];

/** The topic whose words the question hits hardest. */
export function classify(question: string): CoachTopic {
  const raw = question.toLowerCase().trim();
  for (const [topic, re] of INTENTS) if (re.test(raw)) return topic;
  const q = fold(question);
  if (!q) return "unknown";
  let best: CoachTopic = "unknown";
  let bestScore = 0;
  for (const [topic, words] of Object.entries(KEYWORDS) as [Exclude<CoachTopic, "unknown">, string[]][]) {
    let score = 0;
    for (const w of words) {
      if (q.includes(fold(w))) score += w.length >= 5 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  return bestScore > 0 ? best : "unknown";
}

const GOAL_WORD: Record<Goal, { he: string; en: string }> = {
  cut: { he: "חיטוב", en: "a cut" },
  recomp: { he: "מיצוק", en: "a recomp" },
  maintain: { he: "שמירה", en: "maintenance" },
  bulk: { he: "מסה", en: "a bulk" },
};

const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Answers the question, using this person's numbers wherever it can. */
export function coachReply(question: string, ctx: CoachContext, locale: Locale): CoachReply {
  const topic = classify(question);
  const he = locale === "he";
  const goalWord = GOAL_WORD[ctx.goal][locale];

  const lines: string[] = [];
  const say = (h: string, e: string) => lines.push(he ? h : e);

  switch (topic) {
    case "calories": {
      const target = n(ctx.kcalTarget);
      const eaten = n(ctx.kcalEaten);
      if (target !== null && eaten !== null) {
        const left = target - eaten;
        if (left > 0) {
          say(
            `היעד שלך היום הוא ${target} קלוריות ואכלת ${eaten} — נשארו לך ${left}.`,
            `Your target today is ${target} kcal and you've eaten ${eaten} — ${left} left.`,
          );
        } else {
          say(
            `אכלת ${eaten} מתוך יעד של ${target}, כלומר ${Math.abs(left)} מעל. יום אחד לא הורס כלום — תחזור ליעד מחר.`,
            `You've eaten ${eaten} against a ${target} target — ${Math.abs(left)} over. One day changes nothing; get back on target tomorrow.`,
          );
        }
      }
      say(
        `היעד נגזר מהמשקל שלך ומהמטרה (${goalWord}), אז הוא זז כשאתה משנה מטרה.`,
        `The target comes from your weight and your goal (${goalWord}), so it moves when the goal does.`,
      );
      say(
        `הכי חשוב: לרשום כל מה שאכלת. יומן חלקי זה הסיבה מספר אחת שאנשים "לא מבינים למה זה לא זז".`,
        `The one thing that matters: log everything. A half-kept diary is the number-one reason people say "nothing is moving".`,
      );
      break;
    }
    case "protein": {
      const target = n(ctx.proteinTarget);
      const eaten = n(ctx.proteinEaten);
      if (target !== null && eaten !== null) {
        const left = Math.max(0, target - eaten);
        say(
          `חלבון היום: ${eaten} מתוך ${target} גרם${left > 0 ? `, נשארו ${left}` : " — היעד הושלם"}.`,
          `Protein today: ${eaten} of ${target} g${left > 0 ? `, ${left} to go` : " — target met"}.`,
        );
      }
      say(
        `חלבון הוא מה ששומר על השריר כשאתה בגירעון, וגם מה שמשביע הכי הרבה.`,
        `Protein is what protects muscle in a deficit, and it is also the most filling thing you can eat.`,
      );
      say(
        `מקורות זולים ופשוטים: ביצים, טונה, קוטג', יוגורט יווני, חזה עוף, עדשים.`,
        `Cheap, simple sources: eggs, tuna, cottage cheese, Greek yoghurt, chicken breast, lentils.`,
      );
      break;
    }
    case "water": {
      // Both in ml (the tracker's unit); said in litres.
      const drunk = n(ctx.waterCups);
      const goal = n(ctx.waterGoal);
      if (drunk !== null && goal !== null) {
        const l = (ml: number) => String(Math.round(ml / 100) / 10);
        const left = Math.max(0, goal - drunk);
        say(
          `שתית ${l(drunk)} ליטר מתוך ${l(goal)}${left > 0 ? ` — עוד ${l(left)} ליטר והיעד סגור` : " — היעד הושלם 💧"}.`,
          `You've had ${l(drunk)} of ${l(goal)} litres${left > 0 ? ` — ${l(left)} L more and it's done` : " — goal met 💧"}.`,
        );
      }
      say(
        `הטריק שעובד: כוס כשקמים, וכוס לפני כל ארוחה. זה כבר רוב היעד בלי לחשוב על זה.`,
        `The trick that works: a cup on waking and a cup before every meal. That's most of the goal without thinking about it.`,
      );
      break;
    }
    case "steps": {
      const steps = n(ctx.steps);
      const goal = n(ctx.stepGoal);
      if (steps !== null && goal !== null) {
        const left = Math.max(0, goal - steps);
        say(
          `היום צעדת ${steps.toLocaleString()} מתוך ${goal.toLocaleString()}${left > 0 ? ` — חסרים ${left.toLocaleString()}, בערך ${walkMinutes(left)} דקות הליכה` : " — יעד הושלם"}.`,
          `You've walked ${steps.toLocaleString()} of ${goal.toLocaleString()}${left > 0 ? ` — ${left.toLocaleString()} short, roughly ${walkMinutes(left)} minutes of walking` : " — goal met"}.`,
        );
      }
      say(
        `הליכה היא החלק שהחדר כושר לא מכסה, והיא זו שמזיזה את ההוצאה היומית יותר מכל אימון בודד.`,
        `Walking is the half the gym doesn't cover, and it moves your daily burn more than any single session.`,
      );
      break;
    }
    case "weight": {
      const wk = ctx.weeklyChangeKg;
      if (typeof wk === "number") {
        if (wk < -0.1) {
          say(
            `הממוצע השבועי שלך ירד ב־${Math.abs(wk)} ק״ג מהשבוע שעבר. זה בדיוק הקצב שנשאר לאורך זמן.`,
            `Your weekly average is down ${Math.abs(wk)} kg on last week. That is exactly the pace that lasts.`,
          );
        } else if (wk > 0.1) {
          say(
            `הממוצע השבועי עלה ב־${wk} ק״ג. אם המטרה היא ${goalWord} — זה בכיוון; אם לא, כדאי להדק את היומן.`,
            `Your weekly average is up ${wk} kg. If the goal is ${goalWord} that is on track; otherwise tighten the food diary.`,
          );
        } else {
          say(
            `הממוצע השבועי כמעט לא זז. שבוע יציב זה לא תקוע — זה בסיס.`,
            `Your weekly average barely moved. A flat week is not stuck — it's a base.`,
          );
        }
      }
      say(
        `אל תשפוט לפי שקילה בודדת. משקל קופץ 1–2 ק״ג ביום מהמים, המלח והאוכל במעיים — הממוצע השבועי הוא המספר האמיתי.`,
        `Never judge by a single weigh-in. Weight swings 1–2 kg a day on water, salt and food in transit — the weekly average is the real number.`,
      );
      say(
        `אם שבועיים ברצף באמת לא זזים: או שהיומן לא מלא, או שהגיע הזמן להוריד קצת קלוריות או להוסיף צעדים.`,
        `If two straight weeks truly don't move: either the diary is incomplete, or it's time to trim calories a little or add steps.`,
      );
      break;
    }
    case "plan": {
      const days = n(ctx.planDays);
      say(
        `התוכנית שלך בנויה ל${goalWord}${days ? `, ${days} ימים בשבוע` : ""} — המטרה קובעת גם את התרגילים וגם את הסטים והחזרות.`,
        `Your plan is built for ${goalWord}${days ? `, ${days} days a week` : ""} — the goal drives both the exercises and the sets and reps.`,
      );
      say(
        `אתה לא חייב לקבל אותה כמו שהיא: אפשר להסיר תרגיל, להוסיף כל תרגיל מהמאגר ליום מסוים, או לבנות יום מאפס.`,
        `You don't have to take it as-is: remove a move, add any library move to a specific day, or build a day from scratch.`,
      );
      if (ctx.trainedToday === false) {
        say(`היום עוד לא סימנת אימון. גם אימון קצר עדיף על דילוג.`, `You haven't logged a session today. A short one still beats skipping.`);
      }
      say(
        `הכלל שמביא תוצאות: להוסיף בכל שבוע קצת משקל או חזרה אחת על התרגיל המרכזי.`,
        `The rule that brings results: each week add a little weight or one more rep on the main lift.`,
      );
      break;
    }
    case "cardio": {
      say(
        `האירובי באפליקציה נקבע לפי המטרה: ב${goalWord} הוא נראה אחרת מבמטרה אחרת, כולל כמה פעמים בשבוע ואינטרוולים מול סטדי.`,
        `Cardio here is set by your goal: on ${goalWord} it looks different from any other goal — how many times a week, and intervals versus steady.`,
      );
      say(
        `אירובי לא "שורף את השריר". מה ששורף שריר זה גירעון קיצוני בלי חלבון ובלי משקולות.`,
        `Cardio does not "burn muscle". What burns muscle is a savage deficit with no protein and no lifting.`,
      );
      break;
    }
    case "kosher": {
      say(
        `במטבח יש סינון: הכל / כשר / צמחוני / ללא גלוטן. הוא מוריד מנות שלא עומדות בו, וגם כותב לך כמה מנות הוסתרו.`,
        `The kitchen has a filter: all / kosher / vegetarian / gluten-free. It removes dishes that don't qualify and tells you how many it hid.`,
      );
      say(
        `כשר כאן פירושו: בלי מאכלים אסורים, ובלי ערבוב בשר וחלב באותה מנה.`,
        `Kosher here means: no forbidden foods, and no meat and dairy in the same dish.`,
      );
      break;
    }
    case "portions": {
      say(
        `אפשר לראות כל מנה בגרמים או בכמויות בית — יש מתג "גרמים / יחידות" במטבח.`,
        `Every amount can read in grams or in household measures — there's a "grams / units" switch in the kitchen.`,
      );
      say(
        `בלי משקל: כף היד = חלבון · אגרוף = ירקות · חופן = פחמימה · בוהן = שומן.`,
        `With no scale: palm = protein · fist = vegetables · cupped hand = carbs · thumb = fat.`,
      );
      break;
    }
    case "soreness": {
      say(
        `כאב שרירים יום־יומיים אחרי אימון זה נורמלי, במיוחד בהתחלה, והוא נחלש ככל שהגוף מתרגל.`,
        `Being sore a day or two after training is normal, especially early on, and it fades as the body adapts.`,
      );
      say(
        `כאב חד, בתוך מפרק, או כזה שמחמיר תוך כדי — זה לא "כאב אימון". תעצור ותתייעץ עם איש מקצוע.`,
        `Sharp pain, pain inside a joint, or pain that worsens mid-set is not training soreness. Stop and see a professional.`,
      );
      break;
    }
    case "sleep": {
      say(
        `שינה היא החלק שהכי קל להזניח והכי משפיע: פחות משבע שעות מעלה רעב ומוריד ביצועים באימון.`,
        `Sleep is the easiest thing to neglect and the most costly: under seven hours raises hunger and lowers training performance.`,
      );
      break;
    }
    case "motivation": {
      say(
        ctx.name ? `${ctx.name}, מוטיבציה זה דלק שנגמר — מה שנשאר זה ההרגל.` : `מוטיבציה זה דלק שנגמר — מה שנשאר זה ההרגל.`,
        ctx.name ? `${ctx.name}, motivation is fuel that runs out — the habit is what stays.` : `Motivation is fuel that runs out — the habit is what stays.`,
      );
      say(
        `ביום שאין בו כוח, תקטין: אימון של 15 דקות, או רק ההליכה. לא לדלג לגמרי — זה מה ששובר רצפים.`,
        `On a day with nothing in the tank, shrink it: a 15-minute session, or just the walk. Don't skip entirely — that's what breaks streaks.`,
      );
      break;
    }
    case "supplements": {
      say(
        `תוספים הם הקצה של העניין, לא הבסיס. אוכל, חלבון, שינה ועקביות קובעים 95% מהתוצאה.`,
        `Supplements are the edge, not the base. Food, protein, sleep and consistency decide 95% of the result.`,
      );
      say(
        `אני לא נותן המלצות רפואיות. לפני שלוקחים משהו — תתייעץ עם רופא או דיאטן.`,
        `I don't give medical advice. Before taking anything, talk to a doctor or dietitian.`,
      );
      break;
    }
    case "bodyfat": {
      const bf = ctx.bodyFat;
      if (typeof bf === "number") {
        say(
          `ההערכה שלך היא ${bf}% שומן, לפי היקף המותן והגובה. בפינת ההתקדמות רשום גם טווח היעד ל${goalWord}.`,
          `Your estimate is ${bf}% body fat, from waist and height. The progress corner also shows the target band for ${goalWord}.`,
        );
      } else {
        say(
          `כדי לראות אחוז שומן צריך שני דברים בפינת ההתקדמות: לבחור מין, ולמדוד היקף מותן.`,
          `To see a body-fat estimate you need two things in the progress corner: pick a sex, and measure your waist.`,
        );
      }
      say(
        `זו הערכה למעקב אחרי מגמה, לא מדידה מעבדתית. מה שחשוב זה הכיוון לאורך שבועות.`,
        `It's an estimate for tracking a trend, not a lab measurement. What matters is the direction over weeks.`,
      );
      break;
    }
    case "start": {
      say(
        `שלושה דברים, בסדר הזה: 1) לרשום מה אתה אוכל 2) להגיע לאימונים בשבוע 3) ללכת יותר.`,
        `Three things, in this order: 1) log what you eat 2) hit your sessions each week 3) walk more.`,
      );
      say(
        `אל תשנה הכול ביום אחד. תבחר דבר אחד לשבוע הקרוב ותעשה אותו טוב.`,
        `Don't change everything at once. Pick one thing for this week and do it properly.`,
      );
      break;
    }
    case "greeting": {
      say(
        `היי${ctx.name ? ` ${ctx.name}` : ""}! אני המאמן שלך — עונה לפי המספרים שלך, על המכשיר, בלי אינטרנט.`,
        `Hi${ctx.name ? ` ${ctx.name}` : ""}! I'm your coach — I answer from your own numbers, on the device, no internet needed.`,
      );
      say(
        `נסה לשאול: "כמה קלוריות נשארו לי?", "מותר לי פיצה?", "מה לאכול בערב?" — או פשוט לכתוב "אכלתי 2 ביצים" ואני ארשום ליומן.`,
        `Try: "How many calories do I have left?", "Can I eat pizza?", "What should I eat tonight?" — or just write "I ate 2 eggs" and I'll log it.`,
      );
      break;
    }
    case "canEat": {
      const food = question
        .replace(/(מותר לי|אפשר לאכול|אפשר לי|זה בסדר לאכול|כדאי לי לאכול|can i eat|can i have|is it ok to eat)/gi, "")
        .replace(/[?!.]/g, "")
        .trim();
      const { score, food: known } = scoreAnything(food || question);
      const band = he
        ? { great: "מעולה", good: "טוב", ok: "בסדר", sometimes: "לפעמים", rarely: "לעיתים רחוקות" }[score.band]
        : { great: "great", good: "good", ok: "fine", sometimes: "sometimes", rarely: "rarely" }[score.band];
      say(
        `${food || (he ? "זה" : "That")}: ${score.value}/10 — ${band}. אין מאכל אסור; השאלה היא כמה ובאיזו תדירות.`,
        `${food || "That"}: ${score.value}/10 — ${band}. Nothing is forbidden; the question is how much and how often.`,
      );
      const left = n(ctx.kcalTarget) !== null && n(ctx.kcalEaten) !== null ? n(ctx.kcalTarget)! - n(ctx.kcalEaten)! : null;
      if (known && left !== null) {
        const kcal = portionKcal(known.id);
        if (kcal !== null) {
          say(
            left >= kcal
              ? `מנה רגילה היא בערך ${kcal} קלוריות, ונשארו לך היום ${left} — נכנס בתקציב.`
              : `מנה רגילה היא בערך ${kcal} קלוריות, ונשארו לך היום ${Math.max(0, left)} — אם בא לך, קח חצי מנה או תאזן מחר.`,
            left >= kcal
              ? `A normal portion is about ${kcal} kcal and you have ${left} left today — it fits.`
              : `A normal portion is about ${kcal} kcal and you have ${Math.max(0, left)} left — have half, or balance it tomorrow.`,
          );
        }
      }
      say(
        `את הציון המלא, עם הסיבות, תמצא ב"בא לי לאכול" בלשונית המטבח.`,
        `The full score, with the reasons, is under "I feel like eating" on the Kitchen tab.`,
      );
      break;
    }
    case "mealIdea": {
      const q = question.toLowerCase();
      const slot = /(בוקר|breakfast)/.test(q) ? "breakfast" : /(צהריים|lunch)/.test(q) ? "lunch" : /(ערב|dinner|supper)/.test(q) ? "dinner" : /(נשנוש|snack)/.test(q) ? "snack" : null;
      const left = n(ctx.kcalTarget) !== null && n(ctx.kcalEaten) !== null ? n(ctx.kcalTarget)! - n(ctx.kcalEaten)! : null;
      const picks = MEALS
        .filter((m) => (!slot || m.slot === slot) && (left === null || left <= 0 || m.kcal <= left))
        .sort((a, b) => goalFit(b, ctx.goal) - goalFit(a, ctx.goal))
        .slice(0, 3);
      if (picks.length) {
        say(
          `${left !== null && left > 0 ? `נשארו לך ${left} קלוריות. ` : ""}שלושה רעיונות שמתאימים ל${goalWord}:`,
          `${left !== null && left > 0 ? `You have ${left} kcal left. ` : ""}Three ideas that suit ${goalWord}:`,
        );
        lines.push(picks.map((m) => `• ${he ? m.he.title : m.en.title} — ${m.kcal} ${he ? "קלוריות" : "kcal"}, ${m.protein}${he ? "ג' חלבון" : "g protein"}`).join("\n"));
      }
      say(
        `כתוב בלשונית המטבח מה יש לך במקרר, ואבנה לך מנה בדיוק ממה שיש.`,
        `Write what's in your fridge on the Kitchen tab and I'll build a plate from exactly that.`,
      );
      break;
    }
    case "hunger": {
      say(
        `רעב בגירעון זה נורמלי — הנה מה שעובד: חלבון בכל ארוחה, הרבה ירקות (נפח בלי קלוריות), וכוס מים לפני שמחליטים.`,
        `Hunger in a deficit is normal — what works: protein at every meal, lots of vegetables (volume without calories), and a glass of water before deciding.`,
      );
      const snacks = MEALS.filter((m) => m.slot === "snack" && m.notes.includes("protein")).slice(0, 3);
      if (snacks.length) {
        lines.push(snacks.map((m) => `• ${he ? m.he.title : m.en.title} — ${m.kcal} ${he ? "קלוריות" : "kcal"}`).join("\n"));
      }
      say(
        `ואם זה קורה כל ערב — כנראה שהארוחות מוקדם ביום קטנות מדי. תזיז קלוריות מהערב לצהריים.`,
        `And if it happens every evening, the earlier meals are probably too small — move calories from the evening to lunch.`,
      );
      break;
    }
    case "belly": {
      say(
        `אי אפשר להוריד שומן ממקום אחד — גם לא עם אלף כפיפות בטן. הגוף מוריד שומן מכל הגוף, והבטן היא לרוב האחרונה.`,
        `You can't lose fat from one spot — not even with a thousand crunches. The body loses fat everywhere, and the belly is usually last.`,
      );
      say(
        `מה כן עובד: גירעון קלורי קבוע, חלבון גבוה, אימוני כוח 3 פעמים בשבוע, וצעדים. תרגילי בטן מחזקים — הם פשוט לא שורפים את השומן שעליה.`,
        `What does work: a steady calorie deficit, high protein, strength training 3 times a week, and steps. Ab exercises build the muscle — they just don't burn the fat on top of it.`,
      );
      break;
    }
    case "timeline": {
      const now = ctx.currentKg;
      const goal = ctx.goalKg;
      const rate = ctx.weeklyChangeKg;
      if (now && goal && Math.abs(now - goal) >= 0.3) {
        const toGo = Math.round(Math.abs(now - goal) * 10) / 10;
        const rightWay = rate != null && rate !== 0 && Math.sign(goal - now) === Math.sign(rate);
        if (rightWay) {
          const weeks = Math.ceil(toGo / Math.abs(rate!));
          say(
            `נשארו ${toGo} ק״ג עד ${goal}. בקצב של השבוע האחרון (${Math.abs(rate!)} ק״ג בשבוע) — בערך ${weeks} שבועות.`,
            `${toGo} kg to go to ${goal}. At last week's pace (${Math.abs(rate!)} kg a week) — about ${weeks} weeks.`,
          );
        } else {
          say(
            `נשארו ${toGo} ק״ג עד ${goal}. בקצב בריא של חצי ק״ג בשבוע זה בערך ${Math.ceil(toGo / 0.5)} שבועות — תשקול פעם בשבוע ואחשב לפי הקצב האמיתי שלך.`,
            `${toGo} kg to go to ${goal}. At a healthy half a kilo a week that's about ${Math.ceil(toGo / 0.5)} weeks — weigh in weekly and I'll work it out from your real pace.`,
          );
        }
      } else if (now && goal) {
        say(`אתה כבר על היעד. עכשיו המטרה היא לשמור.`, `You're at your goal. Now the aim is to hold it.`);
      } else {
        say(
          `כדי לחשב אני צריך משקל נוכחי ויעד — אפשר להזין אותם בפרופיל ובלשונית ההתקדמות.`,
          `To work it out I need your current weight and a goal — set them on Profile and the Progress tab.`,
        );
      }
      break;
    }
    default: {
      say(
        `לא בטוח שהבנתי. אני יכול לעזור עם: קלוריות, חלבון, מים, צעדים, משקל, תוכנית האימון, אירובי, כשרות, מנות, כאבי שרירים ומוטיבציה.`,
        `I'm not sure I follow. I can help with: calories, protein, water, steps, weight, your training plan, cardio, kosher, portions, soreness and motivation.`,
      );
      break;
    }
  }

  return { topic, text: lines.join("\n\n") };
}

/** About a hundred steps a minute at an ordinary walking pace. */
function walkMinutes(steps: number): number {
  return Math.max(1, Math.round(steps / 100));
}

/** Calories in one standard portion of a food, from the kitchen's table. */
function portionKcal(foodId: string): number | null {
  const food = FOODS.find((f) => f.id === foodId);
  return food ? foodNutrition(food).kcal : null;
}

/** Openers offered as taps, so the chat is never a blank box. */
export function suggestedQuestions(locale: Locale): string[] {
  return locale === "he"
    ? [
        "כמה קלוריות נשארו לי היום?",
        "כמה חלבון אני צריך?",
        "למה המשקל תקוע?",
        "מה התוכנית שלי אומרת?",
        "כמה מים שתיתי?",
        "אכלתי 2 ביצים ופרוסת לחם",
      ]
    : [
        "How many calories do I have left?",
        "How much protein do I need?",
        "Why is my weight stuck?",
        "What does my plan say?",
        "How much water have I had?",
        "I ate 2 eggs and a slice of bread",
      ];
}
