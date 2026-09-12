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
 * `shape` and `color`, which compose the drawn plate a meal card shows while
 * its photograph loads — and keeps showing when there is no network.
 *
 * The photograph itself is a real one, searched for on Wikimedia Commons by
 * each meal's `photo` phrase; `photo.ts` covers why it is a photo and not a
 * generated image.
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
  F("rice", ["carb"], "אורז", "rice", ["אורז לבן", "אורז", "rice"], "grain", "#F3EFE0"),
  F("pasta", ["carb"], "פסטה", "pasta", ["פסטה", "ספגטי", "פנה", "pasta", "spaghetti"], "long", "#EAD79B"),
  F("potato", ["carb", "veg"], "תפוח אדמה", "potato", ["תפוח אדמה", "תפוחי אדמה", "תפוד", "potato", "potatoes"], "round", "#D8B77A"),
  F("sweetPotato", ["carb", "veg"], "בטטה", "sweet potato", ["בטטה", "בטטות", "sweet potato"], "long", "#E08A4B"),
  F("quinoa", ["carb", "protein"], "קינואה", "quinoa", ["קינואה", "quinoa"], "grain", "#E6DCC0"),
  F("couscous", ["carb"], "קוסקוס", "couscous", ["קוסקוס", "פתיתים", "couscous"], "grain", "#EAD9A0"),
  F("tortilla", ["carb"], "טורטייה", "tortilla", ["טורטייה", "לאפה", "tortilla", "wrap"], "round", "#E7CE9A"),
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
  F("berries", ["fruit"], "פירות יער", "berries", ["פירות יער", "אוכמניות", "פטל", "berries", "blueberries"], "round", "#8E3B6B"),
  F("orange", ["fruit"], "תפוז", "orange", ["תפוז", "תפוזים", "orange", "oranges"], "round", "#E88A2A"),
  F("lemon", ["fruit"], "לימון", "lemon", ["לימון", "lemon"], "round", "#EED94B"),
  F("dates", ["fruit"], "תמרים", "dates", ["תמרים", "תמר", "dates"], "long", "#7A4A2B"),
  // -- fats / spreads
  F("oliveOil", ["fat"], "שמן זית", "olive oil", ["שמן זית", "olive oil"], "drop", "#B7B84A"),
  F("tahini", ["fat", "protein"], "טחינה", "tahini", ["טחינה", "tahini"], "blob", "#E8E2C8"),
  F("nuts", ["fat", "protein"], "אגוזים", "nuts", ["אגוזים מעורבים", "אגוזים", "nuts", "mixed nuts"], "grain", "#A9743F"),
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
  // -- the healthy staples the first pass missed. Whole grains that are not
  //    white rice, the pulses and seeds a Mediterranean plate leans on, dark
  //    leafy greens, fermented dairy, and the produce an Israeli greengrocer
  //    actually stocks — kohlrabi, persimmon, clementines. Everything here is
  //    something a person can buy in a normal shop and cook the same evening.
  // -- whole grains & starches
  F("freekeh", ["carb", "protein"], "פריקה", "freekeh", ["פריקה", "פריכה", "freekeh"], "grain", "#8F8C4B"),
  F("barley", ["carb", "protein"], "גריסי פנינה", "pearl barley", ["גריסי פנינה", "גריסים", "שעורה", "barley"], "grain", "#D8C79A"),
  F("buckwheat", ["carb", "protein"], "כוסמת", "buckwheat", ["כוסמת", "buckwheat"], "grain", "#9A7B55"),
  F("brownRice", ["carb"], "אורז מלא", "brown rice", ["אורז מלא", "אורז חום", "brown rice"], "grain", "#C7A878"),
  F("millet", ["carb"], "דוחן", "millet", ["דוחן", "millet"], "grain", "#E3C874"),
  F("pitaWhole", ["carb"], "פיתה מלאה", "wholemeal pita", ["פיתה מלאה", "פיתה קמח מלא", "wholemeal pita", "whole wheat pita"], "round", "#C9A469"),
  F("pita", ["carb"], "פיתה", "pita", ["פיתה", "פיתות", "pita"], "round", "#E2C287"),
  // -- pulses & plant proteins
  F("blackBeans", ["protein"], "שעועית שחורה", "black beans", ["שעועית שחורה", "black beans"], "grain", "#3E3348"),
  F("fava", ["protein"], "פול", "fava beans", ["פול ירוק", "פול", "fava", "broad beans"], "grain", "#8FA05A"),
  F("tempeh", ["protein"], "טמפה", "tempeh", ["טמפה", "tempeh"], "slice", "#C8A96B"),
  // -- fermented & cultured dairy
  F("labneh", ["dairy", "protein", "fat"], "לאבנה", "labneh", ["לאבנה", "לבאנה", "labneh"], "blob", "#F6F1E4"),
  F("kefir", ["dairy", "protein"], "קפיר", "kefir", ["קפיר", "kefir"], "drop", "#F4F1E8"),
  F("skyr", ["dairy", "protein"], "סקיר", "skyr", ["סקיר", "skyr"], "blob", "#F8F5EC"),
  // -- oily fish
  F("mackerel", ["protein", "fat"], "מקרל", "mackerel", ["מקרל", "מקריל", "mackerel"], "long", "#7C8B96"),
  // -- dark leaves & cruciferous
  F("kale", ["veg"], "קייל", "kale", ["קייל", "כרוב עלים", "kale"], "leaf", "#3F6B3A"),
  F("arugula", ["veg"], "רוקט", "rocket", ["עלי רוקט", "רוקט", "ארוגולה", "rocket", "arugula"], "leaf", "#4E8A3C"),
  F("chard", ["veg"], "מנגולד", "chard", ["מנגולד", "סלק עלים", "chard", "swiss chard"], "leaf", "#4C7A3E"),
  F("brusselsSprouts", ["veg"], "כרוב ניצנים", "brussels sprouts", ["כרוב ניצנים", "brussels sprouts"], "round", "#6E9B4A"),
  F("kohlrabi", ["veg"], "קולרבי", "kohlrabi", ["קולרבי", "קולורבי", "kohlrabi"], "round", "#B7C98A"),
  F("radish", ["veg"], "צנונית", "radish", ["צנוניות", "צנונית", "צנון", "radish"], "round", "#CE4E6A"),
  // -- more veg worth having on a plate
  F("asparagus", ["veg"], "אספרגוס", "asparagus", ["אספרגוס", "asparagus"], "long", "#6E9B54"),
  F("pumpkin", ["veg"], "דלעת", "pumpkin", ["דלעת", "pumpkin"], "round", "#E08A2E"),
  F("artichoke", ["veg"], "ארטישוק", "artichoke", ["ארטישוק", "artichoke"], "round", "#7E8B58"),
  F("leek", ["veg"], "כרישה", "leek", ["כרישה", "כרישות", "leek"], "long", "#9BBE6A"),
  F("parsley", ["veg"], "פטרוזיליה", "parsley", ["פטרוזיליה", "parsley"], "leaf", "#3F7A3A"),
  F("cilantro", ["veg"], "כוסברה", "coriander", ["כוסברה", "coriander", "cilantro"], "leaf", "#4C8A44"),
  F("kimchi", ["veg"], "קימצ'י", "kimchi", ["קימצ'י", "קימצי", "כרוב כבוש", "kimchi", "sauerkraut"], "leaf", "#C2472E"),
  // -- fruit
  F("strawberries", ["fruit"], "תותים", "strawberries", ["תותים", "תות שדה", "תות", "strawberries", "strawberry"], "round", "#D8354A"),
  F("kiwi", ["fruit"], "קיווי", "kiwi", ["קיווי", "kiwi"], "round", "#7FA83C"),
  F("clementine", ["fruit"], "קלמנטינה", "clementine", ["קלמנטינות", "קלמנטינה", "מנדרינה", "clementine", "mandarin"], "round", "#F09030"),
  F("grapefruit", ["fruit"], "אשכולית", "grapefruit", ["אשכולית", "grapefruit"], "round", "#E9705E"),
  F("peach", ["fruit"], "אפרסק", "peach", ["אפרסקים", "אפרסק", "peach"], "round", "#F2A05E"),
  F("apricot", ["fruit"], "משמש", "apricot", ["משמשים", "משמש", "apricot"], "round", "#F0A94C"),
  F("plum", ["fruit"], "שזיף", "plum", ["שזיפים", "שזיף", "plum"], "round", "#7C3A5E"),
  F("fig", ["fruit"], "תאנה", "figs", ["תאנים", "תאנה", "figs", "fig"], "round", "#6E4A6B"),
  F("persimmon", ["fruit"], "אפרסמון", "persimmon", ["אפרסמון", "persimmon"], "round", "#E8792C"),
  F("cherries", ["fruit"], "דובדבנים", "cherries", ["דובדבנים", "דובדבן", "cherries"], "round", "#A8253C"),
  // -- nuts & seeds, named rather than lumped in with "nuts"
  F("almonds", ["fat", "protein"], "שקדים", "almonds", ["שקדים", "שקד", "almonds"], "grain", "#C39A6B"),
  F("walnuts", ["fat", "protein"], "אגוזי מלך", "walnuts", ["אגוזי מלך", "walnuts"], "grain", "#8A6A45"),
  F("pumpkinSeeds", ["fat", "protein"], "גרעיני דלעת", "pumpkin seeds", ["גרעיני דלעת", "pumpkin seeds", "pepitas"], "grain", "#6E8B3F"),
  F("sunflowerSeeds", ["fat", "protein"], "גרעיני חמנייה", "sunflower seeds", ["גרעיני חמנייה", "גרעינים לבנים", "sunflower seeds"], "grain", "#B8925A"),
  F("flaxseed", ["fat", "protein"], "זרעי פשתן", "flaxseed", ["זרעי פשתן", "פשתן", "flaxseed", "linseed"], "grain", "#8A5F35"),
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
  /**
   * What to search Wikimedia Commons for to get a real photograph of this dish
   * — see `photo.ts`. English, and worded the way a photographer would have
   * captioned the picture ("shakshouka", not "Shakshuka with feta on the
   * side"), because that is what the search has to match. Required, so a new
   * dish cannot quietly ship without a photo.
   */
  photo: string;
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
  photo: string,
): Meal => ({ id, he, en, uses, slot, notes, kcal, protein, photo });

export const MEALS: Meal[] = [
  M("omelette-salad",
    { title: "חביתה עם סלט", how: "מטגנים 2 ביצים במעט שמן זית, לצד עגבנייה ומלפפון קצוצים." },
    { title: "Omelette with salad", how: "Two eggs in a little olive oil, with chopped tomato and cucumber." },
    ["egg", "tomato", "cucumber", "oliveOil"], "breakfast", ["protein", "light"], 320, 20, "omelette"),
  M("shakshuka",
    { title: "שקשוקה", how: "מבשלים עגבנייה, פלפל ובצל, שוברים פנימה 2 ביצים ומכסים עד שהחלבון נקרש." },
    { title: "Shakshuka", how: "Simmer tomato, pepper and onion, crack in two eggs and cover until set." },
    ["egg", "tomato", "pepper", "onion"], "breakfast", ["protein", "veg"], 360, 19, "shakshouka"),
  M("yogurt-bowl",
    { title: "קערת יוגורט", how: "יוגורט יווני עם בננה פרוסה, כף שיבולת שועל וקצת אגוזים." },
    { title: "Yogurt bowl", how: "Greek yogurt with sliced banana, a spoon of oats and a few nuts." },
    ["greekYogurt", "banana", "oats", "nuts"], "breakfast", ["protein", "balanced"], 380, 24, "yogurt fruit bowl"),
  M("cottage-toast",
    { title: "קוטג' על לחם מלא", how: "פרוסת לחם מלא עם קוטג' ופרוסות עגבנייה, מלח ופלפל." },
    { title: "Cottage on toast", how: "Whole-grain bread with cottage cheese and tomato, salt and pepper." },
    ["cottage", "wholeBread", "tomato"], "breakfast", ["light", "protein"], 260, 18, "cottage cheese toast"),
  M("oatmeal-pb",
    { title: "דייסת שיבולת שועל", how: "מבשלים שיבולת שועל בחלב, מוסיפים בננה וכף חמאת בוטנים." },
    { title: "Oatmeal", how: "Cook oats in milk, top with banana and a spoon of peanut butter." },
    ["oats", "milk", "banana", "peanutButter"], "breakfast", ["hearty", "balanced"], 420, 15, "porridge oatmeal bowl"),
  M("avocado-egg-toast",
    { title: "טוסט אבוקדו וביצה", how: "לחם מלא, אבוקדו מעוך וביצה קשה או עלומה מעל." },
    { title: "Avocado & egg toast", how: "Whole-grain bread, mashed avocado, a boiled or poached egg on top." },
    ["wholeBread", "avocado", "egg"], "breakfast", ["balanced", "protein"], 340, 15, "avocado toast egg"),
  M("tuna-salad",
    { title: "סלט טונה", how: "טונה במים על מצע חסה, מלפפון ועגבנייה, כפית שמן זית ולימון." },
    { title: "Tuna salad", how: "Tuna in water over lettuce, cucumber and tomato, olive oil and lemon." },
    ["tuna", "lettuce", "cucumber", "tomato", "oliveOil"], "lunch", ["light", "protein"], 300, 28, "tuna salad"),
  M("chicken-rice-broccoli",
    { title: "עוף עם אורז וברוקולי", how: "חזה עוף צלוי, חצי כוס אורז וברוקולי מאודה." },
    { title: "Chicken, rice & broccoli", how: "Grilled chicken breast, half a cup of rice and steamed broccoli." },
    ["chicken", "rice", "broccoli"], "lunch", ["protein", "hearty"], 480, 40, "chicken breast rice broccoli"),
  M("chicken-sweet-potato",
    { title: "עוף עם בטטה וסלט", how: "חזה עוף, בטטה בתנור וסלט ירוק לצד." },
    { title: "Chicken with sweet potato", how: "Chicken breast, roasted sweet potato and a green salad." },
    ["chicken", "sweetPotato", "lettuce"], "lunch", ["protein", "balanced"], 460, 38, "roast chicken sweet potato"),
  M("beef-rice",
    { title: "בקר עם אורז וירקות", how: "רצועות בקר רזה מוקפצות עם פלפל ובצל, על אורז." },
    { title: "Beef with rice", how: "Lean beef strips stir-fried with pepper and onion, over rice." },
    ["beef", "rice", "pepper", "onion"], "dinner", ["protein", "hearty"], 540, 35, "beef stir fry rice"),
  M("lentil-soup",
    { title: "מרק עדשים", how: "מבשלים עדשים עם גזר ובצל ומעט כמון עד שהכול רך." },
    { title: "Lentil soup", how: "Simmer lentils with carrot and onion and a little cumin until soft." },
    ["lentils", "carrot", "onion"], "dinner", ["veg", "protein", "light"], 300, 18, "lentil soup"),
  M("hummus-bowl",
    { title: "קערת חומוס", how: "גרגירי חומוס עם טחינה, עגבנייה ומלפפון קצוצים ושמן זית." },
    { title: "Chickpea bowl", how: "Chickpeas with tahini, chopped tomato and cucumber and olive oil." },
    ["chickpeas", "tahini", "tomato", "cucumber"], "lunch", ["veg", "protein"], 400, 17, "hummus chickpeas"),
  M("tofu-stirfry",
    { title: "מוקפץ טופו", how: "מקפיצים טופו עם פלפל וברוקולי בסויה, מגישים על אורז." },
    { title: "Tofu stir-fry", how: "Stir-fry tofu with pepper and broccoli in soy sauce, serve over rice." },
    ["tofu", "pepper", "broccoli", "rice"], "dinner", ["veg", "protein"], 430, 24, "tofu stir fry"),
  M("salmon-quinoa",
    { title: "סלמון עם קינואה", how: "פילה סלמון בתנור, קינואה ותרד מוקפץ קלות." },
    { title: "Salmon with quinoa", how: "Baked salmon fillet, quinoa and lightly sautéed spinach." },
    ["salmon", "quinoa", "spinach"], "dinner", ["protein", "balanced"], 500, 34, "salmon quinoa"),
  M("fish-potato",
    { title: "דג עם תפוח אדמה", how: "פילה דג בתנור עם תפוחי אדמה ולימון, לצד סלט." },
    { title: "Fish with potato", how: "Baked white fish with potatoes and lemon, salad on the side." },
    ["fish", "potato", "lemon"], "dinner", ["protein", "balanced"], 420, 30, "baked fish potatoes"),
  M("turkey-wrap",
    { title: "טורטייה עם הודו", how: "טורטייה עם חזה הודו, חסה ועגבנייה, כפית טחינה." },
    { title: "Turkey wrap", how: "Tortilla with turkey breast, lettuce and tomato, a little tahini." },
    ["turkey", "tortilla", "lettuce", "tomato"], "lunch", ["light", "protein"], 350, 26, "turkey wrap sandwich"),
  M("pasta-veg",
    { title: "פסטה עם ירקות", how: "פסטה עם רוטב עגבניות, קישוא ובצל בשמן זית." },
    { title: "Pasta with vegetables", how: "Pasta with tomato sauce, zucchini and onion in olive oil." },
    ["pasta", "tomato", "zucchini", "onion"], "dinner", ["veg", "hearty"], 470, 13, "pasta with vegetables"),
  M("baked-potato-cottage",
    { title: "תפוח אדמה אפוי עם קוטג'", how: "תפוח אדמה בתנור, פתוח וממולא בקוטג', לצד סלט." },
    { title: "Baked potato with cottage", how: "Oven-baked potato, split and filled with cottage cheese." },
    ["potato", "cottage", "cucumber"], "dinner", ["light", "protein"], 330, 20, "baked potato"),
  M("white-cheese-plate",
    { title: "צלחת גבינה לבנה וירקות", how: "גבינה לבנה 5% עם ירקות חתוכים ופרוסת לחם מלא." },
    { title: "White cheese & veg plate", how: "Low-fat white cheese with cut vegetables and whole-grain bread." },
    ["whiteCheese", "cucumber", "tomato", "wholeBread"], "breakfast", ["light", "protein"], 280, 19, "white cheese vegetables plate"),
  M("feta-salad",
    { title: "סלט יווני עם פטה", how: "עגבנייה, מלפפון, בצל וזיתים עם קוביות פטה ושמן זית." },
    { title: "Greek salad with feta", how: "Tomato, cucumber, onion and olives with feta cubes and olive oil." },
    ["feta", "tomato", "cucumber", "onion", "olives"], "lunch", ["veg", "light"], 320, 12, "greek salad"),
  M("chickpea-quinoa",
    { title: "קערת קינואה וחומוס", how: "קינואה עם גרגירי חומוס, תרד ולימון — צמחוני ומשביע." },
    { title: "Quinoa & chickpea bowl", how: "Quinoa with chickpeas, spinach and lemon — vegetarian and filling." },
    ["quinoa", "chickpeas", "spinach", "lemon"], "lunch", ["veg", "protein", "hearty"], 440, 20, "quinoa chickpea salad bowl"),
  M("apple-pb",
    { title: "תפוח עם חמאת בוטנים", how: "תפוח פרוס עם כף חמאת בוטנים — נשנוש שמחזיק." },
    { title: "Apple & peanut butter", how: "Sliced apple with a spoon of peanut butter — a snack that holds." },
    ["apple", "peanutButter"], "snack", ["balanced"], 200, 6, "peanut butter apple slices snack"),
  M("yogurt-berries",
    { title: "יוגורט עם פירות יער", how: "יוגורט יווני עם חופן פירות יער — קליל וחלבוני." },
    { title: "Yogurt & berries", how: "Greek yogurt with a handful of berries — light and high in protein." },
    ["greekYogurt", "berries"], "snack", ["light", "protein"], 180, 17, "yogurt with berries"),
  M("nuts-banana",
    { title: "בננה עם אגוזים", how: "בננה וחופן אגוזים — אנרגיה מהירה לפני או אחרי אימון." },
    { title: "Banana & nuts", how: "A banana and a handful of nuts — quick energy before or after a workout." },
    ["banana", "nuts"], "snack", ["hearty", "balanced"], 260, 7, "banana with walnuts"),
  // Dishes the dietary filters actually remove. Without these the menu was
  // entirely kosher already, so turning the kosher filter on changed nothing
  // on screen — a filter that hides nothing reads as a filter that is broken.
  M("cheeseburger",
    { title: "בורגר עם צהובה", how: "קציצת בקר בלחמנייה עם פרוסת גבינה צהובה, עגבנייה ובצל." },
    { title: "Cheeseburger", how: "A beef patty in a bun with a slice of yellow cheese, tomato and onion." },
    ["beef", "yellowCheese", "bread", "tomato", "onion"], "dinner", ["hearty", "protein"], 620, 38, "cheeseburger"),
  M("creamy-beef-pasta",
    { title: "פסטה בשמנת עם בקר", how: "פסטה ברוטב שמנת עם רצועות בקר ופטריות מוקפצות." },
    { title: "Creamy beef pasta", how: "Pasta in a cream sauce with strips of beef and sautéed mushrooms." },
    ["pasta", "beef", "creamCheese", "mushroom"], "dinner", ["hearty", "protein"], 680, 36, "beef pasta cream sauce"),
  M("sausage-cheese-toast",
    { title: "טוסט נקניק וגבינה", how: "טוסט חם עם נקניק ופרוסת גבינה צהובה, עגבנייה בפנים." },
    { title: "Sausage & cheese toast", how: "A hot toastie with sausage, yellow cheese and tomato inside." },
    ["bread", "sausage", "yellowCheese", "tomato"], "lunch", ["hearty"], 520, 26, "toasted sandwich sausage cheese"),
  M("shrimp-stirfry",
    { title: "שרימפס מוקפץ עם ירקות", how: "שרימפס מוקפץ עם ברוקולי ופלפל בשמן זית, לצד אורז." },
    { title: "Shrimp stir-fry", how: "Shrimp seared with broccoli and pepper in olive oil, over rice." },
    ["shrimp", "broccoli", "pepper", "rice", "oliveOil"], "dinner", ["protein", "veg"], 430, 32, "shrimp stir fry vegetables"),
  M("lamb-yogurt-bowl",
    { title: "כבש עם יוגורט ובורגול", how: "כבש צלוי על בורגול, כף יוגורט ונענע מעל." },
    { title: "Lamb & yogurt bowl", how: "Roast lamb over bulgur, a spoon of yogurt and mint on top." },
    ["lamb", "greekYogurt", "bulgur", "onion"], "dinner", ["hearty", "protein"], 590, 40, "roast lamb bulgur"),

  // Depth, so the daily rotation has somewhere to rotate to. A menu of two
  // dozen dishes repeats inside a week however cleverly it is sorted.
  M("egg-avocado-bowl",
    { title: "קערת ביצים ואבוקדו", how: "2 ביצים קשות עם אבוקדו מעוך ועגבנייה, כפית שמן זית." },
    { title: "Egg & avocado bowl", how: "Two boiled eggs with mashed avocado and tomato, a little olive oil." },
    ["egg", "avocado", "tomato", "oliveOil"], "breakfast", ["protein", "balanced"], 400, 18, "boiled eggs avocado"),
  M("cottage-fruit",
    { title: "קוטג' עם פירות", how: "קוטג' עם חופן פירות יער וכמה אגוזים." },
    { title: "Cottage & fruit", how: "Cottage cheese with a handful of berries and a few nuts." },
    ["cottage", "berries", "nuts"], "breakfast", ["light", "protein"], 250, 20, "cottage cheese berries"),
  M("granola-yogurt",
    { title: "גרנולה עם יוגורט", how: "יוגורט יווני עם גרנולה ובננה פרוסה." },
    { title: "Granola & yogurt", how: "Greek yogurt with granola and sliced banana." },
    ["granola", "greekYogurt", "banana"], "breakfast", ["hearty", "balanced"], 430, 20, "granola yogurt"),
  M("chia-pudding",
    { title: "פודינג צ'יה", how: "כף צ'יה בחלב בלילה, פירות יער מעל בבוקר." },
    { title: "Chia pudding", how: "A spoon of chia in milk overnight, berries on top in the morning." },
    ["chia", "milk", "berries"], "breakfast", ["light", "balanced"], 240, 10, "chia seed pudding jar"),
  M("bagel-cheese",
    { title: "בייגל עם גבינה", how: "בייגל חתוך עם גבינה לבנה ומלפפון." },
    { title: "Bagel with cheese", how: "A split bagel with white cheese and cucumber." },
    ["bagel", "whiteCheese", "cucumber"], "breakfast", ["hearty"], 390, 16, "bagel cream cheese"),
  M("protein-shake-banana",
    { title: "שייק חלבון ובננה", how: "מנת אבקת חלבון בחלב עם בננה — מהיר לפני יציאה." },
    { title: "Protein & banana shake", how: "A scoop of protein in milk with a banana — fast before you leave." },
    ["proteinPowder", "milk", "banana"], "breakfast", ["protein"], 330, 32, "banana smoothie glass"),
  M("cornflakes-milk",
    { title: "קורנפלקס עם חלב", how: "קורנפלקס בחלב עם בננה פרוסה." },
    { title: "Cornflakes & milk", how: "Cornflakes in milk with sliced banana." },
    ["cornflakes", "milk", "banana"], "breakfast", ["balanced"], 350, 13, "cornflakes milk bowl"),
  M("rice-cakes-pb",
    { title: "פריכיות עם חמאת בוטנים", how: "שתי פריכיות אורז עם חמאת בוטנים ובננה." },
    { title: "Rice cakes & peanut butter", how: "Two rice cakes with peanut butter and banana." },
    ["riceCakes", "peanutButter", "banana"], "snack", ["balanced"], 270, 9, "rice cakes peanut butter"),
  M("chicken-quinoa",
    { title: "עוף עם קינואה", how: "חזה עוף צלוי עם קינואה וקישוא בתנור." },
    { title: "Chicken & quinoa", how: "Roast chicken breast with quinoa and oven-baked courgette." },
    ["chicken", "quinoa", "zucchini", "oliveOil"], "lunch", ["protein", "balanced"], 460, 40, "chicken quinoa"),
  M("turkey-rice-bowl",
    { title: "קערת הודו ואורז", how: "רצועות הודו מוקפצות עם פלפל ובצל על אורז." },
    { title: "Turkey rice bowl", how: "Turkey strips stir-fried with pepper and onion over rice." },
    ["turkey", "rice", "pepper", "onion"], "lunch", ["protein", "hearty"], 510, 42, "turkey rice"),
  M("tuna-potato",
    { title: "טונה עם תפוח אדמה", how: "טונה על תפוח אדמה אפוי עם סלט חסה." },
    { title: "Tuna & potato", how: "Tuna over a baked potato with a lettuce salad." },
    ["tuna", "potato", "lettuce", "oliveOil"], "lunch", ["protein", "balanced"], 420, 32, "tuna baked potato"),
  M("chickpea-salad",
    { title: "סלט חומוס", how: "גרגירי חומוס עם ירקות קצוצים וכף טחינה." },
    { title: "Chickpea salad", how: "Chickpeas with chopped vegetables and a spoon of tahini." },
    ["chickpeas", "tomato", "cucumber", "tahini"], "lunch", ["veg", "protein"], 380, 16, "chickpea salad"),
  M("beef-sweet-potato",
    { title: "בקר עם בטטה", how: "בקר צלוי עם בטטה אפויה ותרד מוקפץ." },
    { title: "Beef & sweet potato", how: "Roast beef with baked sweet potato and sautéed spinach." },
    ["beef", "sweetPotato", "spinach"], "lunch", ["hearty", "protein"], 560, 44, "beef sweet potato"),
  M("egg-fried-rice",
    { title: "אורז מוקפץ עם ביצה", how: "אורז מוקפץ עם ביצה, אפונה וגזר." },
    { title: "Egg fried rice", how: "Rice stir-fried with egg, peas and carrot." },
    ["rice", "egg", "peas", "carrot"], "lunch", ["balanced"], 440, 18, "egg fried rice"),
  M("shakshuka-feta",
    { title: "שקשוקה עם פטה", how: "שקשוקה קלאסית עם פטה מפוררת מעל בסוף הבישול." },
    { title: "Shakshuka with feta", how: "Classic shakshuka with feta crumbled over at the end." },
    ["egg", "tomato", "pepper", "feta"], "breakfast", ["protein", "veg"], 410, 24, "shakshouka feta"),
  M("chicken-couscous",
    { title: "עוף עם קוסקוס", how: "עוף מבושל עם ירקות שורש על קוסקוס." },
    { title: "Chicken couscous", how: "Braised chicken with root vegetables over couscous." },
    ["chicken", "couscous", "carrot", "zucchini"], "lunch", ["hearty", "protein"], 530, 40, "chicken couscous"),
  M("bulgur-veg",
    { title: "בורגול עם ירקות", how: "בורגול תפוח עם ירקות קצוצים ולימון." },
    { title: "Bulgur & vegetables", how: "Fluffed bulgur with chopped vegetables and lemon." },
    ["bulgur", "tomato", "cucumber", "oliveOil"], "lunch", ["veg", "light"], 330, 9, "bulgur salad"),
  M("salmon-veg",
    { title: "סלמון עם ירקות", how: "פילה סלמון בתנור עם ברוקולי ובטטה." },
    { title: "Salmon & vegetables", how: "Baked salmon fillet with broccoli and sweet potato." },
    ["salmon", "broccoli", "sweetPotato"], "dinner", ["protein", "hearty"], 520, 38, "baked salmon vegetables"),
  M("sardines-salad",
    { title: "סרדינים עם סלט", how: "סרדינים על סלט חסה ועגבנייה עם לימון." },
    { title: "Sardines & salad", how: "Sardines over a lettuce and tomato salad with lemon." },
    ["sardines", "lettuce", "tomato", "lemon"], "dinner", ["light", "protein"], 290, 26, "sardines salad"),
  M("chicken-cauliflower",
    { title: "עוף עם כרובית", how: "עוף צלוי עם כרובית בתנור ושום." },
    { title: "Chicken & cauliflower", how: "Roast chicken with oven-roasted cauliflower and garlic." },
    ["chicken", "cauliflower", "garlic", "oliveOil"], "dinner", ["light", "protein"], 390, 38, "roast chicken cauliflower"),
  M("bean-stew",
    { title: "תבשיל שעועית", how: "שעועית מבושלת ברוטב עגבניות עם בצל ושום." },
    { title: "Bean stew", how: "Beans simmered in tomato with onion and garlic." },
    ["beans", "tomato", "onion", "garlic"], "dinner", ["veg", "hearty"], 380, 18, "bean stew tomato"),
  M("omelette-mushroom",
    { title: "חביתת פטריות", how: "חביתה עם פטריות מוקפצות, בצל וגבינה צהובה." },
    { title: "Mushroom omelette", how: "An omelette with sautéed mushrooms, onion and cheese." },
    ["egg", "mushroom", "onion", "yellowCheese"], "dinner", ["protein"], 380, 24, "mushroom omelette plate"),
  M("edamame-rice",
    { title: "אדממה עם אורז", how: "אדממה עם אורז, גזר מגורד ותרד." },
    { title: "Edamame rice bowl", how: "Edamame with rice, grated carrot and spinach." },
    ["edamame", "rice", "carrot", "spinach"], "dinner", ["veg", "balanced"], 400, 20, "edamame rice bowl"),
  M("stuffed-pepper",
    { title: "פלפל ממולא", how: "פלפל ממולא באורז ובשר, אפוי ברוטב עגבניות." },
    { title: "Stuffed pepper", how: "Pepper stuffed with rice and beef, baked in tomato sauce." },
    ["pepper", "rice", "beef", "tomato"], "dinner", ["hearty", "protein"], 480, 30, "stuffed peppers"),
  M("eggplant-tahini",
    { title: "חציל עם טחינה", how: "חציל שרוף עם טחינה, עגבנייה ולימון." },
    { title: "Eggplant with tahini", how: "Charred eggplant with tahini, tomato and lemon." },
    ["eggplant", "tahini", "tomato", "lemon"], "dinner", ["veg", "light"], 300, 8, "eggplant tahini"),
  M("noodle-veg",
    { title: "נודלס עם ירקות", how: "נודלס מוקפצים עם ברוקולי, גזר וטופו." },
    { title: "Vegetable noodles", how: "Noodles stir-fried with broccoli, carrot and tofu." },
    ["noodles", "broccoli", "carrot", "tofu"], "dinner", ["balanced", "veg"], 450, 20, "stir fried noodles vegetables"),
  M("dates-nuts",
    { title: "תמרים עם אגוזים", how: "שני תמרים וחופן אגוזים — אנרגיה מהירה." },
    { title: "Dates & nuts", how: "Two dates and a handful of nuts — quick energy." },
    ["dates", "nuts"], "snack", ["hearty"], 220, 5, "dates and nuts"),
  M("cottage-cucumber",
    { title: "קוטג' עם מלפפון", how: "קוטג' עם מלפפון פרוס ומלח." },
    { title: "Cottage & cucumber", how: "Cottage cheese with sliced cucumber and salt." },
    ["cottage", "cucumber"], "snack", ["light", "protein"], 150, 14, "cottage cheese cucumber"),
  M("hummus-veg",
    { title: "חומוס עם ירקות", how: "חומוס עם גזר ומלפפון חתוכים למקלות." },
    { title: "Hummus & veg", how: "Hummus with carrot and cucumber sticks." },
    ["hummusSpread", "carrot", "cucumber"], "snack", ["veg", "balanced"], 210, 7, "hummus vegetable sticks"),
  M("dark-chocolate-almonds",
    { title: "שוקולד מריר עם אגוזים", how: "שתי קוביות שוקולד מריר וחופן אגוזים." },
    { title: "Dark chocolate & nuts", how: "Two squares of dark chocolate and a handful of nuts." },
    ["darkChocolate", "nuts"], "snack", ["hearty"], 230, 5, "dark chocolate almonds"),
  M("watermelon-feta",
    { title: "אבטיח עם פטה", how: "אבטיח קר עם פטה מפוררת ונענע." },
    { title: "Watermelon & feta", how: "Cold watermelon with crumbled feta and mint." },
    ["watermelon", "feta"], "snack", ["light"], 180, 8, "watermelon feta salad"),
  M("pear-cheese",
    { title: "אגס עם גבינה", how: "אגס פרוס עם גבינה לבנה." },
    { title: "Pear & cheese", how: "Sliced pear with white cheese." },
    ["pear", "whiteCheese"], "snack", ["light"], 190, 10, "cheese board with fruit"),
  M("pomegranate-yogurt",
    { title: "רימון עם יוגורט", how: "יוגורט יווני עם גרגירי רימון." },
    { title: "Pomegranate yogurt", how: "Greek yogurt with pomegranate seeds." },
    ["pomegranate", "greekYogurt"], "snack", ["light", "protein"], 200, 17, "pomegranate yogurt"),
  M("mango-cottage",
    { title: "מנגו עם קוטג'", how: "מנגו חתוך עם קוטג'." },
    { title: "Mango & cottage", how: "Chopped mango with cottage cheese." },
    ["mango", "cottage"], "snack", ["light", "protein"], 210, 15, "cottage cheese with fruit"),
  // -- dishes built on the staples added later: whole grains that are not
  //    white rice, oily fish, pulses, dark leaves and cultured dairy. These
  //    are the plates a Mediterranean diet is actually made of, and every one
  //    of them is a weeknight's work, not a project.
  M("freekeh-veg-bowl",
    { title: "קערת פריקה עם ירקות", how: "מבשלים פריקה, צולים דלעת בתנור, מוסיפים חומוס מבושל וכף טחינה." },
    { title: "Freekeh & roast veg bowl", how: "Cooked freekeh, roasted pumpkin, chickpeas and a spoon of tahini." },
    ["freekeh", "pumpkin", "chickpeas", "tahini"], "lunch", ["balanced", "veg"], 520, 18, "freekeh roasted vegetables"),
  M("labneh-pita",
    { title: "לאבנה על פיתה מלאה", how: "מורחים לאבנה על פיתה מלאה, מלפפון חתוך ושמן זית מעל." },
    { title: "Labneh on wholemeal pita", how: "Labneh on a wholemeal pita, chopped cucumber and a drizzle of olive oil." },
    ["labneh", "pitaWhole", "cucumber", "oliveOil"], "breakfast", ["protein", "balanced"], 380, 18, "labneh pita"),
  M("kale-chickpea-salad",
    { title: "סלט קייל וחומוס", how: "מעסים עלי קייל עם לימון ושמן זית, מוסיפים חומוס מבושל ושקדים." },
    { title: "Kale & chickpea salad", how: "Massage kale with lemon and olive oil, add chickpeas and almonds." },
    ["kale", "chickpeas", "lemon", "oliveOil", "almonds"], "lunch", ["veg", "light"], 420, 15, "kale salad chickpeas"),
  M("buckwheat-mushroom-egg",
    { title: "כוסמת עם פטריות וביצה", how: "מטגנים בצל ופטריות, מערבבים לתוך כוסמת מבושלת ושוברים ביצה מעל." },
    { title: "Buckwheat, mushrooms & egg", how: "Fry onion and mushrooms into cooked buckwheat, top with an egg." },
    ["buckwheat", "mushroom", "egg", "onion"], "dinner", ["balanced", "protein"], 460, 20, "buckwheat mushrooms"),
  M("salmon-asparagus-rice",
    { title: "סלמון עם אספרגוס ואורז מלא", how: "פילה סלמון בתנור, אספרגוס במחבת ואורז מלא לצד." },
    { title: "Salmon, asparagus & brown rice", how: "Baked salmon fillet, pan-seared asparagus and brown rice." },
    ["salmon", "asparagus", "brownRice"], "dinner", ["protein", "hearty"], 560, 38, "salmon asparagus"),
  M("tempeh-stirfry",
    { title: "טמפה מוקפצת עם ברוקולי", how: "מקפיצים טמפה עם שום וברוקולי, מגישים על אורז מלא." },
    { title: "Tempeh stir-fry", how: "Stir-fry tempeh with garlic and broccoli, serve over brown rice." },
    ["tempeh", "broccoli", "brownRice", "garlic"], "dinner", ["protein", "veg"], 500, 28, "tempeh stir fry"),
  M("skyr-strawberries",
    { title: "סקיר עם תותים ושקדים", how: "גביע סקיר, תותים חתוכים וחופן שקדים." },
    { title: "Skyr with strawberries", how: "A tub of skyr, sliced strawberries and a handful of almonds." },
    ["skyr", "strawberries", "almonds"], "snack", ["protein", "light"], 300, 22, "skyr strawberries"),
  M("mackerel-toast",
    { title: "מקרל על לחם מלא", how: "פילה מקרל על פרוסת לחם מלא, עלי רוקט וסחיטת לימון." },
    { title: "Mackerel on rye toast", how: "Mackerel on whole-grain bread with rocket and a squeeze of lemon." },
    ["mackerel", "wholeBread", "arugula", "lemon"], "lunch", ["protein", "balanced"], 420, 28, "smoked mackerel sandwich"),
  M("kohlrabi-tahini-sticks",
    { title: "מקלות קולרבי בטחינה", how: "חותכים קולרבי וצנוניות למקלות, טובלים בטחינה." },
    { title: "Kohlrabi sticks & tahini", how: "Cut kohlrabi and radish into sticks, dip in tahini." },
    ["kohlrabi", "radish", "tahini"], "snack", ["light", "veg"], 180, 6, "crudites vegetable platter"),
  M("pumpkin-lentil-soup",
    { title: "מרק דלעת ועדשים", how: "מטגנים בצל בשמן זית, מוסיפים דלעת ועדשים ומבשלים עד שהכול רך." },
    { title: "Pumpkin & lentil soup", how: "Soften onion in olive oil, add pumpkin and lentils and simmer until tender." },
    ["pumpkin", "lentils", "onion", "oliveOil"], "dinner", ["hearty", "veg"], 420, 18, "pumpkin soup lentils"),
  M("barley-chicken-bowl",
    { title: "גריסים עם עוף ומנגולד", how: "גריסי פנינה מבושלים, חזה עוף פרוס ומנגולד מוקפץ בשמן זית." },
    { title: "Barley & chicken bowl", how: "Pearl barley, sliced chicken breast and chard wilted in olive oil." },
    ["barley", "chicken", "chard", "oliveOil"], "lunch", ["protein", "hearty"], 560, 40, "pearl barley chicken"),
  M("kefir-flax-smoothie",
    { title: "שייק קפיר עם פשתן", how: "טוחנים קפיר עם בננה, פירות יער וכף זרעי פשתן." },
    { title: "Kefir & flax smoothie", how: "Blend kefir with banana, berries and a spoon of flaxseed." },
    ["kefir", "flaxseed", "berries", "banana"], "breakfast", ["light", "balanced"], 330, 14, "glass of kefir"),
  M("fava-cilantro-salad",
    { title: "סלט פול עם כוסברה", how: "פול מבושל עם כוסברה קצוצה, לימון ושמן זית." },
    { title: "Fava & coriander salad", how: "Cooked fava beans with chopped coriander, lemon and olive oil." },
    ["fava", "cilantro", "lemon", "oliveOil"], "lunch", ["veg", "light"], 320, 14, "fava beans salad"),
  M("brussels-egg-bowl",
    { title: "כרוב ניצנים צלוי עם ביצה", how: "צולים כרוב ניצנים בשמן זית, ביצה קשה וגרעיני דלעת מעל." },
    { title: "Roast sprouts with egg", how: "Roast brussels sprouts in olive oil, top with a boiled egg and pumpkin seeds." },
    ["brusselsSprouts", "egg", "oliveOil", "pumpkinSeeds"], "dinner", ["veg", "protein"], 380, 20, "roasted brussels sprouts"),
  // -- a third pass, from what people actually cook on a weeknight: the
  //    Israeli kitchen's own staples (mujadara, sabich, a lentil soup), and the
  //    high-protein bowls and skillets that turn up on every recipe site
  //    because they take twenty minutes and one pan. Written here in our own
  //    words, built only from ingredients the app already knows, so the
  //    shopping list and the drawn plate both still work.
  M("mujadara",
    { title: "מג׳דרה", how: "מבשלים עדשים ואורז יחד, ומעל — הרבה בצל מטוגן עד שהוא חום ומתוק." },
    { title: "Mujadara", how: "Cook lentils and rice together, and top with onion fried until brown and sweet." },
    ["lentils", "rice", "onion", "oliveOil"], "dinner", ["hearty", "veg"], 520, 18, "mujaddara"),
  M("sabich-bowl",
    { title: "סביח בקערה", how: "חציל צלוי, ביצה קשה, עגבנייה ומלפפון קצוצים, וטחינה מעל. בלי הפיתה — או עם חצי." },
    { title: "Sabich bowl", how: "Roasted eggplant, a boiled egg, chopped tomato and cucumber, tahini over the top." },
    ["eggplant", "egg", "tahini", "tomato", "cucumber"], "lunch", ["balanced", "veg"], 470, 20, "sabich"),
  M("chicken-tzatziki-bowl",
    { title: "קערת עוף ויוגורט", how: "חזה עוף פרוס על אורז מלא, מלפפון קצוץ ויוגורט יווני עם לימון ושום." },
    { title: "Chicken & tzatziki bowl", how: "Sliced chicken over brown rice, chopped cucumber, and Greek yogurt with lemon and garlic." },
    ["chicken", "brownRice", "cucumber", "greekYogurt", "lemon"], "lunch", ["protein", "hearty"], 580, 45, "chicken rice tzatziki"),
  M("red-lentil-curry",
    { title: "עדשים כתומות בקארי", how: "מבשלים עדשים כתומות עם עגבנייה, בצל ושום עד שהן נמסות. מגישים על אורז מלא." },
    { title: "Red lentil curry", how: "Simmer red lentils with tomato, onion and garlic until they collapse. Serve over brown rice." },
    ["lentils", "tomato", "onion", "garlic", "brownRice"], "dinner", ["hearty", "veg"], 510, 22, "red lentil curry dal"),
  M("cottage-pasta",
    { title: "פסטה עם קוטג׳", how: "מערבבים קוטג׳ חם לתוך הפסטה עם עגבנייה ושום — רוטב קרמי בלי שמנת." },
    { title: "Cottage cheese pasta", how: "Stir warm cottage cheese through the pasta with tomato and garlic — creamy, without cream." },
    ["pasta", "cottage", "tomato", "garlic"], "dinner", ["protein", "hearty"], 540, 32, "pasta with tomato and cheese"),
  M("tuna-bean-salad",
    { title: "סלט טונה ושעועית", how: "טונה, שעועית לבנה, בצל דק ופטרוזיליה, עם שמן זית ולימון." },
    { title: "Tuna & white bean salad", how: "Tuna, white beans, thin onion and parsley, with olive oil and lemon." },
    ["tuna", "beans", "onion", "parsley", "oliveOil"], "lunch", ["protein", "light"], 420, 34, "tuna white bean salad"),
  M("sheetpan-chicken",
    { title: "עוף וירקות בתנור", how: "חזה עוף, פלפל, קישוא ותפוח אדמה על תבנית אחת, שמן זית ומלח, ארבעים דקות." },
    { title: "Sheet-pan chicken & veg", how: "Chicken, pepper, zucchini and potato on one tray, olive oil and salt, forty minutes." },
    ["chicken", "pepper", "zucchini", "potato", "oliveOil"], "dinner", ["protein", "hearty"], 590, 42, "roast chicken vegetables tray"),
  M("salmon-tomato-skillet",
    { title: "סלמון בעגבניות ושום", how: "מטגנים שום ועגבנייה, מניחים מעל פילה סלמון ותרד, ומכסים עד שהדג מוכן." },
    { title: "Salmon in tomato & garlic", how: "Soften garlic and tomato, lay the salmon and spinach on top, cover until the fish is done." },
    ["salmon", "tomato", "garlic", "spinach"], "dinner", ["protein", "balanced"], 520, 38, "salmon tomato sauce skillet"),
  M("chickpea-spinach-stew",
    { title: "תבשיל חומוס ותרד", how: "חומוס מבושל עם בצל, עגבנייה ותרד, עד שהכול רך ומתובל." },
    { title: "Chickpea & spinach stew", how: "Chickpeas simmered with onion, tomato and spinach until soft and well seasoned." },
    ["chickpeas", "spinach", "tomato", "onion"], "dinner", ["veg", "hearty"], 430, 20, "chickpea spinach stew"),
  M("yogurt-kiwi-walnut",
    { title: "יוגורט עם קיווי ואגוזי מלך", how: "יוגורט יווני, קיווי חתוך, חופן אגוזי מלך וקצת דבש." },
    { title: "Yogurt, kiwi & walnuts", how: "Greek yogurt, sliced kiwi, a handful of walnuts and a little honey." },
    ["greekYogurt", "kiwi", "walnuts", "honey"], "snack", ["protein", "light"], 330, 22, "yogurt kiwi walnuts"),
  M("turkey-hummus-wrap",
    { title: "רול הודו עם חומוס", how: "טורטייה, ממרח חומוס, פרוסות הודו, חסה ועגבנייה. מגלגלים והולכים." },
    { title: "Turkey & hummus wrap", how: "A tortilla, hummus, turkey slices, lettuce and tomato. Roll it and go." },
    ["tortilla", "hummusSpread", "turkey", "lettuce", "tomato"], "lunch", ["protein", "balanced"], 460, 34, "hummus wrap sandwich"),
  M("sweet-potato-cottage",
    { title: "בטטה אפויה עם קוטג׳", how: "בטטה שלמה בתנור עד שהיא רכה, חוצים ומכניסים פנימה קוטג׳ ושמן זית." },
    { title: "Baked sweet potato & cottage", how: "Bake a sweet potato until soft, split it and spoon in cottage cheese and olive oil." },
    ["sweetPotato", "cottage", "oliveOil"], "lunch", ["balanced", "veg"], 400, 22, "baked sweet potato"),
  M("tofu-buckwheat-stirfry",
    { title: "טופו וברוקולי על כוסמת", how: "מקפיצים טופו עם ברוקולי ושום, מגישים על כוסמת מבושלת." },
    { title: "Tofu & broccoli on buckwheat", how: "Stir-fry tofu with broccoli and garlic, serve over cooked buckwheat." },
    ["tofu", "broccoli", "buckwheat", "garlic"], "dinner", ["protein", "veg"], 490, 28, "tofu broccoli stir fry"),
  M("overnight-oats-skyr",
    { title: "שיבולת שועל ללילה עם סקיר", how: "מערבבים שיבולת שועל, סקיר, פירות יער וכף צ׳יה בערב. בבוקר זה מוכן." },
    { title: "Overnight oats with skyr", how: "Mix oats, skyr, berries and a spoon of chia at night. It's ready in the morning." },
    ["oats", "skyr", "berries", "chia"], "breakfast", ["protein", "balanced"], 420, 28, "overnight oats"),
  M("barley-pepper-salad",
    { title: "סלט גריסים ופלפל קלוי", how: "גריסי פנינה חמימים עם פלפל קלוי, פטה ופטרוזיליה, ושמן זית מעל." },
    { title: "Warm barley & roast pepper salad", how: "Warm pearl barley with roasted pepper, feta and parsley, olive oil over the top." },
    ["barley", "pepper", "feta", "parsley", "oliveOil"], "lunch", ["balanced", "veg"], 480, 17, "barley salad roasted pepper"),
  M("sardines-toast",
    { title: "סרדינים על לחם מלא", how: "סרדינים על פרוסת לחם מלא עם עגבנייה חתוכה וסחיטת לימון." },
    { title: "Sardines on toast", how: "Sardines on whole-grain bread with chopped tomato and a squeeze of lemon." },
    ["sardines", "wholeBread", "tomato", "lemon"], "lunch", ["protein", "light"], 380, 26, "sardines on toast"),
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
  freekeh: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  barley: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  buckwheat: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  brownRice: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  millet: { g: 75, he: "חצי כוס יבש", en: "1/2 cup dry" },
  pita: { g: 60, he: "יחידה", en: "1 pita" },
  pitaWhole: { g: 60, he: "יחידה", en: "1 pita" },
  blackBeans: { g: 150, he: "כוס", en: "1 cup" },
  fava: { g: 150, he: "כוס", en: "1 cup" },
  tempeh: { g: 100, he: "פרוסות", en: "a few slices" },
  labneh: { g: 60, he: "כף גדושה", en: "2 tbsp" },
  kefir: { g: 200, he: "כוס", en: "1 cup" },
  skyr: { g: 150, he: "גביע", en: "1 tub" },
  mackerel: { g: 120, he: "פילה", en: "1 fillet" },
  kale: { g: 60, he: "חופן עלים", en: "a handful" },
  arugula: { g: 40, he: "חופן עלים", en: "a handful" },
  chard: { g: 70, he: "כמה עלים", en: "a few leaves" },
  brusselsSprouts: { g: 90, he: "חופן", en: "a handful" },
  kohlrabi: { g: 120, he: "יחידה", en: "1 kohlrabi" },
  radish: { g: 50, he: "כמה יחידות", en: "a few" },
  asparagus: { g: 90, he: "כמה גבעולים", en: "a few spears" },
  pumpkin: { g: 150, he: "פרוסה", en: "1 wedge" },
  artichoke: { g: 120, he: "יחידה", en: "1 artichoke" },
  leek: { g: 80, he: "גבעול", en: "1 stalk" },
  parsley: { g: 10, he: "חופן קצוץ", en: "a small handful" },
  cilantro: { g: 10, he: "חופן קצוץ", en: "a small handful" },
  kimchi: { g: 50, he: "כף גדושה", en: "2 tbsp" },
  strawberries: { g: 120, he: "חופן", en: "a handful" },
  kiwi: { g: 75, he: "יחידה", en: "1 kiwi" },
  clementine: { g: 90, he: "2 יחידות", en: "2 clementines" },
  grapefruit: { g: 150, he: "חצי אשכולית", en: "1/2 grapefruit" },
  peach: { g: 150, he: "יחידה", en: "1 peach" },
  apricot: { g: 70, he: "2 יחידות", en: "2 apricots" },
  plum: { g: 70, he: "יחידה", en: "1 plum" },
  fig: { g: 100, he: "2 תאנים", en: "2 figs" },
  persimmon: { g: 150, he: "יחידה", en: "1 persimmon" },
  cherries: { g: 100, he: "חופן", en: "a handful" },
  almonds: { g: 25, he: "חופן", en: "a handful" },
  walnuts: { g: 25, he: "חופן", en: "a handful" },
  pumpkinSeeds: { g: 20, he: "כף גדושה", en: "2 tbsp" },
  sunflowerSeeds: { g: 20, he: "כף גדושה", en: "2 tbsp" },
  flaxseed: { g: 12, he: "כף", en: "1 tbsp" },
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
export function adhocFood(word: string, tag: FoodTag = "carb"): Food {
  // The colour follows the category so an added food still reads as what it
  // is on the plate, rather than every unknown looking identical.
  const color = COLOR_FOR_TAG[tag];
  return {
    id: `x:${tag}:${word}`,
    tags: [tag],
    he: word,
    en: word,
    match: [],
    shape: "blob",
    color,
  };
}

const COLOR_FOR_TAG: Record<FoodTag, string> = {
  protein: "#C98A6B",
  carb: "#D9B36A",
  veg: "#7FB05A",
  fruit: "#E27D9A",
  fat: "#E8C36B",
  dairy: "#EDE7DA",
};
