import { isolateDeep } from "@/i18n/bidi";
/**
 * The recipe book: how to make every dish in the kitchen, step by step.
 *
 * Each library meal (./data.ts, MEALS) has one entry here, by id — the test
 * suite fails if one is missing — with the time it takes, how hard it is,
 * numbered steps in Hebrew and English, and options: the same dish made to
 * suit someone else (vegan, gluten-free, lighter, more protein, for kids).
 * The steps use the amounts the card lists, for one portion.
 */

export type RecipeTag = "quick" | "noCook" | "mealPrep" | "kids" | "onePan" | "budget";

export type Recipe = {
  /** Start to plate, in minutes (waiting time such as overnight soaking not counted). */
  minutes: number;
  /** 1 easy — anyone; 2 takes some attention. */
  level: 1 | 2;
  tags: RecipeTag[];
  he: string[];
  en: string[];
  /** The same dish, made to suit someone else. */
  options: { he: string; en: string }[];
  tip?: { he: string; en: string };
};

const R = (
  minutes: number,
  level: 1 | 2,
  tags: RecipeTag[],
  he: string[],
  en: string[],
  options: [string, string][],
  tip?: [string, string],
): Recipe => ({
  minutes,
  level,
  tags,
  he,
  en,
  options: options.map(([h, e]) => ({ he: h, en: e })),
  tip: tip ? { he: tip[0], en: tip[1] } : undefined,
});

export const RECIPES: Record<string, Recipe> = isolateDeep({
  // ─── breakfast ───
  "omelette-salad": R(10, 1, ["quick", "budget"],
    [
      "קוצצים עגבנייה ומלפפון לקוביות קטנות, מתבלים במלח ומעט לימון.",
      "טורפים 2 ביצים עם קורט מלח ופלפל שחור.",
      "מחממים כפית שמן זית במחבת על אש בינונית.",
      "יוצקים את הביצים, מחכים שהשוליים יתייצבו ומקפלים לחצי.",
      "מגישים את החביתה לצד הסלט.",
    ],
    [
      "Dice the tomato and cucumber small; season with salt and a little lemon.",
      "Beat 2 eggs with a pinch of salt and black pepper.",
      "Heat a teaspoon of olive oil in a pan over medium heat.",
      "Pour in the eggs, wait until the edges set, then fold in half.",
      "Serve the omelette beside the salad.",
    ],
    [
      ["יותר חלבון: מוסיפים חלבון של ביצה שלישית.", "More protein: add a third egg white."],
      ["טבעוני: טופו מקושקש עם כורכום במקום ביצים.", "Vegan: scrambled tofu with turmeric instead of eggs."],
    ],
    ["אש בינונית ולא גבוהה — חביתה רכה ולא גומי.", "Medium heat, not high — a soft omelette, not a rubbery one."]),
  "shakshuka": R(20, 1, ["onePan", "budget"],
    [
      "קוצצים בצל ופלפל ומטגנים במחבת 5 דקות עד שמתרככים.",
      "מוסיפים עגבנייה קצוצה, מלח, פפריקה וכמון ומבשלים 8 דקות עד שהרוטב מסמיך.",
      "עושים 2 גומות ברוטב ושוברים לתוכן 2 ביצים.",
      "מכסים ומבשלים על אש נמוכה 5–6 דקות, עד שהחלבון נקרש והחלמון עדיין רך.",
      "מפזרים פטרוזיליה ומגישים מהמחבת.",
    ],
    [
      "Chop the onion and pepper and soften them in a pan for 5 minutes.",
      "Add the chopped tomato, salt, paprika and cumin; simmer 8 minutes until thick.",
      "Make 2 wells in the sauce and crack an egg into each.",
      "Cover and cook on low for 5–6 minutes, until the whites set and the yolks stay soft.",
      "Scatter parsley and serve from the pan.",
    ],
    [
      ["חריף: פלפל חריף קצוץ עם הבצל.", "Spicy: a chopped chilli with the onion."],
      ["עשיר יותר: פטה מפוררת מעל בסוף.", "Richer: crumble feta over at the end."],
    ],
    ["עגבניות מקופסה עובדות מצוין מחוץ לעונה.", "Tinned tomatoes work well out of season."]),
  "yogurt-bowl": R(5, 1, ["quick", "noCook"],
    [
      "מעבירים גביע יוגורט יווני לקערה.",
      "פורסים בננה ומסדרים מעל.",
      "מפזרים כף גדושה שיבולת שועל וכמה אגוזים קצוצים.",
    ],
    [
      "Spoon a pot of Greek yogurt into a bowl.",
      "Slice a banana over it.",
      "Scatter a heaped tablespoon of oats and a few chopped nuts.",
    ],
    [
      ["ללא גלוטן: גרנולה ללא גלוטן במקום שיבולת שועל רגילה.", "Gluten-free: gluten-free oats or granola."],
      ["טבעוני: יוגורט סויה או קוקוס.", "Vegan: soy or coconut yogurt."],
    ]),
  "cottage-toast": R(5, 1, ["quick", "noCook", "budget"],
    [
      "קולים פרוסת לחם מלא.",
      "מורחים גביע קוטג׳ בשכבה עבה.",
      "מסדרים פרוסות עגבנייה, מלח, פלפל שחור וזעתר אם יש.",
    ],
    [
      "Toast a slice of whole-grain bread.",
      "Spread a tub of cottage cheese thickly over it.",
      "Top with tomato slices, salt, black pepper and za'atar if you have it.",
    ],
    [
      ["ללא גלוטן: על פריכיות אורז.", "Gluten-free: on rice cakes."],
      ["קליל יותר: קוטג׳ 3%.", "Lighter: 3% cottage cheese."],
    ]),
  "oatmeal-pb": R(10, 1, ["quick", "budget"],
    [
      "מביאים כוס חלב לרתיחה עדינה בסיר קטן.",
      "מוסיפים חצי כוס שיבולת שועל ומבשלים 4–5 דקות תוך ערבוב.",
      "מעבירים לקערה, פורסים בננה מעל.",
      "מוסיפים כף חמאת בוטנים ומערבבים קלות.",
    ],
    [
      "Bring a cup of milk to a gentle boil in a small pot.",
      "Add half a cup of oats and cook for 4–5 minutes, stirring.",
      "Pour into a bowl and slice a banana over it.",
      "Add a spoon of peanut butter and swirl it in.",
    ],
    [
      ["טבעוני: משקה שיבולת שועל או סויה במקום חלב.", "Vegan: oat or soy drink instead of milk."],
      ["קליל יותר: חצי מים חצי חלב, חצי כף חמאת בוטנים.", "Lighter: half water half milk, half a spoon of peanut butter."],
    ]),
  "avocado-egg-toast": R(12, 1, ["quick"],
    [
      "מבשלים 2 ביצים 8 דקות במים רותחים ומקררים במים קרים (או עושים עלומות).",
      "מועכים חצי אבוקדו עם מלח, פלפל וסחיטת לימון.",
      "קולים פרוסת לחם מלא ומורחים עליה את האבוקדו.",
      "פורסים את הביצים ומסדרים מעל.",
    ],
    [
      "Boil 2 eggs for 8 minutes and cool them in cold water (or poach them).",
      "Mash half an avocado with salt, pepper and a squeeze of lemon.",
      "Toast a slice of whole-grain bread and spread the avocado on it.",
      "Slice the eggs and lay them on top.",
    ],
    [
      ["ללא גלוטן: על פריכייה או בטטה צלויה פרוסה.", "Gluten-free: on a rice cake or a slice of roast sweet potato."],
      ["טבעוני: טופו מקושקש במקום ביצים.", "Vegan: scrambled tofu instead of eggs."],
    ]),
  "white-cheese-plate": R(5, 1, ["quick", "noCook", "budget"],
    [
      "חותכים מלפפון ועגבנייה לרצועות.",
      "מעבירים 4 כפות גבינה לבנה לקערית, מוסיפים מלח, פלפל וקצת שמן זית אם רוצים.",
      "מגישים עם פרוסת לחם מלא.",
    ],
    [
      "Cut the cucumber and tomato into strips.",
      "Put 4 spoons of white cheese in a small bowl; add salt, pepper and a little olive oil if you like.",
      "Serve with a slice of whole-grain bread.",
    ],
    [
      ["טבעוני: חומוס במקום גבינה.", "Vegan: hummus instead of cheese."],
      ["ללא גלוטן: פריכיות אורז במקום לחם.", "Gluten-free: rice cakes instead of bread."],
    ]),
  "egg-avocado-bowl": R(12, 1, ["quick"],
    [
      "מבשלים 2 ביצים 9 דקות, מקררים ומקלפים.",
      "מועכים חצי אבוקדו עם מלח ולימון.",
      "חותכים עגבנייה לקוביות.",
      "מסדרים בקערה, חוצים את הביצים ומזליפים כפית שמן זית.",
    ],
    [
      "Boil 2 eggs for 9 minutes, cool and peel.",
      "Mash half an avocado with salt and lemon.",
      "Dice the tomato.",
      "Arrange in a bowl, halve the eggs and drizzle a teaspoon of olive oil.",
    ],
    [
      ["הכנה מראש: 6 ביצים קשות במקרר מחזיקות 5 ימים.", "Make ahead: 6 boiled eggs keep 5 days in the fridge."],
      ["יותר ירוק: חופן רוקט מתחת.", "Greener: a handful of rocket underneath."],
    ]),
  "cottage-fruit": R(3, 1, ["quick", "noCook"],
    [
      "מעבירים גביע קוטג׳ לקערה.",
      "מוסיפים חופן פירות יער (טריים או מופשרים).",
      "מפזרים כמה אגוזים קצוצים.",
    ],
    [
      "Spoon a tub of cottage cheese into a bowl.",
      "Add a handful of berries (fresh or thawed).",
      "Scatter a few chopped nuts.",
    ],
    [
      ["מתוק יותר: כפית דבש או סילאן.", "Sweeter: a teaspoon of honey or date syrup."],
      ["טבעוני: יוגורט סויה.", "Vegan: soy yogurt."],
    ]),
  "granola-yogurt": R(3, 1, ["quick", "noCook"],
    [
      "מעבירים גביע יוגורט יווני לקערה.",
      "פורסים בננה מעל.",
      "מפזרים חופן גרנולה ממש לפני האכילה כדי שתישאר פריכה.",
    ],
    [
      "Spoon a pot of Greek yogurt into a bowl.",
      "Slice a banana over it.",
      "Scatter a handful of granola just before eating so it stays crisp.",
    ],
    [
      ["פחות סוכר: גרנולה ביתית או שיבולת שועל קלויה.", "Less sugar: home-made granola or toasted oats."],
      ["ללא גלוטן: גרנולה ללא גלוטן.", "Gluten-free: gluten-free granola."],
    ]),
  "chia-pudding": R(5, 1, ["noCook", "mealPrep"],
    [
      "בערב: מערבבים כף צ׳יה עם כוס חלב בצנצנת.",
      "מחכים 5 דקות, מערבבים שוב כדי שלא יהיו גושים, וסוגרים.",
      "משאירים במקרר לילה שלם.",
      "בבוקר מוסיפים חופן פירות יער מעל.",
    ],
    [
      "In the evening: stir a spoon of chia into a cup of milk in a jar.",
      "Wait 5 minutes, stir again so it doesn't clump, and close.",
      "Leave in the fridge overnight.",
      "In the morning top with a handful of berries.",
    ],
    [
      ["טבעוני: משקה שקדים או סויה.", "Vegan: almond or soy drink."],
      ["יותר חלבון: חצי חלב חצי יוגורט יווני.", "More protein: half milk, half Greek yogurt."],
    ]),
  "bagel-cheese": R(5, 1, ["quick", "noCook"],
    [
      "חוצים בייגל וקולים קלות.",
      "מורחים 4 כפות גבינה לבנה.",
      "מסדרים פרוסות מלפפון, מלח ופלפל.",
    ],
    [
      "Halve a bagel and toast it lightly.",
      "Spread 4 spoons of white cheese.",
      "Add cucumber slices, salt and pepper.",
    ],
    [
      ["יותר חלבון: פרוסות סלמון מעושן.", "More protein: a few slices of smoked salmon."],
      ["קליל יותר: חצי בייגל.", "Lighter: half a bagel."],
    ]),
  "protein-shake-banana": R(3, 1, ["quick", "noCook"],
    [
      "מכניסים לבלנדר כוס חלב קר, סקופ אבקת חלבון ובננה.",
      "מוסיפים 2–3 קוביות קרח.",
      "טוחנים 30 שניות ושותים מיד.",
    ],
    [
      "Put a cup of cold milk, a scoop of protein powder and a banana in a blender.",
      "Add 2–3 ice cubes.",
      "Blend 30 seconds and drink straight away.",
    ],
    [
      ["טבעוני: חלבון אפונה ומשקה סויה.", "Vegan: pea protein and soy drink."],
      ["משביע יותר: כף שיבולת שועל בבלנדר.", "More filling: a spoon of oats in the blender."],
    ]),
  "cornflakes-milk": R(2, 1, ["quick", "noCook", "kids"],
    [
      "מעבירים קערת קורנפלקס לקערה.",
      "מוסיפים כוס חלב קר.",
      "פורסים בננה מעל.",
    ],
    [
      "Pour a bowl of cornflakes.",
      "Add a cup of cold milk.",
      "Slice a banana over it.",
    ],
    [
      ["יותר חלבון: חצי כמות דגנים ויוגורט יווני לצד.", "More protein: half the cereal, Greek yogurt on the side."],
      ["טבעוני: משקה סויה.", "Vegan: soy drink."],
    ]),
  "shakshuka-feta": R(20, 1, ["onePan"],
    [
      "מטגנים פלפל קצוץ 4 דקות במחבת.",
      "מוסיפים עגבנייה קצוצה, מלח, פפריקה ושום ומבשלים 8 דקות.",
      "שוברים 2 ביצים לגומות ברוטב, מכסים ומבשלים 5 דקות על אש נמוכה.",
      "מפוררים את הפטה מעל ומחכים דקה שתתחמם.",
    ],
    [
      "Soften the chopped pepper in a pan for 4 minutes.",
      "Add chopped tomato, salt, paprika and garlic; simmer 8 minutes.",
      "Crack 2 eggs into wells in the sauce, cover and cook 5 minutes on low.",
      "Crumble the feta over and give it a minute to warm.",
    ],
    [
      ["כשר חלבי קליל: בולגרית 5% במקום פטה.", "Lighter: 5% Bulgarian cheese instead of feta."],
      ["ירוק: חופן תרד לרוטב לפני הביצים.", "Greener: a handful of spinach in the sauce before the eggs."],
    ]),
  "labneh-pita": R(5, 1, ["quick", "noCook"],
    [
      "מחממים פיתה מלאה במחבת יבשה חצי דקה מכל צד.",
      "מורחים כף גדושה לאבנה.",
      "מסדרים מלפפון חתוך ומזליפים כף שמן זית; זעתר אם יש.",
    ],
    [
      "Warm a wholemeal pita in a dry pan for half a minute a side.",
      "Spread a heaped spoon of labneh.",
      "Add sliced cucumber and drizzle a spoon of olive oil; za'atar if you have it.",
    ],
    [
      ["קליל יותר: כפית שמן זית במקום כף.", "Lighter: a teaspoon of olive oil instead of a spoon."],
      ["ללא גלוטן: עם מקלות ירקות במקום פיתה.", "Gluten-free: with vegetable sticks instead of pita."],
    ]),
  "kefir-flax-smoothie": R(3, 1, ["quick", "noCook"],
    [
      "מכניסים לבלנדר כוס קפיר, בננה וחופן פירות יער.",
      "מוסיפים כף זרעי פשתן טחונים.",
      "טוחנים עד שחלק ושותים מיד.",
    ],
    [
      "Put a cup of kefir, a banana and a handful of berries in a blender.",
      "Add a spoon of ground flaxseed.",
      "Blend until smooth and drink straight away.",
    ],
    [
      ["טבעוני: יוגורט סויה ומים במקום קפיר.", "Vegan: soy yogurt and water instead of kefir."],
      ["יותר חלבון: סקופ אבקת חלבון.", "More protein: a scoop of protein powder."],
    ]),
  "overnight-oats-skyr": R(5, 1, ["noCook", "mealPrep"],
    [
      "בערב: מערבבים בצנצנת חצי כוס שיבולת שועל, גביע סקיר וכף צ׳יה.",
      "מוסיפים 3–4 כפות מים או חלב אם המרקם סמיך מדי.",
      "סוגרים ומשאירים במקרר לילה.",
      "בבוקר מוסיפים פירות יער מעל.",
    ],
    [
      "In the evening: mix half a cup of oats, a pot of skyr and a spoon of chia in a jar.",
      "Add 3–4 spoons of water or milk if it's too thick.",
      "Close and leave in the fridge overnight.",
      "In the morning top with berries.",
    ],
    [
      ["טבעוני: יוגורט סויה.", "Vegan: soy yogurt."],
      ["הכנה מראש: 3 צנצנות מחזיקות 3 ימים.", "Make ahead: 3 jars keep for 3 days."],
    ]),
  "green-shakshuka": R(20, 1, ["onePan"],
    [
      "פורסים את הכרישה לטבעות דקות ומטגנים בכפית שמן זית 5 דקות.",
      "מוסיפים חופן תרד, מלח ופלפל, ומערבבים עד שהתרד קמל.",
      "עושים 2 גומות ושוברים 2 ביצים.",
      "מכסים ומבשלים 5 דקות על אש נמוכה.",
      "מפוררים פטה מעל ומגישים.",
    ],
    [
      "Slice the leek into thin rings and soften in a teaspoon of olive oil for 5 minutes.",
      "Add a handful of spinach, salt and pepper, stirring until it wilts.",
      "Make 2 wells and crack in 2 eggs.",
      "Cover and cook 5 minutes on low.",
      "Crumble feta over and serve.",
    ],
    [
      ["עשיר: כף יוגורט ושום מעל.", "Richer: a spoon of garlic yogurt on top."],
      ["בלי פטה: זעתר ולימון.", "No feta: za'atar and lemon."],
    ]),
  "protein-pancakes": R(20, 1, ["kids"],
    [
      "טוחנים בבלנדר 4 כפות שיבולת שועל, בננה, 2 ביצים וחצי גביע קוטג׳ לבלילה חלקה.",
      "מחממים מחבת עם טיפת שמן על אש בינונית.",
      "יוצקים כף בלילה לכל פנקייק ומטגנים עד שמופיעות בועות, כ-2 דקות.",
      "הופכים ומטגנים עוד דקה.",
      "מגישים עם פירות יער או מעט סילאן.",
    ],
    [
      "Blend 4 spoons of oats, a banana, 2 eggs and half a tub of cottage cheese into a smooth batter.",
      "Heat a pan with a drop of oil over medium heat.",
      "Pour a spoonful of batter per pancake and cook until bubbles appear, about 2 minutes.",
      "Flip and cook another minute.",
      "Serve with berries or a little date syrup.",
    ],
    [
      ["ללא גלוטן: שיבולת שועל ללא גלוטן.", "Gluten-free: gluten-free oats."],
      ["מתוק לילדים: קינמון ושוקולד צ׳יפס מריר בבלילה.", "Sweet for kids: cinnamon and dark chocolate chips in the batter."],
    ],
    ["בלילה סמיכה מדי? עוד כף חלב.", "Batter too thick? Add a spoon of milk."]),
  "tofu-scramble": R(12, 1, ["quick", "onePan"],
    [
      "מחממים כפית שמן זית במחבת.",
      "מפוררים חצי חבילת טופו לתוך המחבת בידיים.",
      "מוסיפים קורט כורכום, מלח ופלפל ומערבבים 4 דקות.",
      "מוסיפים עגבנייה קצוצה וחופן תרד ומבשלים עוד 2 דקות.",
    ],
    [
      "Heat a teaspoon of olive oil in a pan.",
      "Crumble half a block of tofu into it by hand.",
      "Add a pinch of turmeric, salt and pepper; stir for 4 minutes.",
      "Add the chopped tomato and a handful of spinach and cook 2 more minutes.",
    ],
    [
      ["טעם של ביצה: קורט מלח שחור (קאלה נמאק).", "Eggy flavour: a pinch of black salt (kala namak)."],
      ["משביע יותר: בתוך טורטייה.", "More filling: in a tortilla."],
    ]),
  "french-toast-berries": R(15, 1, ["kids"],
    [
      "טורפים 2 ביצים עם רבע כוס חלב וקורט קינמון בצלחת עמוקה.",
      "טובלים 2 פרוסות לחם מלא, כ-10 שניות מכל צד.",
      "משחימים במחבת משומנת קלות, 2–3 דקות מכל צד.",
      "מגישים עם חופן פירות יער.",
    ],
    [
      "Beat 2 eggs with a quarter cup of milk and a pinch of cinnamon in a deep plate.",
      "Dip 2 slices of whole-grain bread, about 10 seconds a side.",
      "Brown in a lightly oiled pan, 2–3 minutes a side.",
      "Serve with a handful of berries.",
    ],
    [
      ["יותר חלבון: כף יוגורט יווני מעל.", "More protein: a spoon of Greek yogurt on top."],
      ["טבעוני: חלב סויה וכף קמח חומוס במקום ביצים.", "Vegan: soy milk and a spoon of chickpea flour instead of eggs."],
    ]),
  "hummus-egg-plate": R(12, 1, ["quick"],
    [
      "מבשלים 2 ביצים 9 דקות ומקלפים.",
      "מורחים כף גדושה חומוס בצלחת בתנועה סיבובית ומזליפים מעט שמן זית ופפריקה.",
      "חותכים עגבנייה ומלפפון.",
      "מגישים עם הביצים וחצי פיתה מלאה חמה.",
    ],
    [
      "Boil 2 eggs for 9 minutes and peel.",
      "Swirl a heaped spoon of hummus onto a plate; drizzle a little olive oil and paprika.",
      "Cut the tomato and cucumber.",
      "Serve with the eggs and half a warm wholemeal pita.",
    ],
    [
      ["טבעוני: פול או חומוס שלם במקום ביצים.", "Vegan: fava or whole chickpeas instead of eggs."],
      ["ללא גלוטן: בלי פיתה, עם עוד ירקות.", "Gluten-free: skip the pita, add more vegetables."],
    ]),
  "labneh-zaatar-toast": R(5, 1, ["quick", "noCook"],
    [
      "קולים פרוסת לחם מלא.",
      "מורחים כף גדושה לאבנה.",
      "מפזרים כפית זעתר ומזליפים כפית שמן זית.",
      "מסדרים פרוסות עגבנייה מעל.",
    ],
    [
      "Toast a slice of whole-grain bread.",
      "Spread a heaped spoon of labneh.",
      "Sprinkle a teaspoon of za'atar and drizzle a teaspoon of olive oil.",
      "Top with tomato slices.",
    ],
    [
      ["יותר חלבון: ביצה קשה פרוסה לצד.", "More protein: a sliced boiled egg alongside."],
      ["טבעוני: חומוס במקום לאבנה.", "Vegan: hummus instead of labneh."],
    ]),

  // ─── lunch ───
  "tuna-salad": R(8, 1, ["quick", "noCook", "budget"],
    [
      "מסננים קופסת טונה במים.",
      "קורעים חופן חסה לקערה, מוסיפים מלפפון ועגבנייה חתוכים.",
      "מפוררים את הטונה מעל.",
      "מתבלים בכפית שמן זית, סחיטת לימון, מלח ופלפל.",
    ],
    [
      "Drain a tin of tuna in water.",
      "Tear a handful of lettuce into a bowl; add cut cucumber and tomato.",
      "Flake the tuna over it.",
      "Dress with a teaspoon of olive oil, lemon, salt and pepper.",
    ],
    [
      ["משביע יותר: חצי כוס גרגירי חומוס או תפוח אדמה מבושל.", "More filling: half a cup of chickpeas or a boiled potato."],
      ["צמחוני: ביצים קשות במקום טונה.", "Vegetarian: boiled eggs instead of tuna."],
    ]),
  "chicken-rice-broccoli": R(30, 1, ["mealPrep"],
    [
      "מבשלים חצי כוס אורז לפי ההוראות (כ-18 דקות).",
      "מתבלים חזה עוף במלח, פלפל ופפריקה.",
      "צולים במחבת פסים חמה 5–6 דקות מכל צד, עד שאין ורוד במרכז.",
      "מאדים את הברוקולי 5 דקות (או במיקרו עם מעט מים ומכסה).",
      "פורסים את העוף ומגישים עם האורז והברוקולי.",
    ],
    [
      "Cook half a cup of rice as packed (about 18 minutes).",
      "Season the chicken breast with salt, pepper and paprika.",
      "Grill in a hot grill pan 5–6 minutes a side, until no pink remains in the centre.",
      "Steam the broccoli for 5 minutes (or microwave with a little water, covered).",
      "Slice the chicken and serve with the rice and broccoli.",
    ],
    [
      ["הכנה מראש: 3 מנות לקופסאות, מחזיק 3 ימים במקרר.", "Make ahead: 3 portions in boxes keep 3 days in the fridge."],
      ["צמחוני: טופו צלוי במקום עוף.", "Vegetarian: grilled tofu instead of chicken."],
    ],
    ["לעוף עסיסי: להניח 5 דקות לפני שפורסים.", "For juicy chicken: rest it 5 minutes before slicing."]),
  "chicken-sweet-potato": R(40, 1, ["mealPrep"],
    [
      "מחממים תנור ל-200 מעלות.",
      "חותכים בטטה לקוביות, מערבבים עם מעט שמן, מלח ופפריקה ואופים 30 דקות.",
      "באמצע האפייה צולים חזה עוף מתובל במחבת, 5–6 דקות מכל צד.",
      "מגישים עם חופן עלי חסה ולימון.",
    ],
    [
      "Heat the oven to 200°C.",
      "Cube the sweet potato, toss with a little oil, salt and paprika, roast 30 minutes.",
      "Meanwhile grill the seasoned chicken breast in a pan, 5–6 minutes a side.",
      "Serve with a handful of lettuce and lemon.",
    ],
    [
      ["צמחוני: חומוס קלוי במקום עוף.", "Vegetarian: roast chickpeas instead of chicken."],
      ["מהיר: בטטה במיקרו 8 דקות במקום בתנור.", "Faster: microwave the sweet potato 8 minutes instead of roasting."],
    ]),
  "hummus-bowl": R(8, 1, ["quick", "noCook", "budget"],
    [
      "מסננים ושוטפים כוס גרגירי חומוס מבושלים.",
      "קוצצים עגבנייה ומלפפון.",
      "מערבבים בקערה עם כף טחינה, לימון, מלח ומעט שמן זית.",
      "מפזרים פטרוזיליה או פפריקה.",
    ],
    [
      "Drain and rinse a cup of cooked chickpeas.",
      "Chop the tomato and cucumber.",
      "Mix in a bowl with a spoon of tahini, lemon, salt and a little olive oil.",
      "Scatter parsley or paprika.",
    ],
    [
      ["חם: מחממים את החומוס עם כמון לפני.", "Warm: heat the chickpeas with cumin first."],
      ["יותר חלבון: ביצה קשה.", "More protein: a boiled egg."],
    ]),
  "turkey-wrap": R(5, 1, ["quick", "noCook"],
    [
      "מחממים טורטייה במחבת יבשה 20 שניות.",
      "מורחים כפית טחינה.",
      "מסדרים פרוסות הודו, חסה ועגבנייה פרוסה.",
      "מגלגלים חזק, חוצים באלכסון.",
    ],
    [
      "Warm a tortilla in a dry pan for 20 seconds.",
      "Spread a teaspoon of tahini.",
      "Lay on turkey slices, lettuce and sliced tomato.",
      "Roll tightly and cut on the diagonal.",
    ],
    [
      ["ללא גלוטן: עלה חסה גדול במקום טורטייה.", "Gluten-free: a big lettuce leaf instead of a tortilla."],
      ["צמחוני: חומוס וירקות במקום הודו.", "Vegetarian: hummus and vegetables instead of turkey."],
    ]),
  "feta-salad": R(10, 1, ["quick", "noCook"],
    [
      "חותכים עגבנייה ומלפפון לקוביות גדולות, ובצל לפרוסות דקות.",
      "מוסיפים כמה זיתים.",
      "מסדרים מעל קוביות פטה.",
      "מזליפים שמן זית, מפזרים אורגנו ומלח.",
    ],
    [
      "Cut the tomato and cucumber into chunks and the onion into thin slices.",
      "Add a few olives.",
      "Lay the feta cubes on top.",
      "Drizzle with olive oil; sprinkle oregano and salt.",
    ],
    [
      ["טבעוני: טופו מעושן במקום פטה.", "Vegan: smoked tofu instead of feta."],
      ["משביע: לצד פיתה מלאה.", "More filling: with a wholemeal pita."],
    ]),
  "chickpea-quinoa": R(20, 1, ["mealPrep"],
    [
      "שוטפים חצי כוס קינואה ומבשלים בכוס מים 15 דקות, עד שהמים נספגים.",
      "מסננים כוס גרגירי חומוס.",
      "מערבבים את הקינואה החמה עם החומוס וחופן תרד — התרד קמל מהחום.",
      "מתבלים בלימון, מלח, פלפל ומעט שמן זית.",
    ],
    [
      "Rinse half a cup of quinoa and simmer in a cup of water for 15 minutes, until absorbed.",
      "Drain a cup of chickpeas.",
      "Stir the hot quinoa with the chickpeas and a handful of spinach — the heat wilts it.",
      "Season with lemon, salt, pepper and a little olive oil.",
    ],
    [
      ["מזרחי: כמון ופטרוזיליה.", "Middle-Eastern: cumin and parsley."],
      ["יותר חלבון: פטה מפוררת.", "More protein: crumbled feta."],
    ]),
  "chicken-quinoa": R(30, 1, ["mealPrep"],
    [
      "מבשלים חצי כוס קינואה 15 דקות.",
      "חותכים קישוא לפרוסות, מערבבים עם כפית שמן זית ומלח וצולים בתנור 200 מעלות 20 דקות.",
      "צולים חזה עוף מתובל במחבת, 5–6 דקות מכל צד.",
      "פורסים ומגישים יחד.",
    ],
    [
      "Simmer half a cup of quinoa for 15 minutes.",
      "Slice the zucchini, toss with a teaspoon of olive oil and salt, roast at 200°C for 20 minutes.",
      "Grill the seasoned chicken breast in a pan, 5–6 minutes a side.",
      "Slice and serve together.",
    ],
    [
      ["צמחוני: חלומי צלוי במקום עוף.", "Vegetarian: grilled halloumi instead of chicken."],
      ["קליל: חצי מנת קינואה ועוד ירקות.", "Lighter: half the quinoa and more vegetables."],
    ]),
  "turkey-rice-bowl": R(25, 1, ["onePan"],
    [
      "מבשלים חצי כוס אורז.",
      "חותכים פלפל ובצל לרצועות ומקפיצים במחבת חמה 4 דקות.",
      "מוסיפים את רצועות ההודו ומקפיצים עוד 5 דקות עם מלח, פלפל וכף רוטב סויה.",
      "מגישים על האורז.",
    ],
    [
      "Cook half a cup of rice.",
      "Cut the pepper and onion into strips and stir-fry in a hot pan for 4 minutes.",
      "Add the turkey strips and stir-fry 5 more minutes with salt, pepper and a spoon of soy sauce.",
      "Serve over the rice.",
    ],
    [
      ["ללא גלוטן: טמארי במקום סויה.", "Gluten-free: tamari instead of soy sauce."],
      ["צמחוני: טופו במקום הודו.", "Vegetarian: tofu instead of turkey."],
    ]),
  "tuna-potato": R(15, 1, ["budget"],
    [
      "דוקרים תפוח אדמה במזלג ומבשלים במיקרו 7–8 דקות, עד שרך.",
      "חוצים ומועכים קלות את הפנים עם מזלג.",
      "מערבבים את הטונה עם כפית שמן זית, מלח ופלפל וממלאים.",
      "מגישים עם חופן חסה.",
    ],
    [
      "Prick a potato with a fork and microwave 7–8 minutes, until soft.",
      "Split it and loosen the inside with a fork.",
      "Mix the tuna with a teaspoon of olive oil, salt and pepper and fill.",
      "Serve with a handful of lettuce.",
    ],
    [
      ["צמחוני: קוטג׳ במקום טונה.", "Vegetarian: cottage cheese instead of tuna."],
      ["בתנור: 45 דקות ב-200 מעלות לקליפה פריכה.", "Oven: 45 minutes at 200°C for a crisp skin."],
    ]),
  "chickpea-salad": R(8, 1, ["quick", "noCook", "budget"],
    [
      "מסננים כוס גרגירי חומוס.",
      "קוצצים עגבנייה ומלפפון דק.",
      "מערבבים עם כף טחינה, לימון, מלח וכמון.",
    ],
    [
      "Drain a cup of chickpeas.",
      "Chop the tomato and cucumber finely.",
      "Mix with a spoon of tahini, lemon, salt and cumin.",
    ],
    [
      ["חריף: קצת סחוג.", "Spicy: a little schug."],
      ["בפיתה: חצי פיתה מלאה.", "In a pita: half a wholemeal pita."],
    ]),
  "beef-sweet-potato": R(35, 2, [],
    [
      "צולים בטטה חתוכה בתנור 200 מעלות כ-30 דקות.",
      "מוציאים את הבקר מהמקרר 15 דקות לפני, ומתבלים במלח גס ופלפל.",
      "צולים במחבת לוהטת 3–4 דקות מכל צד (מדיום), ומניחים 5 דקות לפני שפורסים.",
      "מקפיצים את התרד עם שום דקה אחת.",
      "מגישים את הבקר פרוס עם הבטטה והתרד.",
    ],
    [
      "Roast the cut sweet potato at 200°C for about 30 minutes.",
      "Take the beef out of the fridge 15 minutes before; season with coarse salt and pepper.",
      "Sear in a very hot pan 3–4 minutes a side (medium) and rest 5 minutes before slicing.",
      "Wilt the spinach with garlic for a minute.",
      "Serve the sliced beef with the sweet potato and spinach.",
    ],
    [
      ["קליל: הודו במקום בקר.", "Lighter: turkey instead of beef."],
      ["צמחוני: פטריות פורטובלו צלויות.", "Vegetarian: grilled portobello mushrooms."],
    ]),
  "egg-fried-rice": R(15, 1, ["quick", "onePan", "budget"],
    [
      "משתמשים באורז מבושל מאתמול (חצי כוס יבש) — אורז קר לא נדבק.",
      "מקפיצים גזר מגורד ואפונה בכף שמן 3 דקות.",
      "דוחפים הצידה, טורפים 2 ביצים בצד הריק ומערבבים עד שהן נקרשות.",
      "מוסיפים את האורז וכף רוטב סויה ומקפיצים 3 דקות על אש גבוהה.",
    ],
    [
      "Use yesterday's cooked rice (half a cup dry) — cold rice doesn't clump.",
      "Stir-fry grated carrot and peas in a spoon of oil for 3 minutes.",
      "Push aside, scramble 2 eggs in the empty side until set.",
      "Add the rice and a spoon of soy sauce and stir-fry 3 minutes on high.",
    ],
    [
      ["טבעוני: טופו מפורר במקום ביצים.", "Vegan: crumbled tofu instead of eggs."],
      ["יותר חלבון: קוביות עוף.", "More protein: diced chicken."],
    ],
    ["בלי אורז מאתמול? מקררים אורז טרי חצי שעה במקרר, פרוס על צלחת.", "No leftover rice? Chill fresh rice spread on a plate for half an hour."]),
  "chicken-couscous": R(30, 1, ["onePan"],
    [
      "חותכים גזר וקישוא לקוביות ומבשלים בכוס מים עם מלח וכורכום 15 דקות.",
      "מוסיפים חזה עוף חתוך לקוביות ומבשלים עוד 10 דקות.",
      "בקערה: חצי כוס קוסקוס, יוצקים מעליו חצי כוס מהמרק החם ומכסים ל-5 דקות.",
      "מפרידים את הקוסקוס במזלג ומגישים עם העוף והירקות.",
    ],
    [
      "Dice the carrot and zucchini and simmer in a cup of water with salt and turmeric for 15 minutes.",
      "Add the chicken breast, cubed, and simmer 10 more minutes.",
      "In a bowl: pour half a cup of the hot broth over half a cup of couscous, cover for 5 minutes.",
      "Fluff with a fork and serve with the chicken and vegetables.",
    ],
    [
      ["ללא גלוטן: קינואה במקום קוסקוס.", "Gluten-free: quinoa instead of couscous."],
      ["צמחוני: גרגירי חומוס במקום עוף.", "Vegetarian: chickpeas instead of chicken."],
    ]),
  "bulgur-veg": R(20, 1, ["mealPrep", "budget"],
    [
      "משרים חצי כוס בורגול בכוס מים רותחים עם מלח ל-15 דקות, מכוסה.",
      "קוצצים עגבנייה ומלפפון לקוביות קטנות.",
      "מערבבים עם הבורגול, כפית שמן זית ולימון.",
      "מוסיפים פטרוזיליה ונענע אם יש.",
    ],
    [
      "Soak half a cup of bulgur in a cup of boiling salted water for 15 minutes, covered.",
      "Dice the tomato and cucumber small.",
      "Mix with the bulgur, a teaspoon of olive oil and lemon.",
      "Add parsley and mint if you have them.",
    ],
    [
      ["ללא גלוטן: קינואה במקום בורגול.", "Gluten-free: quinoa instead of bulgur."],
      ["יותר חלבון: חצי כוס עדשים מבושלות.", "More protein: half a cup of cooked lentils."],
    ]),
  "freekeh-veg-bowl": R(35, 2, ["mealPrep"],
    [
      "מבשלים חצי כוס פריקה בכוס וחצי מים עם מלח, 20–25 דקות.",
      "חותכים דלעת לקוביות, מערבבים עם מעט שמן ומלח וצולים ב-200 מעלות כ-25 דקות.",
      "מחממים כוס גרגירי חומוס.",
      "מסדרים בקערה ומזליפים כף טחינה ולימון.",
    ],
    [
      "Simmer half a cup of freekeh in 1½ cups of salted water for 20–25 minutes.",
      "Cube the pumpkin, toss with a little oil and salt, roast at 200°C for about 25 minutes.",
      "Warm a cup of chickpeas.",
      "Arrange in a bowl; drizzle a spoon of tahini and lemon.",
    ],
    [
      ["ללא גלוטן: אורז מלא במקום פריקה.", "Gluten-free: brown rice instead of freekeh."],
      ["קליל: חצי מנת פריקה.", "Lighter: half the freekeh."],
    ]),
  "kale-chickpea-salad": R(10, 1, ["quick", "noCook"],
    [
      "מסירים את הגבעולים הקשים של הקייל וקורעים את העלים.",
      "מעסים את העלים בידיים עם סחיטת לימון, כף שמן זית ומלח דקה-שתיים, עד שהם מתרככים.",
      "מוסיפים כוס גרגירי חומוס.",
      "מפזרים שקדים קצוצים.",
    ],
    [
      "Strip the tough stems off the kale and tear the leaves.",
      "Massage the leaves with lemon juice, a spoon of olive oil and salt for a minute or two, until they soften.",
      "Add a cup of chickpeas.",
      "Scatter chopped almonds.",
    ],
    [
      ["יותר חלבון: פטה או ביצה קשה.", "More protein: feta or a boiled egg."],
      ["מתוק: רימון או חמוציות.", "Sweeter: pomegranate or cranberries."],
    ]),
  "mackerel-toast": R(5, 1, ["quick", "noCook"],
    [
      "קולים פרוסת לחם מלא.",
      "מסדרים חופן רוקט.",
      "מפוררים מעל פילה מקרל.",
      "סוחטים לימון ומפזרים פלפל שחור.",
    ],
    [
      "Toast a slice of whole-grain bread.",
      "Lay a handful of rocket on it.",
      "Flake a mackerel fillet over.",
      "Squeeze lemon and grind black pepper.",
    ],
    [
      ["זול יותר: סרדינים.", "Cheaper: sardines."],
      ["ללא גלוטן: על תפוח אדמה אפוי.", "Gluten-free: on a baked potato."],
    ]),
  "barley-chicken-bowl": R(40, 1, ["mealPrep"],
    [
      "מבשלים חצי כוס גריסי פנינה בשלוש כוסות מים מומלחים 30 דקות, ומסננים.",
      "צולים חזה עוף מתובל במחבת 5–6 דקות מכל צד ופורסים.",
      "חותכים מנגולד לרצועות ומקפיצים בכף שמן זית 2 דקות.",
      "מסדרים הכול בקערה עם לימון.",
    ],
    [
      "Simmer half a cup of pearl barley in three cups of salted water for 30 minutes; drain.",
      "Grill the seasoned chicken breast 5–6 minutes a side and slice.",
      "Cut the chard into ribbons and wilt in a spoon of olive oil for 2 minutes.",
      "Arrange it all in a bowl with lemon.",
    ],
    [
      ["ללא גלוטן: אורז מלא במקום גריסים.", "Gluten-free: brown rice instead of barley."],
      ["צמחוני: עדשים במקום עוף.", "Vegetarian: lentils instead of chicken."],
    ]),
  "fava-cilantro-salad": R(8, 1, ["quick", "noCook", "budget"],
    [
      "מסננים כוס פול מבושל (מקופסה או ביתי).",
      "קוצצים חופן כוסברה.",
      "מערבבים עם לימון, כף שמן זית, מלח וכמון.",
      "אפשר להוסיף שום כתוש ופלפל חריף.",
    ],
    [
      "Drain a cup of cooked fava beans (tinned or home-made).",
      "Chop a handful of coriander.",
      "Mix with lemon, a spoon of olive oil, salt and cumin.",
      "Add crushed garlic and chilli if you like.",
    ],
    [
      ["חם: מחממים את הפול עם הכמון.", "Warm: heat the beans with the cumin."],
      ["עם ביצה: ביצה קשה חצויה מעל.", "With egg: a halved boiled egg on top."],
    ]),
  "sabich-bowl": R(30, 1, [],
    [
      "חותכים חצי חציל לפרוסות, מברישים מעט שמן וצולים בתנור 220 מעלות כ-20 דקות.",
      "מבשלים 2 ביצים 9 דקות ופורסים.",
      "קוצצים עגבנייה ומלפפון לסלט.",
      "מסדרים בקערה ומזליפים כף טחינה; עמבה אם אוהבים.",
    ],
    [
      "Slice half an eggplant, brush with a little oil and roast at 220°C for about 20 minutes.",
      "Boil 2 eggs for 9 minutes and slice.",
      "Chop the tomato and cucumber into a salad.",
      "Arrange in a bowl and drizzle a spoon of tahini; amba if you like it.",
    ],
    [
      ["קלאסי: בחצי פיתה.", "Classic: in half a pita."],
      ["טבעוני: חומוס במקום ביצים.", "Vegan: chickpeas instead of eggs."],
    ]),
  "chicken-tzatziki-bowl": R(30, 1, ["mealPrep"],
    [
      "מבשלים חצי כוס אורז מלא (כ-30 דקות, או מאתמול).",
      "צולים חזה עוף מתובל ופורסים.",
      "מגררים חצי מלפפון, סוחטים ממנו נוזלים ומערבבים עם 3 כפות יוגורט, שום, לימון ומלח.",
      "מסדרים עוף, אורז ומלפפון קצוץ, והרוטב מעל.",
    ],
    [
      "Cook half a cup of brown rice (about 30 minutes, or yesterday's).",
      "Grill the seasoned chicken breast and slice.",
      "Grate half a cucumber, squeeze out the water, mix with 3 spoons of yogurt, garlic, lemon and salt.",
      "Arrange chicken, rice and chopped cucumber, sauce on top.",
    ],
    [
      ["כשר: רוטב טחינה במקום יוגורט.", "Kosher: tahini sauce instead of yogurt."],
      ["צמחוני: פלאפל אפוי במקום עוף.", "Vegetarian: baked falafel instead of chicken."],
    ]),
  "tuna-bean-salad": R(8, 1, ["quick", "noCook", "budget"],
    [
      "מסננים טונה וכוס שעועית לבנה.",
      "פורסים בצל דק וקוצצים פטרוזיליה.",
      "מערבבים הכול עם כף שמן זית, לימון, מלח ופלפל.",
    ],
    [
      "Drain the tuna and a cup of white beans.",
      "Slice the onion thinly and chop the parsley.",
      "Toss everything with a spoon of olive oil, lemon, salt and pepper.",
    ],
    [
      ["צמחוני: ביצה קשה במקום טונה.", "Vegetarian: a boiled egg instead of tuna."],
      ["פחות חריף: בצל סגול מושרה 5 דקות במים.", "Milder: soak the red onion in water for 5 minutes."],
    ]),
  "turkey-hummus-wrap": R(5, 1, ["quick", "noCook"],
    [
      "מורחים כף גדושה חומוס על טורטייה.",
      "מסדרים פרוסות הודו, חסה ועגבנייה.",
      "מגלגלים חזק ועוטפים בנייר אפייה לדרך.",
    ],
    [
      "Spread a heaped spoon of hummus on a tortilla.",
      "Lay on turkey slices, lettuce and tomato.",
      "Roll tightly and wrap in baking paper to take away.",
    ],
    [
      ["טבעוני: פלאפל אפוי במקום הודו.", "Vegan: baked falafel instead of turkey."],
      ["ללא גלוטן: טורטיית תירס.", "Gluten-free: a corn tortilla."],
    ]),
  "sweet-potato-cottage": R(45, 1, ["budget"],
    [
      "מחממים תנור ל-200 מעלות, דוקרים בטטה במזלג.",
      "אופים 40–45 דקות עד שרכה לגמרי (או 10 דקות במיקרו).",
      "חוצים לאורך וממלאים בגביע קוטג׳.",
      "מזליפים כף שמן זית ומפזרים מלח ופלפל.",
    ],
    [
      "Heat the oven to 200°C and prick the sweet potato with a fork.",
      "Bake 40–45 minutes until completely soft (or 10 minutes in the microwave).",
      "Split lengthwise and fill with a tub of cottage cheese.",
      "Drizzle a spoon of olive oil; season with salt and pepper.",
    ],
    [
      ["טבעוני: שעועית שחורה ואבוקדו במקום קוטג׳.", "Vegan: black beans and avocado instead of cottage."],
      ["קליל: כפית שמן זית במקום כף.", "Lighter: a teaspoon of oil instead of a spoon."],
    ]),
  "barley-pepper-salad": R(35, 1, ["mealPrep"],
    [
      "מבשלים חצי כוס גריסי פנינה 30 דקות ומסננים.",
      "צולים פלפל על להבה או בתנור עד שמשחיר, מקלפים ופורסים.",
      "מערבבים את הגריסים החמימים עם הפלפל, פטה ופטרוזיליה.",
      "מזליפים כף שמן זית ולימון.",
    ],
    [
      "Simmer half a cup of pearl barley for 30 minutes; drain.",
      "Char the pepper over a flame or in the oven, peel and slice.",
      "Toss the warm barley with the pepper, feta and parsley.",
      "Drizzle a spoon of olive oil and lemon.",
    ],
    [
      ["ללא גלוטן: קינואה במקום גריסים.", "Gluten-free: quinoa instead of barley."],
      ["טבעוני: בלי פטה, עם חומוס.", "Vegan: skip the feta, add chickpeas."],
    ]),
  "sardines-toast": R(5, 1, ["quick", "noCook", "budget"],
    [
      "קולים פרוסת לחם מלא.",
      "מסדרים פרוסות עגבנייה.",
      "מניחים מעל את הסרדינים ומועכים קלות.",
      "סוחטים לימון ומפזרים פלפל שחור.",
    ],
    [
      "Toast a slice of whole-grain bread.",
      "Lay on tomato slices.",
      "Put the sardines on top and press lightly.",
      "Squeeze lemon and grind black pepper.",
    ],
    [
      ["ללא גלוטן: על פריכייה.", "Gluten-free: on a rice cake."],
      ["עשיר: חצי אבוקדו מעוך מתחת.", "Richer: half a mashed avocado underneath."],
    ]),
  "sausage-cheese-toast": R(10, 1, ["quick", "kids"],
    [
      "פורסים נקניקייה לאורך.",
      "מסדרים על פרוסת לחם: גבינה צהובה, נקניקייה ועגבנייה, ומכסים בפרוסה שנייה.",
      "קולים בטוסטר לחיצה 4–5 דקות עד שהגבינה נמסה.",
    ],
    [
      "Slice the sausage lengthwise.",
      "On a slice of bread lay yellow cheese, the sausage and tomato; cover with a second slice.",
      "Toast in a sandwich press 4–5 minutes until the cheese melts.",
    ],
    [
      ["כשר: בלי נקניק — גבינה ועגבנייה בלבד.", "Kosher: skip the sausage — cheese and tomato only."],
      ["קליל: לחם מלא וגבינה 9%.", "Lighter: whole-grain bread and 9% cheese."],
    ]),
  "oven-schnitzel": R(30, 1, ["kids"],
    [
      "מחממים תנור ל-220 מעלות ומרפדים תבנית בנייר אפייה.",
      "פורסים חזה עוף לשניים לרוחב (או מרדדים לעובי אחיד).",
      "טובלים בביצה טרופה ואז ב-3 כפות פירורי לחם מתובלים במלח ופפריקה.",
      "מסדרים בתבנית, מרססים מעט שמן ואופים 18–20 דקות, הופכים באמצע.",
      "מגישים עם מלפפון ועגבנייה קצוצים.",
    ],
    [
      "Heat the oven to 220°C and line a tray with baking paper.",
      "Butterfly the chicken breast (or pound it to an even thickness).",
      "Dip in beaten egg, then in 3 spoons of breadcrumbs seasoned with salt and paprika.",
      "Lay on the tray, mist with a little oil and bake 18–20 minutes, turning halfway.",
      "Serve with chopped cucumber and tomato.",
    ],
    [
      ["ללא גלוטן: פירורי קורנפלקס ללא גלוטן.", "Gluten-free: gluten-free cornflake crumbs."],
      ["פריך יותר: שומשום בציפוי.", "Crispier: sesame seeds in the coating."],
    ],
    ["עובי אחיד = אפייה אחידה; בלי זה הקצה מתייבש והמרכז לא מוכן.", "Even thickness = even cooking; otherwise the edge dries before the centre is done."]),
  "chicken-shawarma-plate": R(35, 1, ["onePan"],
    [
      "פורסים חזה עוף ובצל לרצועות.",
      "מערבבים עם כפית גדושה בהרט, מלח, לימון וכף שמן.",
      "צולים בתבנית בתנור 220 מעלות כ-20 דקות, מערבבים פעם אחת.",
      "ממלאים פיתה מלאה בעוף, עגבנייה וכף טחינה.",
    ],
    [
      "Cut the chicken breast and onion into strips.",
      "Toss with a heaped teaspoon of baharat, salt, lemon and a spoon of oil.",
      "Roast on a tray at 220°C for about 20 minutes, stirring once.",
      "Fill a wholemeal pita with the chicken, tomato and a spoon of tahini.",
    ],
    [
      ["בצלחת: על אורז במקום פיתה.", "On a plate: over rice instead of pita."],
      ["צמחוני: כרובית במקום עוף, אותה תבלינים.", "Vegetarian: cauliflower instead of chicken, same spices."],
    ]),
  "baked-falafel-bowl": R(35, 2, ["mealPrep"],
    [
      "טוחנים במעבד מזון כוס גרגירי חומוס, חופן פטרוזיליה, חופן כוסברה, שום, כמון ומלח — לא לעיסה חלקה.",
      "יוצרים 8 כדורים קטנים ומשטחים מעט.",
      "מסדרים בתבנית משומנת ואופים ב-200 מעלות כ-25 דקות, הופכים באמצע.",
      "מגישים על חסה ועגבנייה עם כף טחינה.",
    ],
    [
      "Pulse a cup of chickpeas, a handful of parsley, a handful of coriander, garlic, cumin and salt in a food processor — not to a smooth paste.",
      "Shape 8 small balls and flatten slightly.",
      "Bake on an oiled tray at 200°C for about 25 minutes, turning halfway.",
      "Serve over lettuce and tomato with a spoon of tahini.",
    ],
    [
      ["בפיתה: חצי פיתה מלאה.", "In a pita: half a wholemeal pita."],
      ["הכנה מראש: כדורים לא אפויים מחזיקים חודש במקפיא.", "Make ahead: unbaked balls keep a month in the freezer."],
    ],
    ["המסה לא מחזיקה? כף קמח חומוס או פירורי לחם.", "Mix won't hold? A spoon of chickpea flour or breadcrumbs."]),
  "salmon-poke": R(25, 1, [],
    [
      "מבשלים חצי כוס אורז ומקררים מעט.",
      "חותכים נתח סלמון לקוביות (סלמון טרי לסושי, או צולים קלות במחבת).",
      "מערבבים את הסלמון עם כף רוטב סויה.",
      "מסדרים על האורז: סלמון, רבע אבוקדו פרוס, מלפפון וחצי חופן אדממה.",
      "מפזרים שומשום ובצל ירוק.",
    ],
    [
      "Cook half a cup of rice and let it cool a little.",
      "Cube the salmon (sushi-grade raw, or seared briefly in a pan).",
      "Toss the salmon with a spoon of soy sauce.",
      "Arrange over the rice: salmon, a quarter avocado sliced, cucumber and half a handful of edamame.",
      "Scatter sesame and spring onion.",
    ],
    [
      ["צמחוני: טופו מושרה בסויה במקום סלמון.", "Vegetarian: soy-marinated tofu instead of salmon."],
      ["קליל: חצי מנת אורז ועוד מלפפון.", "Lighter: half the rice and more cucumber."],
    ]),
  "tuna-pasta-salad": R(20, 1, ["mealPrep", "kids"],
    [
      "מבשלים מנה קטנה של פסטה לפי ההוראות ושוטפים במים קרים.",
      "מסננים טונה ותירס; חותכים פלפל לקוביות.",
      "מערבבים הכול עם כפית שמן זית, לימון, מלח ופלפל.",
    ],
    [
      "Cook a small portion of pasta as packed and rinse under cold water.",
      "Drain the tuna and sweetcorn; dice the pepper.",
      "Toss everything with a teaspoon of olive oil, lemon, salt and pepper.",
    ],
    [
      ["ללא גלוטן: פסטת עדשים — גם יותר חלבון.", "Gluten-free: lentil pasta — more protein too."],
      ["צמחוני: חומוס במקום טונה.", "Vegetarian: chickpeas instead of tuna."],
    ]),
  "quinoa-tabbouleh": R(25, 1, ["mealPrep"],
    [
      "מבשלים שליש כוס קינואה ב-2/3 כוס מים 15 דקות ומקררים.",
      "קוצצים דק מאוד צרור פטרוזיליה וכמה עלי נענע.",
      "קוצצים עגבנייה ומלפפון לקוביות קטנות.",
      "מערבבים הכול עם לימון, כפית שמן זית ומלח.",
    ],
    [
      "Simmer a third of a cup of quinoa in two-thirds of a cup of water for 15 minutes and cool.",
      "Chop a bunch of parsley and a few mint leaves very finely.",
      "Dice the tomato and cucumber small.",
      "Mix everything with lemon, a teaspoon of olive oil and salt.",
    ],
    [
      ["קלאסי: בורגול במקום קינואה.", "Classic: bulgur instead of quinoa."],
      ["יותר חלבון: חומוס או פטה.", "More protein: chickpeas or feta."],
    ]),
  "lentil-salad": R(10, 1, ["quick", "mealPrep", "budget"],
    [
      "מסננים כוס עדשים מבושלות (שחורות או ירוקות מחזיקות צורה).",
      "קוצצים פלפל, רבע בצל סגול ופטרוזיליה.",
      "מערבבים עם לימון, כפית שמן זית, מלח וכמון.",
    ],
    [
      "Drain a cup of cooked lentils (black or green hold their shape).",
      "Chop the pepper, a quarter red onion and parsley.",
      "Mix with lemon, a teaspoon of olive oil, salt and cumin.",
    ],
    [
      ["עם גבינה: פטה מפוררת.", "With cheese: crumbled feta."],
      ["חם: עם אורז — כמעט מג׳דרה.", "Warm: with rice — almost mujadara."],
    ]),
  "chicken-tahini-salad": R(20, 1, [],
    [
      "צולים חזה עוף מתובל 5–6 דקות מכל צד ופורסים.",
      "חותכים פרוסת לחם מלא לקוביות וקולים במחבת יבשה עד שפריכות.",
      "מערבבים כף טחינה עם לימון, מעט מים ושום לרוטב.",
      "מערבבים 2 חופני חסה עם הרוטב, ומסדרים מעל עוף וקרוטונים.",
    ],
    [
      "Grill the seasoned chicken breast 5–6 minutes a side and slice.",
      "Cube a slice of whole-grain bread and toast in a dry pan until crisp.",
      "Whisk a spoon of tahini with lemon, a little water and garlic into a dressing.",
      "Toss 2 handfuls of lettuce with the dressing; top with chicken and croutons.",
    ],
    [
      ["ללא גלוטן: גרעיני דלעת במקום קרוטונים.", "Gluten-free: pumpkin seeds instead of croutons."],
      ["צמחוני: ביצים קשות במקום עוף.", "Vegetarian: boiled eggs instead of chicken."],
    ]),
  "black-bean-bowl": R(35, 1, ["mealPrep"],
    [
      "מבשלים שליש כוס אורז מלא (או משתמשים בשארית).",
      "מחממים כוס שעועית שחורה עם כמון ומלח.",
      "קוצצים עגבנייה, מסננים תירס ופורסים רבע אבוקדו.",
      "מסדרים הכול בקערה וסוחטים ליים.",
    ],
    [
      "Cook a third of a cup of brown rice (or use leftovers).",
      "Warm a cup of black beans with cumin and salt.",
      "Chop the tomato, drain the sweetcorn, slice a quarter avocado.",
      "Arrange everything in a bowl and squeeze lime over.",
    ],
    [
      ["עם עוף: רצועות עוף בפפריקה.", "With chicken: paprika chicken strips."],
      ["חריף: פלפל חריף וכוסברה.", "Spicy: chilli and coriander."],
    ]),
  "egg-salad-sandwich": R(15, 1, ["kids"],
    [
      "מבשלים 2 ביצים 10 דקות, מקררים ומקלפים.",
      "מועכים במזלג עם 2 כפות יוגורט, שמיר קצוץ, מלח ופלפל.",
      "מורחים על פרוסת לחם מלא, מסדרים מלפפון ומכסים בפרוסה שנייה.",
    ],
    [
      "Boil 2 eggs for 10 minutes, cool and peel.",
      "Mash with a fork with 2 spoons of yogurt, chopped dill, salt and pepper.",
      "Spread on a slice of whole-grain bread, add cucumber, and top with a second slice.",
    ],
    [
      ["ללא גלוטן: בתוך עלי חסה.", "Gluten-free: in lettuce leaves."],
      ["קלאסי: כף מיונז קל במקום יוגורט.", "Classic: a spoon of light mayo instead of yogurt."],
    ]),
  "halloumi-watermelon-salad": R(10, 1, ["quick"],
    [
      "פורסים חלומי וצולים במחבת יבשה דקה-שתיים מכל צד עד שהוא זהוב.",
      "חותכים אבטיח לקוביות.",
      "מסדרים רוקט, אבטיח וחלומי, וקורעים נענע מעל.",
      "טיפת לימון ופלפל שחור.",
    ],
    [
      "Slice the halloumi and sear in a dry pan a minute or two a side until golden.",
      "Cube the watermelon.",
      "Arrange rocket, watermelon and halloumi; tear mint over.",
      "A little lemon and black pepper.",
    ],
    [
      ["קליל: פטה במקום חלומי.", "Lighter: feta instead of halloumi."],
      ["טבעוני: טופו צלוי.", "Vegan: grilled tofu."],
    ]),

  // ─── dinner ───
  "beef-rice": R(25, 1, ["onePan"],
    [
      "מבשלים חצי כוס אורז.",
      "פורסים את הבקר לרצועות דקות נגד כיוון הסיבים.",
      "מקפיצים את הבקר במחבת לוהטת 2–3 דקות ומוציאים.",
      "מקפיצים פלפל ובצל 4 דקות, מחזירים את הבקר עם כף סויה ודקה על האש.",
      "מגישים על האורז.",
    ],
    [
      "Cook half a cup of rice.",
      "Slice the beef into thin strips across the grain.",
      "Sear the beef in a very hot pan for 2–3 minutes and take it out.",
      "Stir-fry pepper and onion 4 minutes, return the beef with a spoon of soy sauce for a minute.",
      "Serve over the rice.",
    ],
    [
      ["קליל: הודו במקום בקר.", "Lighter: turkey instead of beef."],
      ["ללא גלוטן: טמארי.", "Gluten-free: tamari."],
    ],
    ["מחבת לא מלאה מדי — אחרת הבשר מתבשל במקום להיצלות.", "Don't crowd the pan — or the meat stews instead of searing."]),
  "lentil-soup": R(35, 1, ["mealPrep", "budget"],
    [
      "קוצצים בצל וגזר ומטגנים בכף שמן 5 דקות.",
      "מוסיפים כוס עדשים (יבשות: שליש כוס), כפית כמון, מלח ו-3 כוסות מים.",
      "מבשלים 25 דקות עד שהעדשים רכות.",
      "טוחנים חלק או משאירים גס, וסוחטים לימון לפני ההגשה.",
    ],
    [
      "Chop the onion and carrot and soften in a spoon of oil for 5 minutes.",
      "Add the lentils (a third of a cup dry), a teaspoon of cumin, salt and 3 cups of water.",
      "Simmer 25 minutes until the lentils are soft.",
      "Blend smooth or leave chunky; squeeze lemon before serving.",
    ],
    [
      ["כתום: עדשים כתומות מתבשלות ב-15 דקות.", "Orange: red lentils cook in 15 minutes."],
      ["הכנה מראש: סיר גדול מחזיק 4 ימים ומוקפא מצוין.", "Make ahead: a big pot keeps 4 days and freezes well."],
    ]),
  "tofu-stirfry": R(25, 1, ["onePan"],
    [
      "מבשלים חצי כוס אורז.",
      "חותכים טופו לקוביות, מייבשים במגבת ומשחימים בכף שמן 6–8 דקות.",
      "מוסיפים פלפל וברוקולי ומקפיצים 4 דקות.",
      "מוסיפים כף רוטב סויה ומעט ג׳ינג׳ר, ומגישים על האורז.",
    ],
    [
      "Cook half a cup of rice.",
      "Cube the tofu, pat dry and brown in a spoon of oil for 6–8 minutes.",
      "Add the pepper and broccoli and stir-fry 4 minutes.",
      "Add a spoon of soy sauce and a little ginger; serve over the rice.",
    ],
    [
      ["פריך יותר: טופו בקורנפלור לפני הטיגון.", "Crispier: toss the tofu in cornflour first."],
      ["עם עוף: חזה עוף במקום טופו.", "With chicken: chicken breast instead of tofu."],
    ]),
  "salmon-quinoa": R(25, 1, [],
    [
      "מבשלים חצי כוס קינואה 15 דקות.",
      "מניחים פילה סלמון בתבנית, מלח, פלפל ולימון, ואופים ב-200 מעלות כ-12–14 דקות.",
      "מקפיצים חופן תרד עם שום דקה אחת.",
      "מגישים יחד.",
    ],
    [
      "Simmer half a cup of quinoa for 15 minutes.",
      "Lay the salmon fillet in a dish with salt, pepper and lemon; bake at 200°C for 12–14 minutes.",
      "Wilt a handful of spinach with garlic for a minute.",
      "Serve together.",
    ],
    [
      ["זול: פילה מושט או טילאפיה.", "Cheaper: tilapia fillet."],
      ["עם טחינה: כף טחינה ולימון מעל.", "With tahini: a spoon of tahini and lemon on top."],
    ]),
  "fish-potato": R(35, 1, ["onePan"],
    [
      "חותכים תפוח אדמה לפלחים, מערבבים עם מעט שמן ומלח ואופים ב-200 מעלות כ-20 דקות.",
      "מוסיפים לתבנית פילה דג, מלח, פלפל ופרוסות לימון.",
      "אופים עוד 12 דקות, עד שהדג מתפרק במזלג.",
      "מגישים עם סלט.",
    ],
    [
      "Cut the potato into wedges, toss with a little oil and salt and roast at 200°C for 20 minutes.",
      "Add the fish fillet to the tray with salt, pepper and lemon slices.",
      "Roast 12 more minutes, until the fish flakes with a fork.",
      "Serve with salad.",
    ],
    [
      ["קליל: ירקות קלויים במקום תפוח אדמה.", "Lighter: roast vegetables instead of potato."],
      ["מזרחי: כמון ופפריקה על הדג.", "Middle-Eastern: cumin and paprika on the fish."],
    ]),
  "pasta-veg": R(20, 1, ["budget", "kids"],
    [
      "מבשלים מנת פסטה במים רותחים ומומלחים.",
      "מטגנים בצל קצוץ בכפית שמן זית 4 דקות, מוסיפים קישוא חתוך.",
      "מוסיפים עגבנייה קצוצה (או רוטב), מלח ובזיליקום ומבשלים 8 דקות.",
      "מערבבים עם הפסטה ומגישים.",
    ],
    [
      "Cook a portion of pasta in boiling salted water.",
      "Soften the chopped onion in a teaspoon of olive oil for 4 minutes; add the sliced zucchini.",
      "Add chopped tomato (or sauce), salt and basil; simmer 8 minutes.",
      "Toss with the pasta and serve.",
    ],
    [
      ["יותר חלבון: פסטת עדשים או גבינה מגוררת.", "More protein: lentil pasta or grated cheese."],
      ["ללא גלוטן: פסטת אורז.", "Gluten-free: rice pasta."],
    ]),
  "baked-potato-cottage": R(45, 1, ["budget"],
    [
      "מחממים תנור ל-200 מעלות ודוקרים תפוח אדמה במזלג.",
      "אופים 45 דקות (או 8 דקות במיקרו ואז 10 בתנור לקליפה).",
      "חוצים וממלאים בגביע קוטג׳, מלח, פלפל ובצל ירוק.",
      "מגישים עם מלפפון.",
    ],
    [
      "Heat the oven to 200°C and prick the potato with a fork.",
      "Bake 45 minutes (or 8 minutes in the microwave then 10 in the oven for the skin).",
      "Split and fill with a tub of cottage cheese, salt, pepper and spring onion.",
      "Serve with cucumber.",
    ],
    [
      ["טבעוני: חומוס ופטרוזיליה במקום קוטג׳.", "Vegan: hummus and parsley instead of cottage."],
      ["מתוק: בטטה במקום תפוח אדמה.", "Sweeter: a sweet potato instead."],
    ]),
  "cheeseburger": R(20, 1, ["kids"],
    [
      "מעצבים קציצה מ-120 ג׳ בשר טחון, מלח ופלפל — לא לדחוס.",
      "צולים במחבת לוהטת 4 דקות מכל צד.",
      "בדקה האחרונה מניחים 2 פרוסות גבינה צהובה ומכסים שתימס.",
      "מגישים בלחמנייה עם עגבנייה ובצל.",
    ],
    [
      "Shape a patty from 120 g of minced beef with salt and pepper — don't pack it tight.",
      "Sear in a very hot pan 4 minutes a side.",
      "In the last minute add 2 slices of yellow cheese and cover to melt.",
      "Serve in a bun with tomato and onion.",
    ],
    [
      ["כשר: בלי גבינה — חסה וטחינה.", "Kosher: no cheese — lettuce and tahini."],
      ["קליל: בורגר הודו.", "Lighter: a turkey burger."],
    ]),
  "creamy-beef-pasta": R(25, 1, [],
    [
      "מבשלים מנת פסטה.",
      "פורסים בקר לרצועות דקות ומשחימים במחבת לוהטת 2–3 דקות.",
      "מוסיפים פטריות ומקפיצים 4 דקות.",
      "מוסיפים 2 כפות גבינת שמנת עם מעט ממי הפסטה עד שנוצר רוטב, ומערבבים עם הפסטה.",
    ],
    [
      "Cook a portion of pasta.",
      "Cut the beef into thin strips and sear in a very hot pan for 2–3 minutes.",
      "Add the mushrooms and stir-fry 4 minutes.",
      "Stir in 2 spoons of cream cheese with a little pasta water to make a sauce; toss with the pasta.",
    ],
    [
      ["כשר: קרם קוקוס במקום גבינת שמנת.", "Kosher: coconut cream instead of cream cheese."],
      ["צמחוני: רק פטריות, כפול.", "Vegetarian: mushrooms only, double."],
    ]),
  "shrimp-stirfry": R(25, 1, ["onePan"],
    [
      "מבשלים חצי כוס אורז.",
      "מחממים כף שמן זית במחבת גבוהה ומקפיצים ברוקולי ופלפל 4 דקות.",
      "מוסיפים שרימפס ושום ומקפיצים 3 דקות עד שהם ורודים.",
      "מתבלים במלח, צ׳ילי ולימון, ומגישים על האורז.",
    ],
    [
      "Cook half a cup of rice.",
      "Heat a spoon of olive oil in a deep pan and stir-fry broccoli and pepper for 4 minutes.",
      "Add the shrimp and garlic and stir-fry 3 minutes until pink.",
      "Season with salt, chilli and lemon; serve over the rice.",
    ],
    [
      ["כשר: קוביות סלמון או עוף במקום שרימפס.", "Kosher: salmon or chicken cubes instead of shrimp."],
      ["קליל: אורז כרובית.", "Lighter: cauliflower rice."],
    ]),
  "lamb-yogurt-bowl": R(35, 2, [],
    [
      "משרים חצי כוס בורגול במים רותחים ומלח ל-15 דקות.",
      "צולים את הכבש במחבת לוהטת 4 דקות מכל צד ומניחים 5 דקות.",
      "מטגנים בצל פרוס עד שהוא שחום.",
      "מסדרים בורגול, כבש פרוס ובצל; 2 כפות יוגורט ונענע מעל.",
    ],
    [
      "Soak half a cup of bulgur in boiling salted water for 15 minutes.",
      "Sear the lamb in a very hot pan 4 minutes a side and rest 5 minutes.",
      "Fry the sliced onion until browned.",
      "Arrange bulgur, sliced lamb and onion; 2 spoons of yogurt and mint on top.",
    ],
    [
      ["כשר: טחינה במקום יוגורט.", "Kosher: tahini instead of yogurt."],
      ["קליל: עוף במקום כבש.", "Lighter: chicken instead of lamb."],
    ]),
  "salmon-veg": R(35, 1, ["onePan"],
    [
      "חותכים בטטה לקוביות וצולים ב-200 מעלות כ-15 דקות.",
      "מוסיפים לתבנית ברוקולי ופילה סלמון עם מלח, פלפל ולימון.",
      "אופים עוד 12–14 דקות.",
    ],
    [
      "Cube the sweet potato and roast at 200°C for 15 minutes.",
      "Add broccoli and the salmon fillet to the tray with salt, pepper and lemon.",
      "Roast 12–14 more minutes.",
    ],
    [
      ["זול: מקרל או דג לבן.", "Cheaper: mackerel or white fish."],
      ["מתובל: שום ושמיר על הסלמון.", "More flavour: garlic and dill on the salmon."],
    ]),
  "sardines-salad": R(8, 1, ["quick", "noCook", "budget"],
    [
      "קורעים חסה לקערה ומוסיפים עגבנייה חתוכה.",
      "מסדרים את הסרדינים מעל.",
      "סוחטים לימון ומפזרים פלפל שחור ומלח.",
    ],
    [
      "Tear lettuce into a bowl and add cut tomato.",
      "Lay the sardines on top.",
      "Squeeze lemon; season with black pepper and salt.",
    ],
    [
      ["משביע: תפוח אדמה מבושל.", "More filling: a boiled potato."],
      ["אחר: טונה במקום סרדינים.", "Swap: tuna instead of sardines."],
    ]),
  "chicken-cauliflower": R(40, 1, ["onePan"],
    [
      "מחממים תנור ל-200 מעלות.",
      "מערבבים פרחי כרובית עם כף שמן זית, 2 שיני שום כתושות, מלח ופפריקה.",
      "מניחים בתבנית עם חזה עוף מתובל.",
      "אופים 25–30 דקות, עד שהכרובית שחומה והעוף מוכן.",
    ],
    [
      "Heat the oven to 200°C.",
      "Toss the cauliflower florets with a spoon of olive oil, 2 crushed garlic cloves, salt and paprika.",
      "Lay on a tray with the seasoned chicken breast.",
      "Roast 25–30 minutes, until the cauliflower browns and the chicken is cooked.",
    ],
    [
      ["צמחוני: חומוס במקום עוף.", "Vegetarian: chickpeas instead of chicken."],
      ["עם טחינה: כף טחינה מעל הכרובית.", "With tahini: a spoon of tahini over the cauliflower."],
    ]),
  "bean-stew": R(30, 1, ["mealPrep", "budget"],
    [
      "מטגנים בצל ושום בכף שמן 5 דקות.",
      "מוסיפים עגבנייה קצוצה, פפריקה, כמון ומלח ומבשלים 5 דקות.",
      "מוסיפים כוס שעועית מבושלת וחצי כוס מים ומבשלים 15 דקות.",
      "מגישים עם אורז או לחם.",
    ],
    [
      "Soften the onion and garlic in a spoon of oil for 5 minutes.",
      "Add chopped tomato, paprika, cumin and salt; simmer 5 minutes.",
      "Add a cup of cooked beans and half a cup of water; simmer 15 minutes.",
      "Serve with rice or bread.",
    ],
    [
      ["עם בשר: קוביות בקר מבושלות לאט.", "With meat: slow-cooked beef cubes."],
      ["הכנה מראש: טעים יותר למחרת.", "Make ahead: even better the next day."],
    ]),
  "omelette-mushroom": R(15, 1, ["quick"],
    [
      "מקפיצים בצל ופטריות פרוסים 5 דקות.",
      "טורפים 2 ביצים עם מלח ויוצקים מעל.",
      "מפזרים 2 פרוסות גבינה צהובה קרועות, מקפלים ומכסים דקה.",
    ],
    [
      "Stir-fry the sliced onion and mushrooms for 5 minutes.",
      "Beat 2 eggs with salt and pour over.",
      "Tear 2 slices of yellow cheese over, fold and cover for a minute.",
    ],
    [
      ["קליל: בלי גבינה, עוד חלבון ביצה.", "Lighter: no cheese, an extra egg white."],
      ["ירוק: תרד עם הפטריות.", "Greener: spinach with the mushrooms."],
    ]),
  "edamame-rice": R(20, 1, [],
    [
      "מבשלים חצי כוס אורז.",
      "מבשלים אדממה (ללא תרמיל) 4 דקות במים רותחים.",
      "מגררים גזר ומקפיצים דקה עם חופן תרד.",
      "מערבבים הכול עם כף סויה ושומשום.",
    ],
    [
      "Cook half a cup of rice.",
      "Boil the shelled edamame for 4 minutes.",
      "Grate the carrot and stir-fry for a minute with a handful of spinach.",
      "Toss everything with a spoon of soy sauce and sesame.",
    ],
    [
      ["יותר חלבון: ביצה עלומה מעל.", "More protein: a poached egg on top."],
      ["ללא גלוטן: טמארי.", "Gluten-free: tamari."],
    ]),
  "stuffed-pepper": R(55, 2, ["mealPrep"],
    [
      "חותכים כובע לפלפל ומוציאים את הזרעים.",
      "מערבבים כמה כפות בשר טחון עם רבע כוס אורז לא מבושל, מלח, פלפל ובהרט.",
      "ממלאים את הפלפל עד שלושה רבעים (האורז תופח).",
      "מעמידים בסיר, יוצקים עגבנייה מרוסקת ומים עד חצי גובה, מכסים ומבשלים 45 דקות על אש נמוכה.",
    ],
    [
      "Cut a lid off the pepper and remove the seeds.",
      "Mix a few spoons of minced beef with a quarter cup of raw rice, salt, pepper and baharat.",
      "Fill the pepper three-quarters full (the rice swells).",
      "Stand in a pot, pour crushed tomato and water halfway up, cover and simmer 45 minutes on low.",
    ],
    [
      ["צמחוני: אורז, עדשים וצנוברים.", "Vegetarian: rice, lentils and pine nuts."],
      ["בתנור: 50 דקות ב-180 מעלות מכוסה.", "Oven: 50 minutes at 180°C, covered."],
    ]),
  "eggplant-tahini": R(35, 1, [],
    [
      "צולים חצי חציל על להבת הגז או בתנור 220 מעלות עד שהקליפה שחורה והפנים רך.",
      "מוציאים את הבשר בכף.",
      "מסדרים בצלחת עם עגבנייה קצוצה, כף טחינה, לימון ומלח.",
    ],
    [
      "Char half an eggplant over a gas flame or at 220°C in the oven until the skin blackens and the inside is soft.",
      "Scoop out the flesh.",
      "Arrange on a plate with chopped tomato, a spoon of tahini, lemon and salt.",
    ],
    [
      ["משביע: עם ביצה קשה ופיתה.", "More filling: with a boiled egg and pita."],
      ["עם שום: שן שום כתושה בטחינה.", "Garlicky: a crushed clove in the tahini."],
    ]),
  "noodle-veg": R(20, 1, ["onePan"],
    [
      "מבשלים חופן אטריות לפי ההוראות ומסננים.",
      "משחימים קוביות טופו בכף שמן 5 דקות.",
      "מוסיפים ברוקולי וגזר פרוס ומקפיצים 4 דקות.",
      "מוסיפים את האטריות וכף סויה ומקפיצים דקה.",
    ],
    [
      "Cook a handful of noodles as packed and drain.",
      "Brown the tofu cubes in a spoon of oil for 5 minutes.",
      "Add broccoli and sliced carrot and stir-fry 4 minutes.",
      "Add the noodles and a spoon of soy sauce and toss for a minute.",
    ],
    [
      ["עם עוף: רצועות עוף במקום טופו.", "With chicken: chicken strips instead of tofu."],
      ["ללא גלוטן: אטריות אורז וטמארי.", "Gluten-free: rice noodles and tamari."],
    ]),
  "buckwheat-mushroom-egg": R(25, 1, [],
    [
      "מבשלים חצי כוס כוסמת בכוס מים ומלח 12 דקות.",
      "מטגנים בצל ופטריות 6 דקות.",
      "מערבבים את הכוסמת לתוך המחבת.",
      "עושים 2 גומות, שוברים ביצים, מכסים 4 דקות.",
    ],
    [
      "Simmer half a cup of buckwheat in a cup of salted water for 12 minutes.",
      "Fry the onion and mushrooms for 6 minutes.",
      "Stir the buckwheat into the pan.",
      "Make 2 wells, crack in the eggs, cover 4 minutes.",
    ],
    [
      ["טבעוני: בלי ביצים, עם חומוס.", "Vegan: skip the eggs, add chickpeas."],
      ["עשיר: כף שמנת חמוצה מעל.", "Richer: a spoon of sour cream on top."],
    ]),
  "salmon-asparagus-rice": R(35, 1, [],
    [
      "מבשלים חצי כוס אורז מלא (30 דקות).",
      "אופים פילה סלמון מתובל ב-200 מעלות כ-12–14 דקות.",
      "צולים אספרגוס במחבת עם טיפת שמן ומלח 5 דקות.",
      "מגישים עם לימון.",
    ],
    [
      "Cook half a cup of brown rice (30 minutes).",
      "Bake the seasoned salmon fillet at 200°C for 12–14 minutes.",
      "Sear the asparagus in a pan with a drop of oil and salt for 5 minutes.",
      "Serve with lemon.",
    ],
    [
      ["מהיר: אורז מאתמול.", "Faster: yesterday's rice."],
      ["ירקות אחרים: שעועית ירוקה במקום אספרגוס.", "Other veg: green beans instead of asparagus."],
    ]),
  "tempeh-stirfry": R(35, 1, [],
    [
      "מבשלים חצי כוס אורז מלא.",
      "פורסים טמפה ומשחימים בכף שמן 3 דקות מכל צד.",
      "מוסיפים ברוקולי ושום ומקפיצים 4 דקות.",
      "מוסיפים כף סויה ומגישים על האורז.",
    ],
    [
      "Cook half a cup of brown rice.",
      "Slice the tempeh and brown in a spoon of oil 3 minutes a side.",
      "Add broccoli and garlic and stir-fry 4 minutes.",
      "Add a spoon of soy sauce and serve over the rice.",
    ],
    [
      ["רך יותר: מאדים את הטמפה 10 דקות לפני.", "Milder: steam the tempeh 10 minutes first."],
      ["ללא גלוטן: טמארי.", "Gluten-free: tamari."],
    ]),
  "pumpkin-lentil-soup": R(35, 1, ["mealPrep", "budget"],
    [
      "מטגנים בצל קצוץ בכף שמן זית 5 דקות.",
      "מוסיפים קוביות דלעת, עדשים כתומות (שליש כוס יבש), כמון, מלח ו-3 כוסות מים.",
      "מבשלים 25 דקות עד שהכול רך.",
      "טוחנים חלק במוט ומגישים עם לימון.",
    ],
    [
      "Soften the chopped onion in a spoon of olive oil for 5 minutes.",
      "Add pumpkin cubes, red lentils (a third of a cup dry), cumin, salt and 3 cups of water.",
      "Simmer 25 minutes until everything is soft.",
      "Blend smooth and serve with lemon.",
    ],
    [
      ["עשיר: כף יוגורט מעל.", "Richer: a spoon of yogurt on top."],
      ["חם: ג׳ינג׳ר וצ׳ילי.", "Warming: ginger and chilli."],
    ]),
  "brussels-egg-bowl": R(30, 1, [],
    [
      "חוצים כרוב ניצנים, מערבבים עם כף שמן זית ומלח וצולים ב-220 מעלות כ-20 דקות.",
      "מבשלים 2 ביצים 9 דקות.",
      "מסדרים בקערה, חוצים את הביצים ומפזרים כף גרעיני דלעת.",
    ],
    [
      "Halve the Brussels sprouts, toss with a spoon of olive oil and salt, roast at 220°C for 20 minutes.",
      "Boil 2 eggs for 9 minutes.",
      "Arrange in a bowl, halve the eggs, scatter a spoon of pumpkin seeds.",
    ],
    [
      ["טבעוני: טופו קלוי במקום ביצים.", "Vegan: roast tofu instead of eggs."],
      ["מתוק: כפית סילאן על הכרוב.", "Sweet: a teaspoon of date syrup on the sprouts."],
    ]),
  "mujadara": R(40, 1, ["budget", "mealPrep"],
    [
      "פורסים בצל גדול לפרוסות דקות ומטגנים בכף שמן זית 20 דקות על אש בינונית, עד שחום ומתוק.",
      "בינתיים מבשלים שליש כוס עדשים חומות 10 דקות.",
      "מוסיפים חצי כוס אורז, כמון, מלח ומים לכסות, ומבשלים מכוסה 18 דקות.",
      "מגישים עם הבצל מעל ויוגורט או סלט לצד.",
    ],
    [
      "Slice a big onion thinly and fry in a spoon of olive oil for 20 minutes over medium heat, until brown and sweet.",
      "Meanwhile simmer a third of a cup of brown lentils for 10 minutes.",
      "Add half a cup of rice, cumin, salt and water to cover; cook covered for 18 minutes.",
      "Serve with the onion on top and yogurt or salad alongside.",
    ],
    [
      ["ללא אורז: בורגול במקום.", "No rice: bulgur instead."],
      ["טבעוני ומלא: עם סלט ירקות וטחינה.", "Vegan and complete: with chopped salad and tahini."],
    ],
    ["הבצל הוא הסוד — לא למהר איתו.", "The onion is the secret — don't rush it."]),
  "red-lentil-curry": R(30, 1, ["mealPrep", "budget"],
    [
      "מטגנים בצל ושום בכף שמן 5 דקות.",
      "מוסיפים כפית קארי או כורכום וכמון, ועגבנייה קצוצה.",
      "מוסיפים עדשים כתומות (שליש כוס יבש) ו-1.5 כוסות מים, ומבשלים 15 דקות עד שהן נמסות.",
      "מגישים על אורז מלא.",
    ],
    [
      "Soften the onion and garlic in a spoon of oil for 5 minutes.",
      "Add a teaspoon of curry powder or turmeric and cumin, and the chopped tomato.",
      "Add red lentils (a third of a cup dry) and 1½ cups of water; simmer 15 minutes until they melt.",
      "Serve over brown rice.",
    ],
    [
      ["קרמי: חצי כוס חלב קוקוס.", "Creamy: half a cup of coconut milk."],
      ["עם עוף: קוביות עוף ב-10 הדקות האחרונות.", "With chicken: chicken cubes for the last 10 minutes."],
    ]),
  "cottage-pasta": R(20, 1, ["budget", "kids"],
    [
      "מבשלים מנת פסטה.",
      "מטגנים שום ועגבנייה קצוצה 5 דקות.",
      "מורידים מהאש ומערבבים גביע קוטג׳ ומעט ממי הפסטה — נוצר רוטב קרמי.",
      "מערבבים עם הפסטה, מלח ופלפל.",
    ],
    [
      "Cook a portion of pasta.",
      "Fry garlic and chopped tomato for 5 minutes.",
      "Off the heat stir in a tub of cottage cheese and a little pasta water — it turns into a creamy sauce.",
      "Toss with the pasta, salt and pepper.",
    ],
    [
      ["חלק: טוחנים את הקוטג׳ לפני.", "Smoother: blend the cottage cheese first."],
      ["ירוק: חופן תרד ברוטב.", "Greener: a handful of spinach in the sauce."],
    ]),
  "sheetpan-chicken": R(45, 1, ["onePan", "mealPrep"],
    [
      "מחממים תנור ל-210 מעלות.",
      "חותכים פלפל, קישוא ותפוח אדמה לחתיכות דומות בגודלן.",
      "מערבבים עם כף שמן זית, מלח, פפריקה ושום ומפזרים בתבנית.",
      "מניחים חזה עוף מתובל מעל ואופים 35–40 דקות.",
    ],
    [
      "Heat the oven to 210°C.",
      "Cut the pepper, zucchini and potato into similar-sized pieces.",
      "Toss with a spoon of olive oil, salt, paprika and garlic; spread on a tray.",
      "Lay the seasoned chicken breast on top and roast 35–40 minutes.",
    ],
    [
      ["צמחוני: חומוס וחלומי במקום עוף.", "Vegetarian: chickpeas and halloumi instead of chicken."],
      ["הכנה מראש: כפול כמות, 3 ימים במקרר.", "Make ahead: double it; keeps 3 days."],
    ]),
  "salmon-tomato-skillet": R(20, 1, ["onePan"],
    [
      "מטגנים 2 שיני שום פרוסות וקוביות עגבנייה בכף שמן 4 דקות.",
      "מניחים חופן תרד ומעליו פילה סלמון מתובל.",
      "מכסים ומבשלים 8–10 דקות על אש בינונית-נמוכה.",
    ],
    [
      "Fry 2 sliced garlic cloves and diced tomato in a spoon of oil for 4 minutes.",
      "Lay a handful of spinach and the seasoned salmon fillet on top.",
      "Cover and cook 8–10 minutes over medium-low heat.",
    ],
    [
      ["זול: דג לבן.", "Cheaper: white fish."],
      ["חריף: צ׳ילי ברוטב.", "Spicy: chilli in the sauce."],
    ]),
  "chickpea-spinach-stew": R(25, 1, ["mealPrep", "budget"],
    [
      "מטגנים בצל קצוץ 5 דקות.",
      "מוסיפים עגבנייה, כמון, פפריקה ומלח ומבשלים 5 דקות.",
      "מוסיפים כוס גרגירי חומוס וחצי כוס מים ומבשלים 10 דקות.",
      "מוסיפים חופן תרד בסוף ומערבבים עד שקמל.",
    ],
    [
      "Soften the chopped onion for 5 minutes.",
      "Add tomato, cumin, paprika and salt; simmer 5 minutes.",
      "Add a cup of chickpeas and half a cup of water; simmer 10 minutes.",
      "Stir in a handful of spinach at the end until wilted.",
    ],
    [
      ["עם ביצה: ביצה עלומה מעל.", "With egg: a poached egg on top."],
      ["עם יוגורט: כף יוגורט לימוני.", "With yogurt: a spoon of lemony yogurt."],
    ]),
  "tofu-buckwheat-stirfry": R(25, 1, [],
    [
      "מבשלים חצי כוס כוסמת 12 דקות.",
      "משחימים קוביות טופו בכף שמן 6 דקות.",
      "מוסיפים ברוקולי ושום ומקפיצים 4 דקות.",
      "מגישים על הכוסמת עם כף סויה.",
    ],
    [
      "Simmer half a cup of buckwheat for 12 minutes.",
      "Brown the tofu cubes in a spoon of oil for 6 minutes.",
      "Add broccoli and garlic and stir-fry 4 minutes.",
      "Serve over the buckwheat with a spoon of soy sauce.",
    ],
    [
      ["ללא גלוטן: טמארי (הכוסמת עצמה ללא גלוטן).", "Gluten-free: tamari (buckwheat itself is gluten-free)."],
      ["עם עוף: עוף במקום טופו.", "With chicken: chicken instead of tofu."],
    ]),
  "chicken-meatballs": R(40, 1, ["mealPrep", "kids"],
    [
      "מגררים חצי בצל, מערבבים עם חזה עוף טחון, שום, מלח ופלפל.",
      "יוצרים קציצות קטנות בידיים רטובות.",
      "מביאים לרתיחה חצי כוס רוטב עגבניות עם חצי כוס מים.",
      "מכניסים את הקציצות, מכסים ומבשלים 20 דקות על אש נמוכה.",
      "מגישים על אורז.",
    ],
    [
      "Grate half an onion and mix with minced chicken breast, garlic, salt and pepper.",
      "Shape small balls with wet hands.",
      "Bring half a cup of tomato sauce and half a cup of water to a simmer.",
      "Add the meatballs, cover and cook 20 minutes on low.",
      "Serve over rice.",
    ],
    [
      ["ללא גלוטן: בלי פירורי לחם — הבצל מחזיק.", "Gluten-free: no breadcrumbs needed — the onion binds it."],
      ["צמחוני: קציצות עדשים.", "Vegetarian: lentil balls."],
    ]),
  "fish-chraime": R(30, 1, ["onePan"],
    [
      "מטגנים שום ופלפל פרוס בכף שמן 3 דקות.",
      "מוסיפים חצי כוס רוטב עגבניות, כפית פפריקה, קורט כמון, צ׳ילי ומלח ומבשלים 8 דקות.",
      "מניחים את פילה הדג ברוטב, מכסים ומבשלים 10–12 דקות.",
      "מפזרים כוסברה ומגישים עם לחם או אורז.",
    ],
    [
      "Fry garlic and sliced pepper in a spoon of oil for 3 minutes.",
      "Add half a cup of tomato sauce, a teaspoon of paprika, a pinch of cumin, chilli and salt; simmer 8 minutes.",
      "Lay the fish fillet in the sauce, cover and cook 10–12 minutes.",
      "Scatter coriander and serve with bread or rice.",
    ],
    [
      ["פחות חריף: בלי צ׳ילי, רק פפריקה מתוקה.", "Milder: no chilli, sweet paprika only."],
      ["דגים: לוקוס, מושט או סלמון.", "Fish: grouper, tilapia or salmon."],
    ]),
  "beef-lentil-bolognese": R(40, 1, ["mealPrep", "kids"],
    [
      "מטגנים בצל קצוץ 5 דקות, מוסיפים 100 ג׳ בשר טחון ומפוררים עד שמשחים.",
      "מוסיפים חצי כוס עדשים מבושלות וחצי כוס רוטב עגבניות, מלח ואורגנו.",
      "מבשלים מכוסה 20 דקות.",
      "מבשלים פסטה ומערבבים עם הרוטב.",
    ],
    [
      "Soften the chopped onion for 5 minutes, add 100 g of minced beef and break it up until browned.",
      "Add half a cup of cooked lentils and half a cup of tomato sauce, salt and oregano.",
      "Simmer covered for 20 minutes.",
      "Cook the pasta and toss with the sauce.",
    ],
    [
      ["צמחוני: כפול עדשים, בלי בשר.", "Vegetarian: double lentils, no meat."],
      ["ללא גלוטן: פסטת עדשים.", "Gluten-free: lentil pasta."],
    ],
    ["העדשים נעלמות ברוטב — הילדים לא ישימו לב.", "The lentils vanish into the sauce — kids won't notice."]),
  "stuffed-zucchini": R(60, 2, ["mealPrep"],
    [
      "חוצים 2 קישואים לאורך ומרוקנים בכפית.",
      "מערבבים בשר טחון עם רבע כוס אורז, מלח, פלפל ובהרט.",
      "ממלאים את הקישואים ומסדרים בסיר רחב.",
      "יוצקים חצי כוס רוטב עגבניות ומים עד חצי גובה, מכסים ומבשלים 45 דקות.",
    ],
    [
      "Halve 2 zucchini lengthwise and hollow them with a teaspoon.",
      "Mix minced beef with a quarter cup of rice, salt, pepper and baharat.",
      "Fill the zucchini and arrange in a wide pot.",
      "Pour half a cup of tomato sauce and water halfway up; cover and cook 45 minutes.",
    ],
    [
      ["צמחוני: אורז, עדשים ועשבי תיבול.", "Vegetarian: rice, lentils and herbs."],
      ["בתנור: 45 דקות ב-180 מעלות מכוסה.", "Oven: 45 minutes at 180°C, covered."],
    ]),
  "shepherds-pie": R(50, 2, ["mealPrep", "kids"],
    [
      "מבשלים תפוח אדמה עד שרך ומועכים עם מלח ומעט ממי הבישול.",
      "מטגנים בצל וגזר קצוצים 5 דקות, מוסיפים 120 ג׳ בשר טחון ומשחימים.",
      "מוסיפים אפונה, מלח ופלפל ומעט מים ומבשלים 10 דקות.",
      "מעבירים לכלי אפייה, מכסים בפירה ואופים ב-200 מעלות כ-20 דקות.",
    ],
    [
      "Boil the potato until soft and mash with salt and a little cooking water.",
      "Soften the chopped onion and carrot for 5 minutes, add 120 g of minced beef and brown it.",
      "Add peas, salt, pepper and a little water; simmer 10 minutes.",
      "Spoon into a baking dish, cover with the mash and bake at 200°C for 20 minutes.",
    ],
    [
      ["צמחוני: עדשים ופטריות במקום בשר.", "Vegetarian: lentils and mushrooms instead of meat."],
      ["קליל: פירה כרובית.", "Lighter: cauliflower mash."],
    ]),
  "chicken-turmeric-curry": R(35, 1, ["onePan"],
    [
      "מבשלים חצי כוס אורז.",
      "מטגנים בצל קצוץ 5 דקות, מוסיפים כפית כורכום וכפית כמון לחצי דקה.",
      "מוסיפים קוביות עוף ומשחימים 5 דקות.",
      "מוסיפים עגבנייה קצוצה וחצי כוס מים ומבשלים 15 דקות.",
      "מגישים על האורז.",
    ],
    [
      "Cook half a cup of rice.",
      "Soften the chopped onion for 5 minutes, add a teaspoon each of turmeric and cumin for half a minute.",
      "Add the chicken cubes and brown for 5 minutes.",
      "Add chopped tomato and half a cup of water; simmer 15 minutes.",
      "Serve over the rice.",
    ],
    [
      ["קרמי: חלב קוקוס.", "Creamy: coconut milk."],
      ["צמחוני: חומוס ובטטה.", "Vegetarian: chickpeas and sweet potato."],
    ]),
  "salmon-teriyaki": R(35, 1, [],
    [
      "מבשלים חצי כוס אורז מלא.",
      "מערבבים כף סויה עם כפית דבש וג׳ינג׳ר מגורד.",
      "מברישים את הסלמון ואופים ב-200 מעלות כ-12 דקות, מברישים שוב באמצע.",
      "מאדים ברוקולי 5 דקות ומגישים הכול יחד עם שומשום.",
    ],
    [
      "Cook half a cup of brown rice.",
      "Mix a spoon of soy sauce with a teaspoon of honey and grated ginger.",
      "Brush the salmon and bake at 200°C for about 12 minutes, brushing again halfway.",
      "Steam the broccoli 5 minutes and serve together with sesame.",
    ],
    [
      ["ללא גלוטן: טמארי.", "Gluten-free: tamari."],
      ["טבעוני: טופו באותו רוטב.", "Vegan: tofu in the same glaze."],
    ]),
  "turkey-burger": R(20, 1, ["kids"],
    [
      "מערבבים הודו טחון עם מלח, פלפל ומעט בצל מגורד ומעצבים קציצה.",
      "צולים במחבת פסים 5 דקות מכל צד, עד שמוכן לגמרי.",
      "קולים לחמנייה.",
      "מרכיבים עם חסה, עגבנייה וטבעת בצל.",
    ],
    [
      "Mix minced turkey with salt, pepper and a little grated onion; shape a patty.",
      "Cook in a grill pan 5 minutes a side, until cooked through.",
      "Toast the bun.",
      "Build with lettuce, tomato and an onion ring.",
    ],
    [
      ["ללא גלוטן: בעלה חסה.", "Gluten-free: in a lettuce wrap."],
      ["צמחוני: בורגר עדשים או קציצה צמחית.", "Vegetarian: a lentil or plant-based patty."],
    ]),
  "roasted-cauliflower-tahini": R(45, 1, ["budget"],
    [
      "מחממים תנור ל-220 מעלות.",
      "חוצים כרובית, מברישים שמן זית ומלח ואופים 35–40 דקות עד שהיא שחומה.",
      "מחממים חצי כוס חומוס עם כמון.",
      "מגישים עם טחינה, לימון ופטרוזיליה קצוצה.",
    ],
    [
      "Heat the oven to 220°C.",
      "Halve a cauliflower, brush with olive oil and salt and roast 35–40 minutes until browned.",
      "Warm half a cup of chickpeas with cumin.",
      "Serve with tahini, lemon and chopped parsley.",
    ],
    [
      ["עם עוף: שוקיים לצד באותו תנור.", "With chicken: drumsticks alongside in the same oven."],
      ["מהיר: פרחים במקום חצי כרובית — 25 דקות.", "Faster: florets instead of a half — 25 minutes."],
    ]),
  "grandma-chicken-soup": R(60, 1, ["mealPrep"],
    [
      "מכניסים לסיר חזה עוף, גזר, גבעול סלרי, תפוח אדמה ובצל חתוכים גס.",
      "מכסים ב-4 כוסות מים, מלח ופלפל שחור.",
      "מביאים לרתיחה, מסירים קצף ומבשלים על אש נמוכה 45 דקות.",
      "מפוררים את העוף בחזרה לתוך המרק ומפזרים שמיר.",
    ],
    [
      "Put the chicken breast, carrot, a celery stick, potato and onion, roughly cut, in a pot.",
      "Cover with 4 cups of water, salt and black pepper.",
      "Bring to a boil, skim, and simmer on low for 45 minutes.",
      "Shred the chicken back into the soup and scatter dill.",
    ],
    [
      ["עשיר: כרעיים במקום חזה.", "Richer: thighs instead of breast."],
      ["צמחוני: חומוס וכורכום במקום עוף.", "Vegetarian: chickpeas and turmeric instead of chicken."],
    ]),
  "minestrone": R(40, 1, ["mealPrep", "budget"],
    [
      "מטגנים גזר וסלרי קצוצים 5 דקות.",
      "מוסיפים עגבנייה, קישוא, מלח ואורגנו ו-3 כוסות מים ומבשלים 15 דקות.",
      "מוסיפים חצי כוס שעועית וחופן קטן של פסטה ומבשלים 10 דקות.",
      "מגישים עם פרמזן מגורר אם רוצים.",
    ],
    [
      "Soften the chopped carrot and celery for 5 minutes.",
      "Add tomato, zucchini, salt, oregano and 3 cups of water; simmer 15 minutes.",
      "Add half a cup of beans and a small handful of pasta; simmer 10 minutes.",
      "Serve with grated parmesan if you like.",
    ],
    [
      ["ללא גלוטן: אורז במקום פסטה.", "Gluten-free: rice instead of pasta."],
      ["עם בשר: קוביות עוף.", "With meat: chicken cubes."],
    ]),
  "eggplant-parmigiana": R(50, 2, [],
    [
      "פורסים חציל לפרוסות של 1 ס״מ, מברישים מעט שמן וצולים ב-220 מעלות כ-20 דקות.",
      "בכלי אפייה: שכבת רוטב עגבניות, פרוסות חציל, מוצרלה — וחוזר.",
      "מפזרים פרמזן מעל.",
      "אופים ב-190 מעלות כ-20 דקות עד שמבעבע ומגישים עם בזיליקום.",
    ],
    [
      "Slice the eggplant 1 cm thick, brush with a little oil and roast at 220°C for 20 minutes.",
      "In a baking dish: a layer of tomato sauce, eggplant, mozzarella — and repeat.",
      "Sprinkle parmesan on top.",
      "Bake at 190°C for 20 minutes until bubbling; serve with basil.",
    ],
    [
      ["טבעוני: בלי גבינות, עם טחינה מעל.", "Vegan: no cheese, tahini on top."],
      ["משביע: עם פסטה לצד.", "More filling: with pasta alongside."],
    ]),
  "tofu-teriyaki-noodles": R(25, 1, ["onePan"],
    [
      "מבשלים חופן קטן של נודלס ומסננים.",
      "משחימים קוביות טופו בכף שמן 6 דקות עד שהן פריכות.",
      "מוסיפים פלפל פרוס ומקפיצים 3 דקות.",
      "מוסיפים את הנודלס, כף סויה ובצל ירוק ומקפיצים דקה.",
    ],
    [
      "Cook a small handful of noodles and drain.",
      "Brown the tofu cubes in a spoon of oil for 6 minutes until crisp.",
      "Add the sliced pepper and stir-fry 3 minutes.",
      "Add the noodles, a spoon of soy sauce and spring onion; toss for a minute.",
    ],
    [
      ["ללא גלוטן: אטריות אורז וטמארי.", "Gluten-free: rice noodles and tamari."],
      ["עם עוף: עוף במקום טופו.", "With chicken: chicken instead of tofu."],
    ]),
  "chicken-fajitas": R(25, 1, ["onePan", "kids"],
    [
      "פורסים חזה עוף, פלפל ובצל לרצועות.",
      "מערבבים עם כפית פפריקה, כמון, מלח וכף שמן.",
      "מקפיצים במחבת לוהטת 8–10 דקות.",
      "מחממים טורטייה ומגלגלים את המילוי.",
    ],
    [
      "Cut the chicken breast, pepper and onion into strips.",
      "Toss with a teaspoon of paprika, cumin, salt and a spoon of oil.",
      "Stir-fry in a very hot pan for 8–10 minutes.",
      "Warm a tortilla and roll the filling in it.",
    ],
    [
      ["ללא גלוטן: טורטיית תירס.", "Gluten-free: corn tortillas."],
      ["צמחוני: שעועית שחורה ופטריות.", "Vegetarian: black beans and mushrooms."],
    ]),
  "pita-pizza": R(12, 1, ["quick", "kids"],
    [
      "מחממים תנור ל-220 מעלות.",
      "מורחים רבע כוס רוטב עגבניות על פיתה מלאה.",
      "מפזרים מוצרלה ופטריות פרוסות.",
      "אופים 8 דקות עד שהגבינה נמסה.",
    ],
    [
      "Heat the oven to 220°C.",
      "Spread a quarter cup of tomato sauce on a wholemeal pita.",
      "Scatter mozzarella and sliced mushrooms.",
      "Bake 8 minutes until the cheese melts.",
    ],
    [
      ["יותר ירקות: פלפל, זיתים, תירס.", "More veg: pepper, olives, sweetcorn."],
      ["טבעוני: גבינה טבעונית.", "Vegan: vegan cheese."],
    ],
    ["מושלם לארוחה עם ילדים — כל אחד מרכיב את שלו.", "Perfect with kids — everyone builds their own."]),
  "baked-nuggets": R(35, 1, ["kids"],
    [
      "מחממים תנור ל-220 מעלות; חותכים בטטה לרצועות וצולים 25 דקות.",
      "חותכים חזה עוף לקוביות.",
      "טובלים בביצה טרופה ואז בכוס קורנפלקס כתוש עם מלח ופפריקה.",
      "מסדרים בתבנית לצד הבטטה ואופים 15–18 דקות, הופכים באמצע.",
    ],
    [
      "Heat the oven to 220°C; cut the sweet potato into wedges and roast 25 minutes.",
      "Cut the chicken breast into pieces.",
      "Dip in beaten egg, then in a cup of crushed cornflakes with salt and paprika.",
      "Lay on the tray beside the sweet potato and bake 15–18 minutes, turning halfway.",
    ],
    [
      ["ללא גלוטן: קורנפלקס ללא גלוטן.", "Gluten-free: gluten-free cornflakes."],
      ["צמחוני: קוביות טופו באותו ציפוי.", "Vegetarian: tofu cubes in the same coating."],
    ]),
  "stuffed-sweet-potato-beans": R(45, 1, ["budget"],
    [
      "אופים בטטה ב-200 מעלות כ-40 דקות (או 10 דקות במיקרו).",
      "מחממים שעועית שחורה עם כמון ומלח.",
      "חוצים את הבטטה וממלאים בשעועית ותירס.",
      "מסדרים רבע אבוקדו פרוס מעל וסוחטים ליים.",
    ],
    [
      "Bake the sweet potato at 200°C for about 40 minutes (or 10 in the microwave).",
      "Warm the black beans with cumin and salt.",
      "Split the sweet potato and fill with the beans and sweetcorn.",
      "Top with a quarter avocado, sliced, and squeeze lime over.",
    ],
    [
      ["עם יוגורט: כף יוגורט במקום אבוקדו.", "With yogurt: a spoon of yogurt instead of avocado."],
      ["חריף: צ׳ילי וכוסברה.", "Spicy: chilli and coriander."],
    ]),
  "barley-mushroom-risotto": R(45, 2, [],
    [
      "מטגנים בצל קצוץ בכפית שמן זית 5 דקות, מוסיפים 2 חופני פטריות פרוסות.",
      "מוסיפים חצי כוס גריסי פנינה ומערבבים דקה.",
      "מוסיפים כוס מים חמים ומבשלים תוך ערבוב מדי פעם; מוסיפים עוד מים כשנספגים — כ-35 דקות.",
      "מורידים מהאש ומערבבים פרמזן, מלח ופלפל.",
    ],
    [
      "Soften the chopped onion in a teaspoon of olive oil for 5 minutes; add 2 handfuls of sliced mushrooms.",
      "Add half a cup of pearl barley and stir for a minute.",
      "Add a cup of hot water and cook, stirring now and then; add more water as it's absorbed — about 35 minutes.",
      "Off the heat stir in parmesan, salt and pepper.",
    ],
    [
      ["טבעוני: שמרי בירה במקום פרמזן.", "Vegan: nutritional yeast instead of parmesan."],
      ["ללא גלוטן: אורז ריזוטו במקום גריסים.", "Gluten-free: risotto rice instead of barley."],
    ]),

  // ─── snacks ───
  "apple-pb": R(3, 1, ["quick", "noCook", "kids"],
    [
      "חותכים תפוח לפלחים ומוציאים את הליבה.",
      "מגישים עם כף חמאת בוטנים לטבילה.",
    ],
    [
      "Cut an apple into wedges and remove the core.",
      "Serve with a spoon of peanut butter to dip.",
    ],
    [
      ["אלרגיה לבוטנים: טחינה גולמית או חמאת שקדים.", "Peanut allergy: raw tahini or almond butter."],
      ["קינמון: קורט מעל.", "Cinnamon: a pinch on top."],
    ]),
  "yogurt-berries": R(3, 1, ["quick", "noCook"],
    [
      "מעבירים גביע יוגורט יווני לקערה.",
      "מוסיפים חופן פירות יער.",
    ],
    [
      "Spoon a pot of Greek yogurt into a bowl.",
      "Add a handful of berries.",
    ],
    [
      ["מתוק: כפית דבש.", "Sweeter: a teaspoon of honey."],
      ["טבעוני: יוגורט סויה.", "Vegan: soy yogurt."],
    ]),
  "nuts-banana": R(1, 1, ["quick", "noCook"],
    [
      "בננה אחת וחופן אגוזים — לתיק, לפני או אחרי אימון.",
    ],
    [
      "One banana and a handful of nuts — in your bag, before or after a workout.",
    ],
    [
      ["אלרגיה לאגוזים: גרעיני דלעת.", "Nut allergy: pumpkin seeds."],
    ]),
  "rice-cakes-pb": R(3, 1, ["quick", "noCook", "kids"],
    [
      "מורחים כף חמאת בוטנים על 2 פריכיות אורז.",
      "מסדרים פרוסות בננה מעל.",
    ],
    [
      "Spread a spoon of peanut butter over 2 rice cakes.",
      "Top with banana slices.",
    ],
    [
      ["יותר חלבון: קוטג׳ במקום חמאת בוטנים.", "More protein: cottage cheese instead of peanut butter."],
    ]),
  "dates-nuts": R(1, 1, ["quick", "noCook"],
    [
      "2 תמרים וחופן אגוזים — אפשר לפתוח תמר ולהכניס בו אגוז.",
    ],
    [
      "2 dates and a handful of nuts — you can split a date and tuck a nut inside.",
    ],
    [
      ["לפני אימון: רק התמרים — אנרגיה מהירה.", "Before a workout: just the dates — quick energy."],
    ]),
  "cottage-cucumber": R(3, 1, ["quick", "noCook", "budget"],
    [
      "פורסים מלפפון.",
      "מגישים עם גביע קוטג׳, מלח ופלפל שחור.",
    ],
    [
      "Slice a cucumber.",
      "Serve with a tub of cottage cheese, salt and black pepper.",
    ],
    [
      ["זעתר: כפית מעל הקוטג׳.", "Za'atar: a teaspoon over the cottage."],
    ]),
  "hummus-veg": R(5, 1, ["quick", "noCook", "kids"],
    [
      "חותכים גזר ומלפפון למקלות.",
      "מגישים עם כף גדושה חומוס לטבילה.",
    ],
    [
      "Cut the carrot and cucumber into sticks.",
      "Serve with a heaped spoon of hummus to dip.",
    ],
    [
      ["עוד ירקות: פלפל וקולרבי.", "More veg: pepper and kohlrabi."],
    ]),
  "dark-chocolate-almonds": R(1, 1, ["quick", "noCook"],
    [
      "2 קוביות שוקולד מריר 70% וחופן אגוזים — מתוק שמשביע.",
    ],
    [
      "2 squares of 70% dark chocolate and a handful of nuts — a sweet that fills.",
    ],
    [
      ["קליל: קובייה אחת ושקדים בלבד.", "Lighter: one square and almonds only."],
    ]),
  "watermelon-feta": R(5, 1, ["quick", "noCook"],
    [
      "חותכים פרוסת אבטיח קר לקוביות.",
      "מפוררים פטה מעל וקורעים נענע.",
    ],
    [
      "Cube a slice of cold watermelon.",
      "Crumble feta over and tear mint on top.",
    ],
    [
      ["קליל: בולגרית 5%.", "Lighter: 5% Bulgarian cheese."],
    ]),
  "pear-cheese": R(3, 1, ["quick", "noCook"],
    [
      "פורסים אגס.",
      "מגישים עם 4 כפות גבינה לבנה ומעט דבש או קינמון.",
    ],
    [
      "Slice a pear.",
      "Serve with 4 spoons of white cheese and a little honey or cinnamon.",
    ],
    [
      ["אגוזים: כמה אגוזי מלך מעל.", "Nuts: a few walnuts on top."],
    ]),
  "pomegranate-yogurt": R(5, 1, ["quick", "noCook"],
    [
      "מפרקים חצי רימון (הכי קל: חוצים, הופכים מעל קערה ודופקים בכף).",
      "מפזרים את הגרגירים על גביע יוגורט יווני.",
    ],
    [
      "Seed half a pomegranate (easiest: halve it, hold it cut-side down over a bowl and tap with a spoon).",
      "Scatter the seeds over a pot of Greek yogurt.",
    ],
    [
      ["טבעוני: יוגורט קוקוס.", "Vegan: coconut yogurt."],
    ]),
  "mango-cottage": R(5, 1, ["quick", "noCook"],
    [
      "חותכים חצי מנגו לקוביות.",
      "מגישים עם גביע קוטג׳ ומעט ליים.",
    ],
    [
      "Cube half a mango.",
      "Serve with a tub of cottage cheese and a little lime.",
    ],
    [
      ["אפשר גם: אפרסק או אננס.", "Also good: peach or pineapple."],
    ]),
  "skyr-strawberries": R(3, 1, ["quick", "noCook"],
    [
      "חותכים חופן תותים.",
      "מסדרים על גביע סקיר ומפזרים חופן שקדים.",
    ],
    [
      "Cut a handful of strawberries.",
      "Arrange over a pot of skyr and scatter a handful of almonds.",
    ],
    [
      ["קליל: חצי כמות שקדים.", "Lighter: half the almonds."],
    ]),
  "kohlrabi-tahini-sticks": R(8, 1, ["quick", "noCook"],
    [
      "מקלפים קולרבי וחותכים למקלות, ואת הצנוניות לחצאים.",
      "מערבבים כף טחינה גולמית עם לימון, מים ומלח עד שחלק.",
      "טובלים ואוכלים.",
    ],
    [
      "Peel the kohlrabi and cut into sticks; halve the radishes.",
      "Whisk a spoon of raw tahini with lemon, water and salt until smooth.",
      "Dip and eat.",
    ],
    [
      ["עוד ירקות: גזר ומלפפון.", "More veg: carrot and cucumber."],
    ]),
  "yogurt-kiwi-walnut": R(3, 1, ["quick", "noCook"],
    [
      "מקלפים ופורסים קיווי.",
      "מסדרים על גביע יוגורט יווני, מוסיפים כמה אגוזי מלך וכפית דבש.",
    ],
    [
      "Peel and slice a kiwi.",
      "Arrange over a pot of Greek yogurt; add a few walnuts and a teaspoon of honey.",
    ],
    [
      ["בלי דבש: הקיווי מתוק מספיק.", "No honey: the kiwi is sweet enough."],
    ]),
  "oat-banana-muffins": R(30, 1, ["kids", "mealPrep"],
    [
      "מחממים תנור ל-180 מעלות ומרפדים 4 שקעים בתבנית מאפינס.",
      "מועכים בננה בשלה עם ביצה.",
      "מערבבים 4 כפות שיבולת שועל ו-2 תמרים קצוצים, קורט קינמון ואבקת אפייה.",
      "ממלאים ואופים 20 דקות.",
    ],
    [
      "Heat the oven to 180°C and line 4 cups of a muffin tin.",
      "Mash a ripe banana with an egg.",
      "Stir in 4 spoons of oats, 2 chopped dates, a pinch of cinnamon and baking powder.",
      "Fill and bake 20 minutes.",
    ],
    [
      ["טבעוני: כף זרעי פשתן טחונים ו-3 כפות מים במקום ביצה.", "Vegan: a spoon of ground flaxseed and 3 spoons of water instead of the egg."],
      ["ללא גלוטן: שיבולת שועל ללא גלוטן.", "Gluten-free: gluten-free oats."],
    ]),
  "energy-balls": R(15, 1, ["noCook", "kids", "mealPrep"],
    [
      "מגלענים 4 תמרים וטוחנים במעבד מזון עם 2 כפות שיבולת שועל וכף חמאת בוטנים.",
      "מוסיפים קוביית שוקולד מריר קצוצה ומערבבים.",
      "מגלגלים 4–5 כדורים בידיים רטובות.",
      "חצי שעה במקרר ומוכן.",
    ],
    [
      "Pit 4 dates and pulse in a food processor with 2 spoons of oats and a spoon of peanut butter.",
      "Stir in a chopped square of dark chocolate.",
      "Roll 4–5 balls with wet hands.",
      "Half an hour in the fridge and they're ready.",
    ],
    [
      ["בלי בוטנים: טחינה.", "No peanuts: tahini."],
      ["ציפוי: קוקוס או שומשום.", "Coating: coconut or sesame."],
    ]),
  "roasted-chickpeas": R(40, 1, ["budget", "mealPrep"],
    [
      "מסננים ומייבשים היטב במגבת שני שליש כוס גרגירי חומוס.",
      "מערבבים עם כפית שמן זית, פפריקה ומלח.",
      "אופים ב-200 מעלות כ-30–35 דקות, מנערים את התבנית פעמיים, עד שפריך.",
      "מצננים — הם מתקשים עוד.",
    ],
    [
      "Drain two-thirds of a cup of chickpeas and dry them well with a towel.",
      "Toss with a teaspoon of olive oil, paprika and salt.",
      "Roast at 200°C for 30–35 minutes, shaking the tray twice, until crisp.",
      "Let them cool — they crisp up more.",
    ],
    [
      ["מתוק: קינמון ומעט סילאן.", "Sweet: cinnamon and a little date syrup."],
      ["חריף: צ׳ילי וכמון.", "Spicy: chilli and cumin."],
    ]),
  "yogurt-bark": R(10, 1, ["noCook", "kids"],
    [
      "מערבבים גביע יוגורט יווני עם כפית דבש.",
      "מורחים בשכבה של 1 ס״מ על תבנית מרופדת בנייר אפייה.",
      "מפזרים פירות יער.",
      "מקפיאים שעתיים ושוברים לחתיכות.",
    ],
    [
      "Mix a pot of Greek yogurt with a teaspoon of honey.",
      "Spread 1 cm thick on a tray lined with baking paper.",
      "Scatter the berries.",
      "Freeze two hours and snap into pieces.",
    ],
    [
      ["פריך: גרנולה מעל.", "Crunchy: granola on top."],
      ["טבעוני: יוגורט קוקוס.", "Vegan: coconut yogurt."],
    ]),
  "baba-ganoush-veg": R(35, 1, [],
    [
      "צולים חציל על להבה או ב-220 מעלות עד שהוא רך לגמרי ומשחיר.",
      "מוציאים את הבשר ומועכים עם כף טחינה, שום כתוש, לימון ומלח.",
      "חותכים גזר ומלפפון למקלות ומגישים לטבילה.",
    ],
    [
      "Char the eggplant over a flame or at 220°C until completely soft and blackened.",
      "Scoop out the flesh and mash with a spoon of tahini, crushed garlic, lemon and salt.",
      "Cut the carrot and cucumber into sticks to dip.",
    ],
    [
      ["עם מיונז: כף מיונז במקום טחינה — הסלט הישראלי המוכר.", "With mayo: a spoon of mayonnaise instead of tahini — the familiar Israeli version."],
    ]),
  "fruit-skewers": R(10, 1, ["noCook", "kids"],
    [
      "חותכים תותים וקיווי לחתיכות.",
      "משחילים על שיפודים לסירוגין עם ענבים.",
      "מגישים עם חצי גביע יוגורט יווני לטבילה.",
    ],
    [
      "Cut the strawberries and kiwi into pieces.",
      "Thread onto skewers, alternating with grapes.",
      "Serve with half a pot of Greek yogurt to dip.",
    ],
    [
      ["מתוק: קינמון ודבש ביוגורט.", "Sweeter: cinnamon and honey in the yogurt."],
    ]),
  "homemade-popcorn": R(8, 1, ["quick", "budget", "kids"],
    [
      "מחממים כפית שמן זית בסיר עם מכסה ומוסיפים 3 גרעינים לבדיקה.",
      "כשהם מתפוצצים — מוסיפים את שאר הגרעינים ומכסים.",
      "מנערים מדי פעם; כשההתפוצצויות כמעט נעצרות — מורידים מהאש.",
      "מפזרים קורט מלח.",
    ],
    [
      "Heat a teaspoon of olive oil in a lidded pot with 3 test kernels.",
      "When they pop, add the rest of the kernels and cover.",
      "Shake now and then; when the popping almost stops, take it off the heat.",
      "Sprinkle a pinch of salt.",
    ],
    [
      ["מתוק: קינמון במקום מלח.", "Sweet: cinnamon instead of salt."],
      ["גבינתי: שמרי בירה.", "Cheesy: nutritional yeast."],
    ]),
  "edamame-lime": R(6, 1, ["quick", "budget"],
    [
      "מבשלים אדממה (בתרמיל, מהמקפיא) 4–5 דקות במים רותחים.",
      "מסננים, מפזרים מלח גס וסוחטים ליים.",
      "אוכלים את הזרעים ישר מהתרמיל.",
    ],
    [
      "Boil edamame (in the pod, from frozen) for 4–5 minutes.",
      "Drain, sprinkle coarse salt and squeeze lime over.",
      "Eat the beans straight from the pod.",
    ],
    [
      ["חריף: צ׳ילי ושום.", "Spicy: chilli and garlic."],
    ]),
  "baked-apple-cinnamon": R(30, 1, ["kids"],
    [
      "מחממים תנור ל-190 מעלות; חוצים תפוח ומוציאים את הליבה.",
      "מפזרים קינמון, אגוזי מלך קצוצים וכפית דבש.",
      "אופים 25 דקות עד שהתפוח רך.",
    ],
    [
      "Heat the oven to 190°C; halve the apple and scoop out the core.",
      "Sprinkle cinnamon, chopped walnuts and a teaspoon of honey.",
      "Bake 25 minutes until the apple is soft.",
    ],
    [
      ["עם יוגורט: כף יוגורט קר מעל.", "With yogurt: a spoon of cold yogurt on top."],
      ["במיקרו: 4 דקות מכוסה.", "Microwave: 4 minutes, covered."],
    ]),
});

/** The recipe for a library meal, or null for a plate built from the fridge. */
export function recipeOf(mealId: string): Recipe | null {
  return RECIPES[mealId] ?? null;
}

/** Minutes in a step's text ("אופים 20 דקות", "bake 20 minutes"), for a step timer. */
export function stepMinutes(text: string): number | null {
  // Ranges in Hebrew steps carry direction marks (see @/i18n/bidi); they are
  // not part of the number.
  const step = text.replace(/[\u2066-\u2069]/g, "");
  const m = /(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:דקות|דקה|minutes?|min)\b/i.exec(step) ?? /(\d+)(?:\s*[–-]\s*(\d+))?\s*דקות/.exec(step);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return Number.isFinite(n) && n > 0 && n <= 240 ? n : null;
}
