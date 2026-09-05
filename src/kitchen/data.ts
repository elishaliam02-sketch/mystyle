/**
 * The kitchen's knowledge: ingredients the app can recognise in a shopping
 * list, and meals it can build from them.
 *
 * Everything lives on the device. There is no food API and no server call —
 * the same offline-first stance as the rest of the app. Nutrition figures are
 * rounded estimates for a typical home portion, not a lab measurement, and the
 * UI says so. The point is direction — lighter, more protein, more filling —
 * not a number to hit.
 *
 * Each food carries the words a real person might write for it, in both
 * languages, including the plurals and spelling variants Hebrew shopping lists
 * actually use, because the list is read as free text. It also carries a
 * `shape` and `color`: the meal pictures are drawn from these, composed from
 * the very ingredients the dish is made of, so every plate is generated rather
 * than pulled from a stock bank.
 */

export type FoodTag = "protein" | "carb" | "veg" | "fruit" | "fat" | "dairy";

/** The primitive the illustrator draws this food as. */
export type Shape = "round" | "long" | "leaf" | "grain" | "slice" | "blob" | "drop";

export type Food = {
  id: string;
  tags: FoodTag[];
  he: string; // canonical Hebrew name, shown back to the user
  en: string;
  /** Every string that should match this food when scanning a list. Lowercase. */
  match: string[];
  shape: Shape;
  color: string;
};

const F = (
  id: string,
  tags: FoodTag[],
  he: string,
  en: string,
  match: string[],
  shape: Shape,
  color: string,
): Food => ({ id, tags, he, en, match, shape, color });

export const FOODS: Food[] = [
  // -- proteins
  F("egg", ["protein"], "ביצים", "eggs", ["ביצה", "ביצים", "egg", "eggs"], "round", "#F4C542"),
  F("chicken", ["protein"], "חזה עוף", "chicken breast", ["חזה עוף", "עוף", "chicken"], "blob", "#E8C9A0"),
  F("turkey", ["protein"], "הודו", "turkey", ["חזה הודו", "הודו", "turkey"], "blob", "#D8B48C"),
  F("beef", ["protein"], "בשר בקר", "beef", ["בשר בקר", "בקר", "בשר טחון", "beef", "steak"], "blob", "#9E4B3B"),
  F("tuna", ["protein"], "טונה", "tuna", ["טונה", "tuna"], "blob", "#C98A6B"),
  F("salmon", ["protein"], "סלמון", "salmon", ["סלמון", "salmon"], "long", "#E9856B"),
  F("fish", ["protein"], "דג", "fish", ["דג לבן", "דג", "פילה דג", "white fish", "fish"], "long", "#D9C2A6"),
  F("tofu", ["protein"], "טופו", "tofu", ["טופו", "tofu"], "blob", "#F0EAD6"),
  F("lentils", ["protein"], "עדשים", "lentils", ["עדשים", "עדשה", "lentil", "lentils"], "grain", "#B5713B"),
  F("chickpeas", ["protein"], "גרגירי חומוס", "chickpeas", ["גרגירי חומוס", "גרגרי חומוס", "חומוס", "chickpea", "chickpeas"], "grain", "#D9B36A"),
  F("beans", ["protein"], "שעועית", "beans", ["שעועית", "beans", "bean"], "grain", "#8C4A2F"),
  F("edamame", ["protein", "veg"], "אדממה", "edamame", ["אדממה", "edamame"], "grain", "#7FB05A"),
  // -- dairy (also protein)
  F("cottage", ["dairy", "protein"], "קוטג'", "cottage cheese", ["קוטג", "קוטג'", "cottage"], "blob", "#FBFBF6"),
  F("whiteCheese", ["dairy", "protein"], "גבינה לבנה", "white cheese", ["גבינה לבנה", "גבינת 5%", "white cheese"], "blob", "#FCFCF7"),
  F("greekYogurt", ["dairy", "protein"], "יוגורט יווני", "greek yogurt", ["יוגורט יווני", "יוגורט", "greek yogurt", "yogurt", "yoghurt"], "blob", "#F7F5EC"),
  F("yellowCheese", ["dairy", "protein", "fat"], "גבינה צהובה", "cheese", ["גבינה צהובה", "גבינה", "cheese"], "slice", "#F2C14E"),
  F("feta", ["dairy", "protein", "fat"], "פטה", "feta", ["גבינת פטה", "פטה", "בולגרית", "feta"], "blob", "#FAFAF3"),
  F("milk", ["dairy"], "חלב", "milk", ["חלב", "milk"], "drop", "#F4F6FA"),
  // -- carbs
  F("wholeBread", ["carb"], "לחם מלא", "whole-grain bread", ["לחם מלא", "לחם קל", "whole bread", "whole-grain bread"], "slice", "#B98A54"),
  F("bread", ["carb"], "לחם", "bread", ["פרוסת לחם", "לחם", "פרוסה", "bread", "toast"], "slice", "#D8AE76"),
  F("oats", ["carb"], "שיבולת שועל", "oats", ["שיבולת שועל", "קוואקר", "שיבולים", "oats", "oatmeal"], "grain", "#E3D5A8"),
  F("rice", ["carb"], "אורז", "rice", ["אורז מלא", "אורז", "rice"], "grain", "#F3EFE0"),
  F("pasta", ["carb"], "פסטה", "pasta", ["פסטה", "ספגטי", "פנה", "pasta", "spaghetti"], "long", "#EAD79B"),
  F("potato", ["carb", "veg"], "תפוח אדמה", "potato", ["תפוח אדמה", "תפוחי אדמה", "תפוד", "potato", "potatoes"], "round", "#D8B77A"),
  F("sweetPotato", ["carb", "veg"], "בטטה", "sweet potato", ["בטטה", "בטטות", "sweet potato"], "long", "#E08A4B"),
  F("quinoa", ["carb", "protein"], "קינואה", "quinoa", ["קינואה", "quinoa"], "grain", "#E6DCC0"),
  F("couscous", ["carb"], "קוסקוס", "couscous", ["קוסקוס", "פתיתים", "couscous"], "grain", "#EAD9A0"),
  F("tortilla", ["carb"], "טורטייה", "tortilla", ["טורטייה", "לאפה", "פיתה", "tortilla", "wrap", "pita"], "round", "#E7CE9A"),
  F("corn", ["carb", "veg"], "תירס", "corn", ["תירס", "corn"], "grain", "#F4CE4B"),
  // -- veg
  F("tomato", ["veg"], "עגבנייה", "tomato", ["עגבנייה", "עגבניה", "עגבניות", "tomato", "tomatoes"], "round", "#E0503A"),
  F("cucumber", ["veg"], "מלפפון", "cucumber", ["מלפפון", "מלפפונים", "cucumber"], "long", "#5C9A47"),
  F("lettuce", ["veg"], "חסה", "lettuce", ["חסה", "עלים ירוקים", "lettuce", "greens"], "leaf", "#77B24E"),
  F("pepper", ["veg"], "פלפל", "pepper", ["פלפל אדום", "פלפל", "פלפלים", "pepper", "bell pepper"], "round", "#D93A3A"),
  F("onion", ["veg"], "בצל", "onion", ["בצל סגול", "בצל", "onion"], "round", "#C9A0C0"),
  F("garlic", ["veg"], "שום", "garlic", ["שום", "garlic"], "round", "#EFEADD"),
  F("spinach", ["veg"], "תרד", "spinach", ["תרד", "spinach"], "leaf", "#3F7D3A"),
  F("carrot", ["veg"], "גזר", "carrot", ["גזר", "גזרים", "carrot", "carrots"], "long", "#E08A2E"),
  F("broccoli", ["veg"], "ברוקולי", "broccoli", ["ברוקולי", "broccoli"], "leaf", "#4E8C3F"),
  F("cauliflower", ["veg"], "כרובית", "cauliflower", ["כרובית", "cauliflower"], "leaf", "#EFEEDF"),
  F("zucchini", ["veg"], "קישוא", "zucchini", ["קישוא", "קישואים", "zucchini"], "long", "#6FA24A"),
  F("mushroom", ["veg"], "פטריות", "mushrooms", ["פטריות", "פטרייה", "mushroom", "mushrooms"], "round", "#D8C6A8"),
  F("eggplant", ["veg"], "חציל", "eggplant", ["חציל", "חצילים", "eggplant"], "long", "#6B3E7A"),
  F("avocado", ["veg", "fat"], "אבוקדו", "avocado", ["אבוקדו", "avocado"], "round", "#6E8B3D"),
  F("sweetcornSalad", ["veg"], "חסת עלים", "mixed greens", ["חסת עלים", "סלט עלים", "מיקס עלים"], "leaf", "#82B85A"),
  // -- fruit
  F("banana", ["fruit"], "בננה", "banana", ["בננה", "בננות", "banana", "bananas"], "long", "#EBCB4B"),
  F("apple", ["fruit"], "תפוח", "apple", ["תפוח עץ", "תפוחים", "apple", "apples"], "round", "#D64545"),
  F("berries", ["fruit"], "פירות יער", "berries", ["פירות יער", "תותים", "אוכמניות", "berries", "strawberries"], "round", "#8E3B6B"),
  F("orange", ["fruit"], "תפוז", "orange", ["תפוז", "תפוזים", "orange", "oranges"], "round", "#E88A2A"),
  F("lemon", ["fruit"], "לימון", "lemon", ["לימון", "lemon"], "round", "#EED94B"),
  F("dates", ["fruit"], "תמרים", "dates", ["תמרים", "תמר", "dates"], "long", "#7A4A2B"),
  // -- fats / spreads
  F("oliveOil", ["fat"], "שמן זית", "olive oil", ["שמן זית", "olive oil"], "drop", "#B7B84A"),
  F("tahini", ["fat", "protein"], "טחינה", "tahini", ["טחינה", "tahini"], "blob", "#E8E2C8"),
  F("nuts", ["fat", "protein"], "אגוזים", "nuts", ["אגוזי מלך", "אגוזים", "שקדים", "nuts", "almonds"], "grain", "#A9743F"),
  F("peanutButter", ["fat", "protein"], "חמאת בוטנים", "peanut butter", ["חמאת בוטנים", "peanut butter"], "blob", "#C58A3D"),
  F("olives", ["fat"], "זיתים", "olives", ["זיתים", "זית", "olives"], "round", "#5B6B34"),
  F("hummusSpread", ["protein", "fat"], "ממרח חומוס", "hummus", ["ממרח חומוס", "חומוס מוכן", "hummus"], "blob", "#DFC98F"),

  // -- more proteins & meats
  F("pork", ["protein"], "בשר חזיר", "pork", ["בשר חזיר", "חזיר", "פילה חזיר", "pork"], "blob", "#D98C7A"),
  F("lamb", ["protein"], "כבש", "lamb", ["בשר כבש", "כבש", "lamb"], "blob", "#8C4A3B"),
  F("sausage", ["protein", "fat"], "נקניקייה", "sausage", ["נקניקייה", "נקניקיות", "נקניק", "sausage"], "long", "#A24B3A"),
  F("shrimp", ["protein"], "שרימפס", "shrimp", ["שרימפס", "חסילונים", "שרימפ", "shrimp", "prawns"], "long", "#E88A6B"),
  F("sardines", ["protein", "fat"], "סרדינים", "sardines", ["סרדינים", "סרדין", "sardines"], "long", "#B0A48A"),
  F("proteinPowder", ["protein"], "אבקת חלבון", "protein powder", ["אבקת חלבון", "אבקה חלבון", "protein powder", "whey"], "grain", "#C9A36B"),
  // -- more dairy
  F("butter", ["fat", "dairy"], "חמאה", "butter", ["חמאה", "butter"], "blob", "#F2D98A"),
  F("mozzarella", ["dairy", "protein"], "מוצרלה", "mozzarella", ["מוצרלה", "mozzarella"], "blob", "#FAF6EC"),
  F("creamCheese", ["dairy", "fat"], "גבינת שמנת", "cream cheese", ["גבינת שמנת", "שמנת", "cream cheese"], "blob", "#FBF7EE"),
  // -- more carbs
  F("bagel", ["carb"], "בייגל", "bagel", ["בייגל", "בייגלה", "bagel"], "round", "#D2A263"),
  F("noodles", ["carb"], "אטריות", "noodles", ["אטריות", "נודלס", "noodles", "ramen"], "long", "#E8D79B"),
  F("bulgur", ["carb", "protein"], "בורגול", "bulgur", ["בורגול", "bulgur"], "grain", "#CDA96A"),
  F("cornflakes", ["carb"], "דגני בוקר", "cereal", ["קורנפלקס", "דגני בוקר", "cereal", "cornflakes"], "grain", "#E8B84B"),
  F("granola", ["carb", "fat"], "גרנולה", "granola", ["גרנולה", "granola"], "grain", "#B98A4A"),
  F("riceCakes", ["carb"], "פריכיות", "rice cakes", ["פריכיות אורז", "פריכיות", "rice cakes"], "round", "#EFE7CF"),
  // -- more veg
  F("cabbage", ["veg"], "כרוב", "cabbage", ["כרוב", "cabbage"], "leaf", "#8BB56A"),
  F("peas", ["veg", "protein"], "אפונה", "peas", ["אפונה", "peas"], "grain", "#6FA83F"),
  F("greenBeans", ["veg"], "שעועית ירוקה", "green beans", ["שעועית ירוקה", "green beans"], "long", "#5E9440"),
  F("beetroot", ["veg"], "סלק", "beetroot", ["סלק", "beetroot", "beet"], "round", "#9E2B4E"),
  F("celery", ["veg"], "סלרי", "celery", ["סלרי", "celery"], "long", "#8FB25A"),
  F("cornVeg", ["veg", "carb"], "תירס", "sweetcorn", ["גרעיני תירס", "תירס מתוק", "sweetcorn"], "grain", "#F4CE4B"),
  // -- more fruit
  F("grapes", ["fruit"], "ענבים", "grapes", ["ענבים", "ענב", "grapes"], "round", "#7E4A8C"),
  F("mango", ["fruit"], "מנגו", "mango", ["מנגו", "mango"], "round", "#F0A63C"),
  F("watermelon", ["fruit"], "אבטיח", "watermelon", ["אבטיח", "watermelon"], "round", "#E0506A"),
  F("pear", ["fruit"], "אגס", "pear", ["אגס", "אגסים", "pear"], "round", "#B7C24A"),
  F("pineapple", ["fruit"], "אננס", "pineapple", ["אננס", "pineapple"], "round", "#EBC94B"),
  F("pomegranate", ["fruit"], "רימון", "pomegranate", ["רימון", "pomegranate"], "round", "#B83A47"),
  // -- more fats / extras
  F("honey", ["fat"], "דבש", "honey", ["דבש", "honey"], "drop", "#E0A63C"),
  F("darkChocolate", ["fat"], "שוקולד מריר", "dark chocolate", ["שוקולד מריר", "שוקולד", "chocolate"], "slice", "#5A3826"),
  F("mayo", ["fat"], "מיונז", "mayonnaise", ["מיונז", "mayo", "mayonnaise"], "blob", "#F7EFD4"),
  F("ketchup", ["veg"], "קטשופ", "ketchup", ["קטשופ", "ketchup"], "blob", "#C6392B"),
  F("chia", ["fat", "protein"], "צ'יה", "chia seeds", ["זרעי צ'יה", "צ'יה", "chia"], "grain", "#3B3B3B"),
];

/** How a meal reads against the goal, shown as a small badge. */
export type MealNote = "light" | "protein" | "veg" | "balanced" | "hearty";

/** Which part of the day a meal is for. */
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type Meal = {
  id: string;
  he: { title: string; how: string };
  en: { title: string; how: string };
  /** Food ids the meal is built from. Order matters — the first ones lead. */
  uses: string[];
  slot: MealSlot;
  notes: MealNote[];
  /** Rough estimates for one home portion. */
  kcal: number;
  protein: number;
};

const M = (
  id: string,
  he: { title: string; how: string },
  en: { title: string; how: string },
  uses: string[],
  slot: MealSlot,
  notes: MealNote[],
  kcal: number,
  protein: number,
): Meal => ({ id, he, en, uses, slot, notes, kcal, protein });

export const MEALS: Meal[] = [
  M("omelette-salad",
    { title: "חביתה עם סלט", how: "מטגנים 2 ביצים במעט שמן זית, לצד עגבנייה ומלפפון קצוצים." },
    { title: "Omelette with salad", how: "Two eggs in a little olive oil, with chopped tomato and cucumber." },
    ["egg", "tomato", "cucumber", "oliveOil"], "breakfast", ["protein", "light"], 320, 20),
  M("shakshuka",
    { title: "שקשוקה", how: "מבשלים עגבנייה, פלפל ובצל, שוברים פנימה 2 ביצים ומכסים עד שהחלבון נקרש." },
    { title: "Shakshuka", how: "Simmer tomato, pepper and onion, crack in two eggs and cover until set." },
    ["egg", "tomato", "pepper", "onion"], "breakfast", ["protein", "veg"], 360, 19),
  M("yogurt-bowl",
    { title: "קערת יוגורט", how: "יוגורט יווני עם בננה פרוסה, כף שיבולת שועל וקצת אגוזים." },
    { title: "Yogurt bowl", how: "Greek yogurt with sliced banana, a spoon of oats and a few nuts." },
    ["greekYogurt", "banana", "oats", "nuts"], "breakfast", ["protein", "balanced"], 380, 24),
  M("cottage-toast",
    { title: "קוטג' על לחם מלא", how: "פרוסת לחם מלא עם קוטג' ופרוסות עגבנייה, מלח ופלפל." },
    { title: "Cottage on toast", how: "Whole-grain bread with cottage cheese and tomato, salt and pepper." },
    ["cottage", "wholeBread", "tomato"], "breakfast", ["light", "protein"], 260, 18),
  M("oatmeal-pb",
    { title: "דייסת שיבולת שועל", how: "מבשלים שיבולת שועל בחלב, מוסיפים בננה וכף חמאת בוטנים." },
    { title: "Oatmeal", how: "Cook oats in milk, top with banana and a spoon of peanut butter." },
    ["oats", "milk", "banana", "peanutButter"], "breakfast", ["hearty", "balanced"], 420, 15),
  M("avocado-egg-toast",
    { title: "טוסט אבוקדו וביצה", how: "לחם מלא, אבוקדו מעוך וביצה קשה או עלומה מעל." },
    { title: "Avocado & egg toast", how: "Whole-grain bread, mashed avocado, a boiled or poached egg on top." },
    ["wholeBread", "avocado", "egg"], "breakfast", ["balanced", "protein"], 340, 15),
  M("tuna-salad",
    { title: "סלט טונה", how: "טונה במים על מצע חסה, מלפפון ועגבנייה, כפית שמן זית ולימון." },
    { title: "Tuna salad", how: "Tuna in water over lettuce, cucumber and tomato, olive oil and lemon." },
    ["tuna", "lettuce", "cucumber", "tomato", "oliveOil"], "lunch", ["light", "protein"], 300, 28),
  M("chicken-rice-broccoli",
    { title: "עוף עם אורז וברוקולי", how: "חזה עוף צלוי, חצי כוס אורז וברוקולי מאודה." },
    { title: "Chicken, rice & broccoli", how: "Grilled chicken breast, half a cup of rice and steamed broccoli." },
    ["chicken", "rice", "broccoli"], "lunch", ["protein", "hearty"], 480, 40),
  M("chicken-sweet-potato",
    { title: "עוף עם בטטה וסלט", how: "חזה עוף, בטטה בתנור וסלט ירוק לצד." },
    { title: "Chicken with sweet potato", how: "Chicken breast, roasted sweet potato and a green salad." },
    ["chicken", "sweetPotato", "lettuce"], "lunch", ["protein", "balanced"], 460, 38),
  M("beef-rice",
    { title: "בקר עם אורז וירקות", how: "רצועות בקר רזה מוקפצות עם פלפל ובצל, על אורז." },
    { title: "Beef with rice", how: "Lean beef strips stir-fried with pepper and onion, over rice." },
    ["beef", "rice", "pepper", "onion"], "dinner", ["protein", "hearty"], 540, 35),
  M("lentil-soup",
    { title: "מרק עדשים", how: "מבשלים עדשים עם גזר ובצל ומעט כמון עד שהכול רך." },
    { title: "Lentil soup", how: "Simmer lentils with carrot and onion and a little cumin until soft." },
    ["lentils", "carrot", "onion"], "dinner", ["veg", "protein", "light"], 300, 18),
  M("hummus-bowl",
    { title: "קערת חומוס", how: "גרגירי חומוס עם טחינה, עגבנייה ומלפפון קצוצים ושמן זית." },
    { title: "Chickpea bowl", how: "Chickpeas with tahini, chopped tomato and cucumber and olive oil." },
    ["chickpeas", "tahini", "tomato", "cucumber"], "lunch", ["veg", "protein"], 400, 17),
  M("tofu-stirfry",
    { title: "מוקפץ טופו", how: "מקפיצים טופו עם פלפל וברוקולי בסויה, מגישים על אורז." },
    { title: "Tofu stir-fry", how: "Stir-fry tofu with pepper and broccoli in soy sauce, serve over rice." },
    ["tofu", "pepper", "broccoli", "rice"], "dinner", ["veg", "protein"], 430, 24),
  M("salmon-quinoa",
    { title: "סלמון עם קינואה", how: "פילה סלמון בתנור, קינואה ותרד מוקפץ קלות." },
    { title: "Salmon with quinoa", how: "Baked salmon fillet, quinoa and lightly sautéed spinach." },
    ["salmon", "quinoa", "spinach"], "dinner", ["protein", "balanced"], 500, 34),
  M("fish-potato",
    { title: "דג עם תפוח אדמה", how: "פילה דג בתנור עם תפוחי אדמה ולימון, לצד סלט." },
    { title: "Fish with potato", how: "Baked white fish with potatoes and lemon, salad on the side." },
    ["fish", "potato", "lemon"], "dinner", ["protein", "balanced"], 420, 30),
  M("turkey-wrap",
    { title: "טורטייה עם הודו", how: "טורטייה עם חזה הודו, חסה ועגבנייה, כפית טחינה." },
    { title: "Turkey wrap", how: "Tortilla with turkey breast, lettuce and tomato, a little tahini." },
    ["turkey", "tortilla", "lettuce", "tomato"], "lunch", ["light", "protein"], 350, 26),
  M("pasta-veg",
    { title: "פסטה עם ירקות", how: "פסטה עם רוטב עגבניות, קישוא ובצל בשמן זית." },
    { title: "Pasta with vegetables", how: "Pasta with tomato sauce, zucchini and onion in olive oil." },
    ["pasta", "tomato", "zucchini", "onion"], "dinner", ["veg", "hearty"], 470, 13),
  M("baked-potato-cottage",
    { title: "תפוח אדמה אפוי עם קוטג'", how: "תפוח אדמה בתנור, פתוח וממולא בקוטג', לצד סלט." },
    { title: "Baked potato with cottage", how: "Oven-baked potato, split and filled with cottage cheese." },
    ["potato", "cottage", "cucumber"], "dinner", ["light", "protein"], 330, 20),
  M("white-cheese-plate",
    { title: "צלחת גבינה לבנה וירקות", how: "גבינה לבנה 5% עם ירקות חתוכים ופרוסת לחם מלא." },
    { title: "White cheese & veg plate", how: "Low-fat white cheese with cut vegetables and whole-grain bread." },
    ["whiteCheese", "cucumber", "tomato", "wholeBread"], "breakfast", ["light", "protein"], 280, 19),
  M("feta-salad",
    { title: "סלט יווני עם פטה", how: "עגבנייה, מלפפון, בצל וזיתים עם קוביות פטה ושמן זית." },
    { title: "Greek salad with feta", how: "Tomato, cucumber, onion and olives with feta cubes and olive oil." },
    ["feta", "tomato", "cucumber", "onion", "olives"], "lunch", ["veg", "light"], 320, 12),
  M("chickpea-quinoa",
    { title: "קערת קינואה וחומוס", how: "קינואה עם גרגירי חומוס, תרד ולימון — צמחוני ומשביע." },
    { title: "Quinoa & chickpea bowl", how: "Quinoa with chickpeas, spinach and lemon — vegetarian and filling." },
    ["quinoa", "chickpeas", "spinach", "lemon"], "lunch", ["veg", "protein", "hearty"], 440, 20),
  M("apple-pb",
    { title: "תפוח עם חמאת בוטנים", how: "תפוח פרוס עם כף חמאת בוטנים — נשנוש שמחזיק." },
    { title: "Apple & peanut butter", how: "Sliced apple with a spoon of peanut butter — a snack that holds." },
    ["apple", "peanutButter"], "snack", ["balanced"], 200, 6),
  M("yogurt-berries",
    { title: "יוגורט עם פירות יער", how: "יוגורט יווני עם חופן פירות יער — קליל וחלבוני." },
    { title: "Yogurt & berries", how: "Greek yogurt with a handful of berries — light and high in protein." },
    ["greekYogurt", "berries"], "snack", ["light", "protein"], 180, 17),
  M("nuts-banana",
    { title: "בננה עם אגוזים", how: "בננה וחופן אגוזים — אנרגיה מהירה לפני או אחרי אימון." },
    { title: "Banana & nuts", how: "A banana and a handful of nuts — quick energy before or after a workout." },
    ["banana", "nuts"], "snack", ["hearty", "balanced"], 260, 7),
  // Dishes the dietary filters actually remove. Without these the menu was
  // entirely kosher already, so turning the kosher filter on changed nothing
  // on screen — a filter that hides nothing reads as a filter that is broken.
  M("cheeseburger",
    { title: "בורגר עם צהובה", how: "קציצת בקר בלחמנייה עם פרוסת גבינה צהובה, עגבנייה ובצל." },
    { title: "Cheeseburger", how: "A beef patty in a bun with a slice of yellow cheese, tomato and onion." },
    ["beef", "yellowCheese", "bread", "tomato", "onion"], "dinner", ["hearty", "protein"], 620, 38),
  M("creamy-beef-pasta",
    { title: "פסטה בשמנת עם בקר", how: "פסטה ברוטב שמנת עם רצועות בקר ופטריות מוקפצות." },
    { title: "Creamy beef pasta", how: "Pasta in a cream sauce with strips of beef and sautéed mushrooms." },
    ["pasta", "beef", "creamCheese", "mushroom"], "dinner", ["hearty", "protein"], 680, 36),
  M("sausage-cheese-toast",
    { title: "טוסט נקניק וגבינה", how: "טוסט חם עם נקניק ופרוסת גבינה צהובה, עגבנייה בפנים." },
    { title: "Sausage & cheese toast", how: "A hot toastie with sausage, yellow cheese and tomato inside." },
    ["bread", "sausage", "yellowCheese", "tomato"], "lunch", ["hearty"], 520, 26),
  M("shrimp-stirfry",
    { title: "שרימפס מוקפץ עם ירקות", how: "שרימפס מוקפץ עם ברוקולי ופלפל בשמן זית, לצד אורז." },
    { title: "Shrimp stir-fry", how: "Shrimp seared with broccoli and pepper in olive oil, over rice." },
    ["shrimp", "broccoli", "pepper", "rice", "oliveOil"], "dinner", ["protein", "veg"], 430, 32),
  M("lamb-yogurt-bowl",
    { title: "כבש עם יוגורט ובורגול", how: "כבש צלוי על בורגול, כף יוגורט ונענע מעל." },
    { title: "Lamb & yogurt bowl", how: "Roast lamb over bulgur, a spoon of yogurt and mint on top." },
    ["lamb", "greekYogurt", "bulgur", "onion"], "dinner", ["hearty", "protein"], 590, 40),

  // Depth, so the daily rotation has somewhere to rotate to. A menu of two
  // dozen dishes repeats inside a week however cleverly it is sorted.
  M("egg-avocado-bowl",
    { title: "קערת ביצים ואבוקדו", how: "2 ביצים קשות עם אבוקדו מעוך ועגבנייה, כפית שמן זית." },
    { title: "Egg & avocado bowl", how: "Two boiled eggs with mashed avocado and tomato, a little olive oil." },
    ["egg", "avocado", "tomato", "oliveOil"], "breakfast", ["protein", "balanced"], 400, 18),
  M("cottage-fruit",
    { title: "קוטג' עם פירות", how: "קוטג' עם חופן פירות יער וכמה אגוזים." },
    { title: "Cottage & fruit", how: "Cottage cheese with a handful of berries and a few nuts." },
    ["cottage", "berries", "nuts"], "breakfast", ["light", "protein"], 250, 20),
  M("granola-yogurt",
    { title: "גרנולה עם יוגורט", how: "יוגורט יווני עם גרנולה ובננה פרוסה." },
    { title: "Granola & yogurt", how: "Greek yogurt with granola and sliced banana." },
    ["granola", "greekYogurt", "banana"], "breakfast", ["hearty", "balanced"], 430, 20),
  M("chia-pudding",
    { title: "פודינג צ'יה", how: "כף צ'יה בחלב בלילה, פירות יער מעל בבוקר." },
    { title: "Chia pudding", how: "A spoon of chia in milk overnight, berries on top in the morning." },
    ["chia", "milk", "berries"], "breakfast", ["light", "balanced"], 240, 10),
  M("bagel-cheese",
    { title: "בייגל עם גבינה", how: "בייגל חתוך עם גבינה לבנה ומלפפון." },
    { title: "Bagel with cheese", how: "A split bagel with white cheese and cucumber." },
    ["bagel", "whiteCheese", "cucumber"], "breakfast", ["hearty"], 390, 16),
  M("protein-shake-banana",
    { title: "שייק חלבון ובננה", how: "מנת אבקת חלבון בחלב עם בננה — מהיר לפני יציאה." },
    { title: "Protein & banana shake", how: "A scoop of protein in milk with a banana — fast before you leave." },
    ["proteinPowder", "milk", "banana"], "breakfast", ["protein"], 330, 32),
  M("cornflakes-milk",
    { title: "קורנפלקס עם חלב", how: "קורנפלקס בחלב עם בננה פרוסה." },
    { title: "Cornflakes & milk", how: "Cornflakes in milk with sliced banana." },
    ["cornflakes", "milk", "banana"], "breakfast", ["balanced"], 350, 13),
  M("rice-cakes-pb",
    { title: "פריכיות עם חמאת בוטנים", how: "שתי פריכיות אורז עם חמאת בוטנים ובננה." },
    { title: "Rice cakes & peanut butter", how: "Two rice cakes with peanut butter and banana." },
    ["riceCakes", "peanutButter", "banana"], "snack", ["balanced"], 270, 9),
  M("chicken-quinoa",
    { title: "עוף עם קינואה", how: "חזה עוף צלוי עם קינואה וקישוא בתנור." },
    { title: "Chicken & quinoa", how: "Roast chicken breast with quinoa and oven-baked courgette." },
    ["chicken", "quinoa", "zucchini", "oliveOil"], "lunch", ["protein", "balanced"], 460, 40),
  M("turkey-rice-bowl",
    { title: "קערת הודו ואורז", how: "רצועות הודו מוקפצות עם פלפל ובצל על אורז." },
    { title: "Turkey rice bowl", how: "Turkey strips stir-fried with pepper and onion over rice." },
    ["turkey", "rice", "pepper", "onion"], "lunch", ["protein", "hearty"], 510, 42),
  M("tuna-potato",
    { title: "טונה עם תפוח אדמה", how: "טונה על תפוח אדמה אפוי עם סלט חסה." },
    { title: "Tuna & potato", how: "Tuna over a baked potato with a lettuce salad." },
    ["tuna", "potato", "lettuce", "oliveOil"], "lunch", ["protein", "balanced"], 420, 32),
  M("chickpea-salad",
    { title: "סלט חומוס", how: "גרגירי חומוס עם ירקות קצוצים וכף טחינה." },
    { title: "Chickpea salad", how: "Chickpeas with chopped vegetables and a spoon of tahini." },
    ["chickpeas", "tomato", "cucumber", "tahini"], "lunch", ["veg", "protein"], 380, 16),
  M("beef-sweet-potato",
    { title: "בקר עם בטטה", how: "בקר צלוי עם בטטה אפויה ותרד מוקפץ." },
    { title: "Beef & sweet potato", how: "Roast beef with baked sweet potato and sautéed spinach." },
    ["beef", "sweetPotato", "spinach"], "lunch", ["hearty", "protein"], 560, 44),
  M("egg-fried-rice",
    { title: "אורז מוקפץ עם ביצה", how: "אורז מוקפץ עם ביצה, אפונה וגזר." },
    { title: "Egg fried rice", how: "Rice stir-fried with egg, peas and carrot." },
    ["rice", "egg", "peas", "carrot"], "lunch", ["balanced"], 440, 18),
  M("shakshuka-feta",
    { title: "שקשוקה עם פטה", how: "שקשוקה קלאסית עם פטה מפוררת מעל בסוף הבישול." },
    { title: "Shakshuka with feta", how: "Classic shakshuka with feta crumbled over at the end." },
    ["egg", "tomato", "pepper", "feta"], "breakfast", ["protein", "veg"], 410, 24),
  M("chicken-couscous",
    { title: "עוף עם קוסקוס", how: "עוף מבושל עם ירקות שורש על קוסקוס." },
    { title: "Chicken couscous", how: "Braised chicken with root vegetables over couscous." },
    ["chicken", "couscous", "carrot", "zucchini"], "lunch", ["hearty", "protein"], 530, 40),
  M("bulgur-veg",
    { title: "בורגול עם ירקות", how: "בורגול תפוח עם ירקות קצוצים ולימון." },
    { title: "Bulgur & vegetables", how: "Fluffed bulgur with chopped vegetables and lemon." },
    ["bulgur", "tomato", "cucumber", "oliveOil"], "lunch", ["veg", "light"], 330, 9),
  M("salmon-veg",
    { title: "סלמון עם ירקות", how: "פילה סלמון בתנור עם ברוקולי ובטטה." },
    { title: "Salmon & vegetables", how: "Baked salmon fillet with broccoli and sweet potato." },
    ["salmon", "broccoli", "sweetPotato"], "dinner", ["protein", "hearty"], 520, 38),
  M("sardines-salad",
    { title: "סרדינים עם סלט", how: "סרדינים על סלט חסה ועגבנייה עם לימון." },
    { title: "Sardines & salad", how: "Sardines over a lettuce and tomato salad with lemon." },
    ["sardines", "lettuce", "tomato", "lemon"], "dinner", ["light", "protein"], 290, 26),
  M("chicken-cauliflower",
    { title: "עוף עם כרובית", how: "עוף צלוי עם כרובית בתנור ושום." },
    { title: "Chicken & cauliflower", how: "Roast chicken with oven-roasted cauliflower and garlic." },
    ["chicken", "cauliflower", "garlic", "oliveOil"], "dinner", ["light", "protein"], 390, 38),
  M("bean-stew",
    { title: "תבשיל שעועית", how: "שעועית מבושלת ברוטב עגבניות עם בצל ושום." },
    { title: "Bean stew", how: "Beans simmered in tomato with onion and garlic." },
    ["beans", "tomato", "onion", "garlic"], "dinner", ["veg", "hearty"], 380, 18),
  M("omelette-mushroom",
    { title: "חביתת פטריות", how: "חביתה עם פטריות מוקפצות, בצל וגבינה צהובה." },
    { title: "Mushroom omelette", how: "An omelette with sautéed mushrooms, onion and cheese." },
    ["egg", "mushroom", "onion", "yellowCheese"], "dinner", ["protein"], 380, 24),
  M("edamame-rice",
    { title: "אדממה עם אורז", how: "אדממה עם אורז, גזר מגורד ותרד." },
    { title: "Edamame rice bowl", how: "Edamame with rice, grated carrot and spinach." },
    ["edamame", "rice", "carrot", "spinach"], "dinner", ["veg", "balanced"], 400, 20),
  M("stuffed-pepper",
    { title: "פלפל ממולא", how: "פלפל ממולא באורז ובשר, אפוי ברוטב עגבניות." },
    { title: "Stuffed pepper", how: "Pepper stuffed with rice and beef, baked in tomato sauce." },
    ["pepper", "rice", "beef", "tomato"], "dinner", ["hearty", "protein"], 480, 30),
  M("eggplant-tahini",
    { title: "חציל עם טחינה", how: "חציל שרוף עם טחינה, עגבנייה ולימון." },
    { title: "Eggplant with tahini", how: "Charred eggplant with tahini, tomato and lemon." },
    ["eggplant", "tahini", "tomato", "lemon"], "dinner", ["veg", "light"], 300, 8),
  M("noodle-veg",
    { title: "נודלס עם ירקות", how: "נודלס מוקפצים עם ברוקולי, גזר וטופו." },
    { title: "Vegetable noodles", how: "Noodles stir-fried with broccoli, carrot and tofu." },
    ["noodles", "broccoli", "carrot", "tofu"], "dinner", ["balanced", "veg"], 450, 20),
  M("dates-nuts",
    { title: "תמרים עם אגוזים", how: "שני תמרים וחופן אגוזים — אנרגיה מהירה." },
    { title: "Dates & nuts", how: "Two dates and a handful of nuts — quick energy." },
    ["dates", "nuts"], "snack", ["hearty"], 220, 5),
  M("cottage-cucumber",
    { title: "קוטג' עם מלפפון", how: "קוטג' עם מלפפון פרוס ומלח." },
    { title: "Cottage & cucumber", how: "Cottage cheese with sliced cucumber and salt." },
    ["cottage", "cucumber"], "snack", ["light", "protein"], 150, 14),
  M("hummus-veg",
    { title: "חומוס עם ירקות", how: "חומוס עם גזר ומלפפון חתוכים למקלות." },
    { title: "Hummus & veg", how: "Hummus with carrot and cucumber sticks." },
    ["hummusSpread", "carrot", "cucumber"], "snack", ["veg", "balanced"], 210, 7),
  M("dark-chocolate-almonds",
    { title: "שוקולד מריר עם אגוזים", how: "שתי קוביות שוקולד מריר וחופן אגוזים." },
    { title: "Dark chocolate & nuts", how: "Two squares of dark chocolate and a handful of nuts." },
    ["darkChocolate", "nuts"], "snack", ["hearty"], 230, 5),
  M("watermelon-feta",
    { title: "אבטיח עם פטה", how: "אבטיח קר עם פטה מפוררת ונענע." },
    { title: "Watermelon & feta", how: "Cold watermelon with crumbled feta and mint." },
    ["watermelon", "feta"], "snack", ["light"], 180, 8),
  M("pear-cheese",
    { title: "אגס עם גבינה", how: "אגס פרוס עם גבינה לבנה." },
    { title: "Pear & cheese", how: "Sliced pear with white cheese." },
    ["pear", "whiteCheese"], "snack", ["light"], 190, 10),
  M("pomegranate-yogurt",
    { title: "רימון עם יוגורט", how: "יוגורט יווני עם גרגירי רימון." },
    { title: "Pomegranate yogurt", how: "Greek yogurt with pomegranate seeds." },
    ["pomegranate", "greekYogurt"], "snack", ["light", "protein"], 200, 17),
  M("mango-cottage",
    { title: "מנגו עם קוטג'", how: "מנגו חתוך עם קוטג'." },
    { title: "Mango & cottage", how: "Chopped mango with cottage cheese." },
    ["mango", "cottage"], "snack", ["light", "protein"], 210, 15),
];

/**
 * A sensible single portion of a food, for people who want to measure: the
 * weight in grams, and a household description ("2 eggs", "half a cup"). The
 * kitchen shows one or the other by a toggle. Values are typical home portions,
 * not prescriptions — a starting point to weigh against.
 */
export type Portion = { g: number; he: string; en: string };

const DEFAULT_PORTION: Portion = { g: 100, he: "בגודל אגרוף", en: "a fist-sized amount" };

const PORTIONS: Record<string, Portion> = {
  egg: { g: 100, he: "2 ביצים", en: "2 eggs" },
  chicken: { g: 150, he: "חזה בינוני", en: "1 medium breast" },
  turkey: { g: 150, he: "פרוסות", en: "a few slices" },
  beef: { g: 150, he: "נתח בגודל כף יד", en: "a palm-sized piece" },
  pork: { g: 150, he: "נתח בגודל כף יד", en: "a palm-sized piece" },
  lamb: { g: 150, he: "נתח בגודל כף יד", en: "a palm-sized piece" },
  sausage: { g: 80, he: "יחידה", en: "1 sausage" },
  tuna: { g: 100, he: "קופסה", en: "1 can" },
  salmon: { g: 150, he: "פילה", en: "1 fillet" },
  fish: { g: 150, he: "פילה", en: "1 fillet" },
  shrimp: { g: 100, he: "חופן", en: "a handful" },
  sardines: { g: 90, he: "קופסה", en: "1 can" },
  tofu: { g: 120, he: "חצי חבילה", en: "half a block" },
  lentils: { g: 150, he: "כוס מבושל", en: "1 cup cooked" },
  chickpeas: { g: 150, he: "כוס", en: "1 cup" },
  beans: { g: 150, he: "כוס", en: "1 cup" },
  edamame: { g: 100, he: "חופן", en: "a handful" },
  peas: { g: 80, he: "חצי כוס", en: "1/2 cup" },
  proteinPowder: { g: 30, he: "סקופ", en: "1 scoop" },
  cottage: { g: 150, he: "גביע", en: "1 tub" },
  whiteCheese: { g: 100, he: "4 כפות גדושות", en: "4 heaped tablespoons" },
  greekYogurt: { g: 170, he: "גביע", en: "1 cup" },
  yellowCheese: { g: 30, he: "2 פרוסות", en: "2 slices" },
  mozzarella: { g: 60, he: "כדור", en: "1 ball" },
  creamCheese: { g: 30, he: "כף גדושה", en: "1 tbsp" },
  feta: { g: 50, he: "קוביות", en: "a few cubes" },
  butter: { g: 10, he: "כפית", en: "1 tsp" },
  milk: { g: 200, he: "כוס", en: "1 cup" },
  wholeBread: { g: 40, he: "פרוסה", en: "1 slice" },
  bread: { g: 30, he: "פרוסה", en: "1 slice" },
  bagel: { g: 90, he: "יחידה", en: "1 bagel" },
  tortilla: { g: 60, he: "יחידה", en: "1 wrap" },
  oats: { g: 50, he: "חצי כוס", en: "1/2 cup dry" },
  rice: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  pasta: { g: 80, he: "מנה יבשה", en: "1 dry portion" },
  noodles: { g: 80, he: "חופן יבש", en: "a dry handful" },
  quinoa: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  couscous: { g: 75, he: "חצי כוס", en: "1/2 cup" },
  bulgur: { g: 75, he: "חצי כוס", en: "1/2 cup" },
  cornflakes: { g: 40, he: "קערה", en: "1 bowl" },
  granola: { g: 45, he: "חופן", en: "a handful" },
  riceCakes: { g: 20, he: "2 יחידות", en: "2 cakes" },
  potato: { g: 180, he: "יחידה בינונית", en: "1 medium" },
  sweetPotato: { g: 180, he: "יחידה", en: "1 medium" },
  corn: { g: 100, he: "קלח", en: "1 cob" },
  cornVeg: { g: 80, he: "חצי כוס", en: "1/2 cup" },
  tomato: { g: 120, he: "יחידה", en: "1 tomato" },
  cucumber: { g: 100, he: "יחידה", en: "1 cucumber" },
  lettuce: { g: 50, he: "חופן עלים", en: "a handful" },
  pepper: { g: 120, he: "יחידה", en: "1 pepper" },
  onion: { g: 80, he: "חצי בצל", en: "1/2 onion" },
  garlic: { g: 6, he: "2 שיני שום", en: "2 cloves" },
  spinach: { g: 60, he: "חופן", en: "a handful" },
  carrot: { g: 70, he: "יחידה", en: "1 carrot" },
  broccoli: { g: 90, he: "כמה פרחים", en: "a few florets" },
  cauliflower: { g: 90, he: "כמה פרחים", en: "a few florets" },
  zucchini: { g: 120, he: "יחידה", en: "1 zucchini" },
  mushroom: { g: 80, he: "חופן", en: "a handful" },
  eggplant: { g: 150, he: "חצי חציל", en: "1/2 eggplant" },
  avocado: { g: 100, he: "חצי אבוקדו", en: "1/2 avocado" },
  cabbage: { g: 80, he: "חופן קצוץ", en: "a handful" },
  greenBeans: { g: 90, he: "חופן", en: "a handful" },
  beetroot: { g: 100, he: "יחידה", en: "1 beet" },
  celery: { g: 40, he: "גבעול", en: "1 stalk" },
  banana: { g: 120, he: "יחידה", en: "1 banana" },
  apple: { g: 150, he: "יחידה", en: "1 apple" },
  berries: { g: 100, he: "חופן", en: "a handful" },
  orange: { g: 130, he: "יחידה", en: "1 orange" },
  lemon: { g: 20, he: "סחיטה", en: "a squeeze" },
  dates: { g: 24, he: "2 תמרים", en: "2 dates" },
  grapes: { g: 100, he: "אשכול קטן", en: "a small bunch" },
  mango: { g: 150, he: "חצי מנגו", en: "1/2 mango" },
  watermelon: { g: 200, he: "פרוסה", en: "1 slice" },
  pear: { g: 150, he: "יחידה", en: "1 pear" },
  pineapple: { g: 120, he: "פרוסה", en: "1 slice" },
  pomegranate: { g: 100, he: "חצי רימון", en: "1/2 fruit" },
  oliveOil: { g: 10, he: "כף", en: "1 tbsp" },
  tahini: { g: 20, he: "כף", en: "1 tbsp" },
  nuts: { g: 25, he: "חופן", en: "a handful" },
  peanutButter: { g: 20, he: "כף", en: "1 tbsp" },
  olives: { g: 30, he: "כמה יחידות", en: "a few" },
  hummusSpread: { g: 60, he: "כף גדושה", en: "2 tbsp" },
  honey: { g: 15, he: "כף", en: "1 tbsp" },
  darkChocolate: { g: 20, he: "2 קוביות", en: "2 squares" },
  mayo: { g: 15, he: "כף", en: "1 tbsp" },
  ketchup: { g: 15, he: "כף", en: "1 tbsp" },
  chia: { g: 15, he: "כף", en: "1 tbsp" },
};

export function portion(foodId: string): Portion {
  return PORTIONS[foodId] ?? DEFAULT_PORTION;
}

/**
 * Rough nutrition per 100 g by food category. This is the free workaround for
 * "recognise any food without an API": we cannot know the exact calories of a
 * word we have never seen, but we can place it in a category and estimate from
 * there. Real per-food data would be better; these are honest ballparks, and
 * the UI labels every figure built from them as an estimate.
 */
export const CATEGORY_NUTRITION: Record<FoodTag, { kcal: number; protein: number }> = {
  protein: { kcal: 165, protein: 22 },
  dairy: { kcal: 95, protein: 7 },
  carb: { kcal: 130, protein: 4 },
  veg: { kcal: 35, protein: 2 },
  fruit: { kcal: 58, protein: 1 },
  fat: { kcal: 600, protein: 3 },
};

/** Estimated calories and protein for one portion of a food. */
export function foodNutrition(food: Food): { kcal: number; protein: number } {
  const tag = food.tags[0] ?? "carb";
  const d = CATEGORY_NUTRITION[tag];
  const g = portion(food.id).g;
  return { kcal: Math.round((d.kcal * g) / 100), protein: Math.round((d.protein * g) / 100) };
}

/**
 * A food the app does not know, typed by the user. It gets a neutral identity
 * so it can still be listed, drawn and counted — nothing the person writes is
 * simply ignored. Its id is prefixed so it never collides with a real food.
 */
export function adhocFood(word: string): Food {
  return {
    id: `x:${word}`,
    tags: ["carb"],
    he: word,
    en: word,
    match: [],
    shape: "blob",
    color: "#8AA0B4",
  };
}
