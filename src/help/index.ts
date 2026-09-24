/**
 * The app guide: our own assistant for finding your way around APEX.
 *
 * It runs entirely on the device — no model, no key, no network, no cost — so
 * it answers instantly, offline, for everyone, and it is never counted against
 * a plan's limits: help using the app is not a premium feature.
 *
 * It is a small retrieval engine over a hand-written guide. A question is
 * folded (case, punctuation, Hebrew final letters), each word is also read
 * without its Hebrew prefix letters (ו/ה/ב/ל/מ/ש/כ — "בפרופיל" is "פרופיל"),
 * and words match a topic exactly, by prefix, or with one typo. The best topic
 * answers, with a button that opens the screen it talks about. When two topics
 * are close, it offers both rather than guessing.
 *
 * Pure: no React, no store. `npm run test:help` covers it.
 */

export type HelpLocale = "he" | "en";

export type HelpTopic = {
  id: string;
  /** The screen the answer's button opens, when there is one. */
  route?: string;
  /** Words and phrases that point here, in both languages. */
  keys: string[];
  he: { title: string; answer: string };
  en: { title: string; answer: string };
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "water-log",
    route: "/water",
    keys: ["מים", "לשתות", "שתיתי", "כוס", "כוסות", "בקבוק", "water", "drink", "cup", "bottle"],
    he: {
      title: "רישום מים",
      answer: "בלשונית \"מים\" לוחצים על הבקבוק או על \"+\" כדי להוסיף כוס. גודל הכוס נבחר בכרטיס העליון (למשל 250 מ״ל), וטעות מתקנים עם \"−\".",
    },
    en: {
      title: "Logging water",
      answer: "On the Water tab, tap the bottle or \"+\" to add a cup. Pick the cup size on the top card (e.g. 250 ml); fix a mistake with \"−\".",
    },
  },
  {
    id: "water-goal",
    route: "/water",
    keys: ["יעד מים", "כמה מים", "מטרת מים", "water goal", "how much water"],
    he: {
      title: "יעד המים",
      answer: "בלשונית \"מים\" לוחצים על \"שנה יעד\". האפליקציה ממליצה על יעד לפי המשקל שלך, ואפשר לשנות אותו.",
    },
    en: {
      title: "Water goal",
      answer: "On the Water tab, tap \"Change goal\". The app suggests one from your weight; you can set your own.",
    },
  },
  {
    id: "meal-log",
    route: "/kitchen",
    keys: ["לרשום ארוחה", "רישום ארוחה", "רושם", "רישום", "אכלתי", "ארוחה", "קלוריות", "יומן", "log meal", "meal", "ate", "calories", "diary"],
    he: {
      title: "רישום ארוחה",
      answer: "בלשונית \"מטבח\", בכרטיס \"רשום משהו שאכלת\", מחפשים את המאכל, לוחצים עליו ובוחרים כמה (חצי, מנה, מנה וחצי, 2 — או מקלידים גרמים), ואז \"רשום ביומן\". אפשר גם ללחוץ \"אכלתי את זה\" על מנה מוצעת, או לכתוב למאמן \"אכלתי 2 ביצים ופרוסת לחם\".",
    },
    en: {
      title: "Logging a meal",
      answer: "On the Kitchen tab, in \"Log something you ate\", search the food, tap it and choose how much (half, one, one and a half, two — or type grams), then \"Add to today\". You can also tap \"I ate this\" on a suggested dish, or tell the coach \"I ate 2 eggs and a slice of bread\".",
    },
  },
  {
    id: "calc",
    route: "/calc",
    keys: ["מחשבון", "מחשבון קלוריות", "לחשב", "גרמים", "כמה קלוריות יש", "calculator", "calculate", "grams", "how many calories in"],
    he: {
      title: "מחשבון הקלוריות",
      answer: "במחשבון מחפשים מאכל, מוסיפים לצלחת ומשנים את המשקל בגרמים — הקלוריות, החלבון, הפחמימות והשומן מתעדכנים. \"רשום ליומן\" שומר הכול. מאכל שלא נמצא אפשר לחפש במאגר Open Food Facts.",
    },
    en: {
      title: "Calorie calculator",
      answer: "Search a food, add it to the plate and set the grams — calories, protein, carbs and fat update. \"Log it\" saves it. A food the app lacks can be searched on Open Food Facts.",
    },
  },
  {
    id: "photo-scan",
    route: "/kitchen",
    keys: ["תמונה של אוכל", "קלוריות מתמונה", "ארוחה", "לצלם", "מצלם", "צילום", "צילום ארוחה", "תמונה", "סריקה", "מצלמה", "photo", "scan", "camera", "picture of food"],
    he: {
      title: "ספירת קלוריות מתמונה",
      answer: "בלשונית \"מטבח\", בכרטיס \"צלם ארוחה\", מצלמים את הצלחת. המאכלים שזוהו נפתחים במחשבון עם ערכים אמיתיים, ושם אפשר לתקן משקל לפני שרושמים.",
    },
    en: {
      title: "Calories from a photo",
      answer: "On the Kitchen tab, in the meal photo card, take a picture of the plate. What it recognises opens in the calculator with real values, where you can fix the weights before logging.",
    },
  },
  {
    id: "eat-score",
    route: "/kitchen",
    keys: ["מותר לי לאכול", "אפשר לאכול", "ציון", "כדאי לאכול", "can i eat", "should i eat", "score"],
    he: {
      title: "\"אפשר לאכול את זה?\"",
      answer: "בלשונית \"מטבח\" יש כרטיס שבו כותבים כל מאכל ומקבלים ציון מ־10 לפי המטרה שלך, עם הסבר קצר.",
    },
    en: {
      title: "\"Can I eat this?\"",
      answer: "The Kitchen tab has a card where you type any food and get a score out of ten for your goal, with a short reason.",
    },
  },
  {
    id: "diet",
    route: "/kitchen",
    keys: ["כשר", "כשרות", "צמחוני", "טבעוני", "גלוטן", "תזונה", "kosher", "vegetarian", "vegan", "gluten"],
    he: {
      title: "כשר / צמחוני / ללא גלוטן",
      answer: "בלשונית \"מטבח\" פותחים את ההגדרות ומסמנים כשר, צמחוני או ללא גלוטן — אפשר כמה יחד. כל ההצעות והמנה שלך יסוננו לפיהם, ו\"בא לי לאכול\" יזהיר כשמאכל לא מתאים. \"הכל\" מבטל את הסינון.",
    },
    en: {
      title: "Kosher / vegetarian / gluten-free",
      answer: "On the Kitchen tab, open the settings and switch on kosher, vegetarian or gluten-free — any combination. Every suggestion and your plate follow them, and \"I feel like eating\" warns when a food doesn't fit. \"All\" clears them.",
    },
  },
  {
    id: "units",
    route: "/kitchen",
    keys: ["גרם", "יחידות", "כמויות", "משקל מנה", "כפות", "כוס", "units", "grams", "amounts", "portion size"],
    he: {
      title: "גרמים או יחידות",
      answer: "בכל מנה במטבח, ליד \"מה צריך\", יש כפתור \"הצג בגרמים\" / \"הצג ביחידות\". כל מצרך מראה את הכמות ואת הקלוריות שלו, והסכום למטה הוא בדיוק הסכום של השורות.",
    },
    en: {
      title: "Grams or household units",
      answer: "On every dish in the kitchen, beside \"What you need\", tap \"Show grams\" / \"Show household units\". Each ingredient shows its amount and its calories, and the total is exactly their sum.",
    },
  },
  {
    id: "shopping",
    route: "/kitchen",
    keys: ["קניות", "רשימת קניות", "מה לקנות", "מקרר", "מה יש לי", "shopping", "groceries", "fridge", "pantry"],
    he: {
      title: "מה יש במקרר ורשימת קניות",
      answer: "בלשונית \"מטבח\" כותבים מה יש לך בבית, והאפליקציה מציעה ארוחות שאפשר להכין עכשיו. \"כמעט\" מראה מה חסר, ורשימת הקניות מסדרת את החוסרים לפי כמה ארוחות כל אחד פותח.",
    },
    en: {
      title: "Your fridge and shopping list",
      answer: "On the Kitchen tab, list what you have and the app suggests meals you can make now. \"Almost\" shows what's missing, and the shopping list ranks it by how many meals each item unlocks.",
    },
  },
  {
    id: "nutrition-goal",
    route: "/kitchen",
    keys: ["חיטוב", "מסה", "מיצוק", "שמירה", "יעד קלורי", "לרדת במשקל", "cut", "bulk", "recomp", "maintain", "calorie target"],
    he: {
      title: "מטרה: חיטוב / מסה / שמירה",
      answer: "בלשונית \"מטבח\", בהגדרות, בוחרים מטרה. יעד הקלוריות והחלבון היומי מחושב לפיה ולפי המשקל האחרון שלך, והארוחות מדורגות לפי ההתאמה אליה.",
    },
    en: {
      title: "Goal: cut / bulk / maintain",
      answer: "On the Kitchen tab, in settings, choose a goal. Your daily calorie and protein targets follow it and your latest weight, and meals are ranked by how well they fit.",
    },
  },
  {
    id: "weigh-in",
    route: "/progress",
    keys: ["שקילה", "משקל", "להישקל", "לרשום משקל", "קילו", "weigh", "weight", "scale", "kg"],
    he: {
      title: "רישום משקל",
      answer: "בלשונית \"התקדמות\" כותבים את המשקל בכרטיס השקילה ולוחצים שמור. הגרף והממוצע השבועי מתעדכנים — עדיף להסתכל על הממוצע ולא על יום בודד.",
    },
    en: {
      title: "Logging your weight",
      answer: "On the Progress tab, enter your weight in the weigh-in card and save. The chart and weekly average update — watch the average, not a single day.",
    },
  },
  {
    id: "body",
    route: "/progress",
    keys: ["היקפים", "מותניים", "אחוז שומן", "מדידות", "סנטימטר", "measurements", "waist", "body fat", "cm"],
    he: {
      title: "היקפים ואחוז שומן",
      answer: "בלשונית \"התקדמות\" מוסיפים היקפים (מותניים ועוד). מהמותניים, הגובה והמין מחושב אחוז שומן משוער.",
    },
    en: {
      title: "Measurements and body fat",
      answer: "On the Progress tab, add measurements (waist and more). Your waist, height and sex give an estimated body-fat percentage.",
    },
  },
  {
    id: "progress-photos",
    route: "/progress",
    keys: ["תמונות התקדמות", "תמונת גוף", "לפני ואחרי", "progress photos", "before and after"],
    he: {
      title: "תמונות התקדמות",
      answer: "בלשונית \"התקדמות\", בכרטיס התמונות, מצלמים או בוחרים תמונה. התמונות נשמרות רק בטלפון, ואפשר להשוות לפני ואחרי.",
    },
    en: {
      title: "Progress photos",
      answer: "On the Progress tab, in the photos card, take or pick a photo. They stay on your phone only, and you can compare before and after.",
    },
  },
  {
    id: "steps",
    route: "/progress",
    keys: ["צעדים", "צעד", "הליכה", "פדומטר", "steps", "walking", "pedometer"],
    he: {
      title: "צעדים",
      answer: "הצעדים נספרים אוטומטית מהחיישן של הטלפון (צריך לאשר הרשאת פעילות). הם מופיעים בלשונית \"התקדמות\" ובמסך \"היום\".",
    },
    en: {
      title: "Steps",
      answer: "Steps are counted automatically by the phone's sensor (allow the activity permission). You'll see them on Progress and Today.",
    },
  },
  {
    id: "workout-plan",
    route: "/workout",
    keys: ["תוכנית אימון", "תוכנית", "ימים בשבוע", "ציוד", "חדר כושר", "בבית", "מתחיל", "מתקדם", "קשה מדי", "קל מדי", "קשים מדי", "קלים מדי", "beginner", "advanced", "too hard", "too easy", "workout plan", "plan", "days a week", "equipment", "gym", "home"],
    he: {
      title: "תוכנית האימונים",
      answer: "בלשונית \"אימון\" בוחרים רמה (מתחיל, בינוני או מתקדם), מטרה, כמה ימים בשבוע וציוד — והתוכנית נבנית לבד: למתחילים תרגילים פשוטים ובטוחים, למתקדמים תרגילים כבדים וקשים. התרגילים קשים או קלים מדי? \"שנה תוכנית\" ובחר רמה אחרת.",
    },
    en: {
      title: "Your workout plan",
      answer: "On the Workout tab, choose your level (beginner, intermediate or advanced), goal, days per week and equipment — the plan builds itself: simple, safe moves for beginners, heavy and demanding ones for advanced. Too hard or too easy? Tap \"Change plan\" and pick another level.",
    },
  },
  {
    id: "sets",
    route: "/workout",
    keys: ["סטים", "חזרות", "משקולות", "לסמן סט", "לרשום אימון", "sets", "reps", "log workout", "weights"],
    he: {
      title: "רישום סטים",
      answer: "בלשונית \"אימון\" כותבים ק״ג וחזרות לכל סט ומסמנים ✓. בסוף לוחצים \"סיים אימון\". בפעם הבאה יופיעו המשקלים מהאימון הקודם.",
    },
    en: {
      title: "Logging sets",
      answer: "On the Workout tab, enter kg and reps for each set and tick ✓. Tap \"Finish\" at the end. Next time, your last weights are filled in.",
    },
  },
  {
    id: "library",
    route: "/library",
    keys: ["תרגיל", "תרגילים", "ספריית תרגילים", "להוסיף תרגיל", "תרגיל משלי", "exercise", "exercises", "library", "add exercise"],
    he: {
      title: "ספריית התרגילים",
      answer: "בספריית התרגילים מחפשים לפי שם, שריר או ציוד, ומוסיפים תרגיל לאימון של היום. תרגיל שלא קיים אפשר להוסיף בעצמך.",
    },
    en: {
      title: "Exercise library",
      answer: "Search the library by name, muscle or equipment and add an exercise to today's workout. Missing one? Add your own.",
    },
  },
  {
    id: "cardio",
    route: "/workout",
    keys: ["אירובי", "ריצה", "הליכון", "אופניים", "cardio", "running", "treadmill", "bike"],
    he: {
      title: "אירובי",
      answer: "בלשונית \"אימון\" יש כרטיס אירובי עם דקות וכמה פעמים בשבוע, בהתאם למטרה שלך.",
    },
    en: {
      title: "Cardio",
      answer: "The Workout tab has a cardio card with minutes and sessions per week for your goal.",
    },
  },
  {
    id: "habit-add",
    route: "/habit/new",
    keys: ["הרגל", "משימה", "להוסיף הרגל", "הרגל חדש", "מוסיפ", "הוספת", "habit", "habits", "task", "new habit"],
    he: {
      title: "הוספת הרגל",
      answer: "במסך \"היום\" לוחצים \"הוסף\" (או בכפתור למטה), כותבים הרגל אחד קטן ובוחרים מתי ביום. מסמנים אותו כל יום כשעשית.",
    },
    en: {
      title: "Adding a habit",
      answer: "On Today, tap Add, write one small habit and pick a time of day. Tick it each day you do it.",
    },
  },
  {
    id: "habit-edit",
    route: "/",
    keys: ["הרגל", "למחוק הרגל", "להסיר הרגל", "לשנות הרגל", "לערוך הרגל", "מוחק", "מחיקת", "עריכה", "הסרה", "להסיר", "לערוך", "delete habit", "remove habit", "edit habit"],
    he: {
      title: "עריכה או הסרה של הרגל",
      answer: "במסך \"היום\" לוחצים על ההרגל עצמו — נפתח מסך שבו משנים את השם או השעה, או לוחצים \"הסר הרגל\". ההיסטוריה נשמרת.",
    },
    en: {
      title: "Editing or removing a habit",
      answer: "On Today, tap the habit itself — you can rename it, change its time, or tap Remove. Its history is kept.",
    },
  },
  {
    id: "checkin",
    route: "/checkin",
    keys: ["סיכום", "סיכום יום", "מצב רוח", "איך היה היום", "checkin", "check in", "recap", "mood"],
    he: {
      title: "סיכום היום",
      answer: "בלשונית \"סיכום\" בוחרים איך היה היום וכותבים מילה אם רוצים. האפליקציה מציעה התאמה קטנה למחר לפי מה שהיה.",
    },
    en: {
      title: "Daily recap",
      answer: "On the Recap tab, pick how the day went and add a note if you like. The app suggests one small adjustment for tomorrow.",
    },
  },
  {
    id: "reminders",
    route: "/profile",
    keys: ["תזכורת", "תזכורות", "התראה", "התראות", "notification", "notifications", "reminder", "reminders"],
    he: {
      title: "תזכורות",
      answer: "בלשונית \"פרופיל\", בכרטיס \"תזכורות\", מפעילים או מכבים. אם ביטלת הרשאה בטלפון, צריך להחזיר אותה בהגדרות הטלפון.",
    },
    en: {
      title: "Reminders",
      answer: "On the Profile tab, in Reminders, turn them on or off. If you denied the permission, re-allow it in the phone's settings.",
    },
  },
  {
    id: "profile-edit",
    route: "/profile",
    keys: ["שם", "גובה", "יעד משקל", "לשנות יעד", "פרופיל", "name", "height", "goal weight", "profile"],
    he: {
      title: "שם, גובה ויעד משקל",
      answer: "בלשונית \"פרופיל\" משנים שם, גובה ויעד משקל, ולוחצים \"שמור\". היעד משפיע על כל האפליקציה.",
    },
    en: {
      title: "Name, height and goal weight",
      answer: "On the Profile tab, change your name, height and goal weight, then Save. The goal flows through the whole app.",
    },
  },
  {
    id: "language",
    route: "/profile",
    keys: ["שפה", "אנגלית", "עברית", "language", "english", "hebrew"],
    he: { title: "שפה", answer: "בלשונית \"פרופיל\", בכרטיס \"שפה\", בוחרים עברית או English." },
    en: { title: "Language", answer: "On the Profile tab, in Language, choose עברית or English." },
  },
  {
    id: "account",
    route: "/profile",
    keys: ["חשבון", "להתחבר", "מתחבר", "התחבר", "התחברות", "הרשמה", "סיסמה", "שכחתי סיסמה", "גיבוי", "ענן", "טלפון חדש", "account", "sign in", "login", "password", "forgot", "backup", "cloud", "new phone"],
    he: {
      title: "חשבון, סיסמה וגיבוי",
      answer: "בלשונית \"פרופיל\", בכרטיס \"גיבוי בענן\", נרשמים או מתחברים עם אימייל. הנתונים מסתנכרנים, כך שבטלפון חדש פשוט מתחברים. שכחת סיסמה? \"שכחתי סיסמה\" שולח קישור לאימייל.",
    },
    en: {
      title: "Account, password and backup",
      answer: "On the Profile tab, in Cloud backup, sign up or sign in with email. Your data syncs, so on a new phone you just sign in. Forgot it? \"Forgot password\" emails a link.",
    },
  },
  {
    id: "export",
    route: "/profile",
    keys: ["לייצא", "מייצא", "ייצוא", "להוריד נתונים", "הנתונים שלי", "export", "download my data", "my data"],
    he: { title: "ייצוא הנתונים", answer: "בלשונית \"פרופיל\", למטה, \"ייצוא הנתונים\" יוצר קובץ עם כל מה שהאפליקציה שומרת עליך." },
    en: { title: "Exporting your data", answer: "At the bottom of Profile, Export creates a file with everything the app keeps about you." },
  },
  {
    id: "delete",
    route: "/profile",
    keys: ["למחוק", "מחיקה", "למחוק חשבון", "להתחיל מחדש", "איפוס", "delete", "delete account", "reset", "start over"],
    he: {
      title: "מחיקה והתחלה מחדש",
      answer: "בלשונית \"פרופיל\", למטה, \"מחיקת כל הנתונים\" מוחקת הכול מהטלפון, ומהענן אם יש חשבון. אין דרך לשחזר — כדאי לייצא לפני.",
    },
    en: {
      title: "Delete and start over",
      answer: "At the bottom of Profile, \"Delete all data\" wipes the phone, and the cloud if you have an account. It can't be undone — export first.",
    },
  },
  {
    id: "privacy",
    route: "/profile",
    keys: ["פרטיות", "הסכמה", "בינה מלאכותית", "תנאי שימוש", "privacy", "consent", "ai", "terms"],
    he: {
      title: "פרטיות והסכמות",
      answer: "בלשונית \"פרופיל\", בכרטיס ההסכמות, מדליקים או מכבים גיבוי בענן, AI ותמונות. מדיניות הפרטיות ותנאי השימוש נמצאים שם.",
    },
    en: {
      title: "Privacy and consent",
      answer: "On Profile, in the consent card, switch cloud backup, AI and photos on or off. The privacy policy and terms are there too.",
    },
  },
  {
    id: "subscription",
    route: "/paywall",
    keys: ["מנוי", "פרימיום", "לשלם", "מחיר", "כמה עולה", "תשלום", "ניסיון", "subscription", "premium", "pro", "price", "pay", "trial"],
    he: {
      title: "המנוי",
      answer: "במסך המנוי רואים מה כלול, את המחיר ואת ימי הניסיון. חלק מהדברים (כמו הודעות למאמן וסריקת תמונות) מוגבלים ביום בגרסה החינמית.",
    },
    en: {
      title: "Subscription",
      answer: "The plans screen shows what's included, the price and the trial. Some things (coach messages, photo scans) have a daily limit on the free plan.",
    },
  },
  {
    id: "achievements",
    route: "/achievements",
    keys: ["הישגים", "תגים", "מדליות", "achievements", "badges"],
    he: { title: "הישגים", answer: "במסך ההישגים רואים את כל התגים — אלה שכבר פתחת ומה חסר כדי לפתוח את הבא." },
    en: { title: "Achievements", answer: "The achievements screen shows every badge — the ones you've earned and what the next one needs." },
  },
  {
    id: "rewards",
    route: "/rewards",
    keys: ["נקודות", "רמה", "תגמולים", "בונוס", "points", "level", "rewards", "bonus"],
    he: { title: "נקודות ורמות", answer: "כל הרגל שסימנת שווה נקודות, והקשים שווים יותר. במסך התגמולים רואים את הרמה, השבוע ומה עוד חסר לרמה הבאה." },
    en: { title: "Points and levels", answer: "Every habit you tick earns points, harder ones more. The rewards screen shows your level, the week and what the next level needs." },
  },
  {
    id: "coach",
    route: "/coach",
    keys: ["מאמן", "לשאול", "צ׳אט", "צאט", "יועץ", "coach", "chat", "ask"],
    he: { title: "המאמן", answer: "המאמן עונה על שאלות תזונה ואימון לפי המספרים שלך — כמה נשאר לאכול, כמה חלבון, למה המשקל תקוע — ויכול לרשום ארוחה אם תכתוב מה אכלת." },
    en: { title: "The coach", answer: "The coach answers nutrition and training questions from your own numbers — what's left today, protein, a stuck scale — and logs a meal if you tell it what you ate." },
  },
  {
    id: "update",
    keys: ["עדכון", "גרסה", "גרסה חדשה", "לא רואה שינוי", "update", "new version", "not updating"],
    he: {
      title: "עדכוני האפליקציה",
      answer: "עדכונים מגיעים לבד. כדי לקבל עדכון חדש סוגרים את האפליקציה לגמרי ופותחים שוב (לפעמים פעמיים). כשיש עדכון, מופיע פס למעלה.",
    },
    en: {
      title: "App updates",
      answer: "Updates arrive by themselves. To pick one up, fully close the app and reopen it (sometimes twice). A banner shows when one is ready.",
    },
  },
  {
    id: "score",
    route: "/",
    keys: ["ציון יומי", "רצף", "סטריק", "מסך הבית", "היום", "streak", "daily score", "today", "home"],
    he: {
      title: "מסך \"היום\"",
      answer: "מסך \"היום\" מרכז את הכול: ההרגלים לסמן, קלוריות, מים, אימון והרצף שלך. לחיצה על כל אריח פותחת את המסך שלו.",
    },
    en: {
      title: "The Today screen",
      answer: "Today gathers everything: habits to tick, calories, water, workout and your streak. Tap any tile to open its screen.",
    },
  },
];

/** Hebrew final letters folded to their regular forms, so "ים" and "ימ" match. */
const FINALS: Record<string, string> = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };

export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[׳״'"`]/g, "")
    .replace(/[םןץףך]/g, (c) => FINALS[c] ?? c)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Each word, plus itself without one or two Hebrew prefix letters. A form
 * with a letter taken off is marked, because "מחשבון" losing its מ becomes
 * "חשבון" (account) — a real word, but a weaker reading than the one typed. */
function variants(word: string): { w: string; stripped: boolean }[] {
  const out = [{ w: word, stripped: false }];
  let w = word;
  for (let i = 0; i < 2; i++) {
    if (w.length > 3 && /^[והבלמשכ]/.test(w)) {
      w = w.slice(1);
      out.push({ w, stripped: true });
    } else break;
  }
  return out;
}

/** Levenshtein distance, capped: we only ever ask "is it at most one?". */
function withinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** How strongly one query word matches one key word: exact, a shared stem
 * (one is the start of the other — "הרגלים" / "הרגל"), or one typo away. */
function wordScore(q: string, k: string): number {
  if (q === k) return 2;
  if (k.length >= 3 && q.length >= 3 && (q.startsWith(k) || k.startsWith(q))) return 1.5;
  // Typos, but not in the first letter: there a different letter is usually a
  // different word ("לחשבון" is not "מחשבון").
  if (q[0] !== k[0]) return 0;
  if (q.length >= 5 && k.length >= 5 && withinOne(q, k)) return 1.5;
  if (q.length >= 4 && k.length >= 4 && withinOne(q, k)) return 1;
  return 0;
}

type Position = { w: string; stripped: boolean }[];

function bestAt(pos: Position, key: string): number {
  let best = 0;
  for (const v of pos) best = Math.max(best, wordScore(v.w, key) * (v.stripped ? 0.8 : 1));
  return best;
}

/**
 * How many topics each single key word belongs to. A word that points at five
 * topics ("משקל" is a weigh-in, a goal weight and a calorie target) says less
 * than one that points at a single topic, so it is worth less.
 */
const SPREAD = (() => {
  const count = new Map<string, number>();
  for (const t of HELP_TOPICS) {
    for (const k of new Set(t.keys.map(fold).filter((k) => k && !k.includes(" ")))) {
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  return count;
})();

export function scoreTopic(query: string, topic: HelpTopic): number {
  const q = fold(query);
  if (!q) return 0;
  const positions: Position[] = q.split(" ").map(variants);
  let score = 0;
  for (const raw of topic.keys) {
    const key = fold(raw);
    if (!key) continue;
    if (key.includes(" ")) {
      // A phrase counts when its words appear in order — each allowing a
      // prefix letter or a different ending — and it is the strongest signal.
      const parts = key.split(" ");
      for (let i = 0; i + parts.length <= positions.length; i++) {
        if (parts.every((part, j) => bestAt(positions[i + j]!, part) >= 1.2)) {
          score += 3 + parts.length;
          break;
        }
      }
      continue;
    }
    let best = 0;
    for (const pos of positions) best = Math.max(best, bestAt(pos, key));
    score += best / (SPREAD.get(key) ?? 1);
  }
  return score;
}

export type HelpAnswer =
  | { kind: "answer"; topic: HelpTopic; also: HelpTopic[] }
  | { kind: "choose"; options: HelpTopic[] }
  | { kind: "none" };

/** Below this, a topic is not an answer — a lone weak hit is a guess. */
const MIN_SCORE = 1.5;

export function answerHelp(query: string): HelpAnswer {
  const ranked = HELP_TOPICS.map((topic) => ({ topic, score: scoreTopic(query, topic) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return { kind: "none" };
  const [first, second] = ranked;
  // A clear winner answers; two near-equal topics are offered as a choice.
  if (!second || first!.score >= second.score * 1.3) {
    return { kind: "answer", topic: first!.topic, also: ranked.slice(1, 3).map((r) => r.topic) };
  }
  return { kind: "choose", options: ranked.slice(0, 3).map((r) => r.topic) };
}

export function topicById(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.id === id);
}

/** Taps offered before anything is typed. */
export const HELP_STARTERS = ["meal-log", "photo-scan", "weigh-in", "workout-plan", "habit-add", "account"];

/**
 * Whether a question is about using the app rather than about food or training
 * — "where", "how do I", "can't find". The coach hands these to the guide.
 */
export function isAppQuestion(query: string): boolean {
  const q = ` ${fold(query)} `;
  const asks = ["איפה", "איך", "מאיפה", "לא מוצא", "לא מוצאת", "where", "how do i", "how to", "cant find"].map(fold);
  if (!asks.some((a) => q.includes(` ${a} `))) return false;
  return answerHelp(query).kind === "answer";
}
