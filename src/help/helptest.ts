import { HELP_STARTERS, HELP_TOPICS, answerHelp, fold, isAppQuestion, topicById } from "./index";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const top = (q: string) => {
  const a = answerHelp(q);
  return a.kind === "answer" ? a.topic.id : a.kind === "choose" ? `choose:${a.options.map((o) => o.id).join(",")}` : "none";
};

// Real questions, the way people type them.
const cases: [string, string][] = [
  ["איך מוסיפים כוס מים?", "water-log"],
  ["איך משנים את יעד המים", "water-goal"],
  ["איפה רושמים משקל", "weigh-in"],
  ["איך אני שוקל את עצמי באפליקציה? איפה השקילה", "weigh-in"],
  ["איך מצלמים ארוחה", "photo-scan"],
  ["איך רושמים ארוחה", "meal-log"],
  ["אכלתי פיצה איפה לרשום", "meal-log"],
  ["איפה המחשבון קלוריות", "calc"],
  ["איך מוסיפים הרגל חדש", "habit-add"],
  ["איך מוחקים הרגל", "habit-edit"],
  ["שכחתי סיסמה", "account"],
  ["איך מתחברים לחשבון", "account"],
  ["עברתי לטלפון חדש", "account"],
  ["איך מפעילים תזכורות", "reminders"],
  ["איך משנים שפה לאנגלית", "language"],
  ["כמה עולה המנוי", "subscription"],
  ["איפה ההישגים שלי", "achievements"],
  ["איך בונים תוכנית אימון", "workout-plan"],
  ["איך מוסיפים תרגיל משלי", "library"],
  ["סינון כשר", "diet"],
  ["רשימת קניות", "shopping"],
  ["לא רואה את העדכון החדש", "update"],
  ["איך מייצאים את הנתונים", "export"],
  ["how do I log water", "water-log"],
  ["where do I log my weight", "weigh-in"],
  ["forgot password", "account"],
  // typos and prefixes
  ["איך מוסיפים הרגלל", "habit-add"],
  ["איפה משנים שפה", "language"],
  ["איפה זה בפרופיל", "profile-edit"],
  ["תזכורוט", "reminders"],
];
for (const [q, want] of cases) {
  const got = top(q);
  check(`"${q}" → ${want}`, got === want, got);
}

check("nonsense finds nothing", top("קשקוש בלבל זזז") === "none", top("קשקוש בלבל זזז"));
check("an empty question finds nothing", top("   ") === "none");

// Every topic is reachable by its own title.
for (const t of HELP_TOPICS) {
  const a = answerHelp(t.he.title);
  const hit = a.kind === "answer" ? a.topic.id === t.id : a.kind === "choose" && a.options.some((o) => o.id === t.id);
  check(`topic "${t.id}" is found by its Hebrew title`, hit, top(t.he.title));
}

check("ids are unique", new Set(HELP_TOPICS.map((t) => t.id)).size === HELP_TOPICS.length);
check("every starter exists", HELP_STARTERS.every((id) => !!topicById(id)));
check("every answer has both languages", HELP_TOPICS.every((t) => t.he.answer && t.en.answer && t.he.title && t.en.title));
const ROUTES = new Set(["/", "/water", "/kitchen", "/calc", "/progress", "/workout", "/library", "/habit/new", "/checkin", "/profile", "/paywall", "/achievements", "/rewards", "/coach"]);
check("every route is a real screen", HELP_TOPICS.every((t) => !t.route || ROUTES.has(t.route)),
  HELP_TOPICS.filter((t) => t.route && !ROUTES.has(t.route)).map((t) => t.id).join(","));

check("final letters fold", fold("מים") === fold("מימ"));

// The coach hands app questions to the guide, and keeps its own.
check("\"איפה רושמים משקל\" is an app question", isAppQuestion("איפה רושמים משקל"));
check("\"how do I log water\" is an app question", isAppQuestion("how do I log water"));
check("\"כמה חלבון אני צריך\" is not", !isAppQuestion("כמה חלבון אני צריך"));
check("\"למה המשקל תקוע\" is not", !isAppQuestion("למה המשקל תקוע"));

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
