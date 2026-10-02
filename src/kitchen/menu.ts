/**
 * Today's menu: a whole day of meals, planned from what the person has at home
 * and sized to the calorie target the app works out for them today.
 *
 * Why this exists: a list of "meals you could make" still leaves the person to
 * plan the day, and a plan that asks them to shop first is a plan they will
 * not follow. So the menu:
 * - picks each meal only from what is in their kitchen (their list) — never a
 *   shopping list, never "swap X for Y" — and falls back to a plate made of
 *   their own groceries when no recipe fits;
 * - sizes every portion to the day: the target is split across breakfast,
 *   lunch, dinner and a snack, and as meals are eaten (from the menu or
 *   logged any other way) what is left is re-spread over the meals still to
 *   come — a big lunch makes a lighter dinner, a workout makes a bigger one;
 * - rotates by day and by person: each meal of the day walks through every
 *   dish that fits before any comes back (see `rotationPool`), so a week is
 *   seven different breakfasts when the kitchen allows seven;
 * - in a small kitchen, adds dishes that are one ingredient away, saying which
 *   one — otherwise five groceries meant the same plate every day forever;
 * - lets them swap any meal for another recipe, add a recipe from the book,
 *   and "upgrade" a dish with something they already have — more protein when
 *   cutting, more energy when bulking, more volume when hungry.
 *
 * Pure: the store keeps only the person's choices (DayChoices); everything
 * else is recomputed, so a new pantry or a new target reshapes the day at once.
 */
import {
  FOODS,
  MEALS,
  gramsNutrition,
  portion,
  type Food,
  type Meal,
  type MealSlot,
} from "./data";
import {
  dietList,
  dietOk,
  fitTier,
  foodDietOk,
  goalFit,
  isDairy,
  isFlesh,
  isMeat,
  kindOf,
  plateForGoal,
  seedHash,
  STAPLES,
  type Goal,
} from "./index";

export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/** How a day's calories are split when nothing has been eaten yet. */
export const SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

/** Portions move in quarters, and stay within what reads as one plate. */
export const MIN_SERVINGS = 0.5;
export const MAX_SERVINGS = 2;

/** The id a menu slot uses for the plate built from the person's own groceries. */
export const OWN_PLATE = "__plate";

/** What the person chose for one meal of the day. */
export type SlotChoice = {
  /** A recipe they picked (swap, or "add to today" from the book). */
  mealId?: string;
  /** Foods from their kitchen added to the dish ("upgrade"). */
  extras?: string[];
  /** The diary entry it was logged as: eaten while that entry exists. */
  loggedId?: string;
};
export type DayChoices = Partial<Record<MealSlot, SlotChoice>>;

export type Upgrade = {
  food: Food;
  grams: number;
  kcal: number;
  protein: number;
  /** Why it helps this goal. */
  why: "protein" | "volume" | "energy";
  /** On the person's list — or only a suggestion when they have no list. */
  have: boolean;
};

export type MenuSlot = {
  slot: MealSlot;
  meal: Meal;
  /** Portion multiplier, in quarters. */
  servings: number;
  extras: Upgrade[];
  kcal: number;
  protein: number;
  /** Logged to today's diary. */
  eaten: boolean;
  /** Picked by the person rather than the planner. */
  chosen: boolean;
  /** Made entirely of things on their list (always true once they have one,
   * except a recipe they chose themselves or a dish one ingredient away). */
  fromKitchen: boolean;
  /** What the dish needs beyond the kitchen list: empty, or the one ingredient
   * a small kitchen is short of. */
  missing: Food[];
};

export type DayMenu = {
  slots: MenuSlot[];
  /** The day's target the menu was sized to. */
  target: number;
  /** Everything eaten today, from the menu or not. */
  eatenKcal: number;
  /** Calories the uneaten meals add up to. */
  plannedKcal: number;
  /** eaten + planned — should land on the target. */
  totalKcal: number;
  proteinTotal: number;
};

export type MenuInput = {
  target: { kcal: number; protein: number };
  goal: Goal;
  /** Food ids on the person's kitchen list; null when they have no list yet. */
  have: ReadonlySet<string> | null;
  /** The foods on the list (for the own-groceries plate). */
  pantry: Food[];
  diet?: string | null;
  seed: string;
  choices?: DayChoices;
  /** Today's diary: every entry id and its calories. */
  diary: { id: string; kcal: number; protein: number }[];
  /** The person's rotation: a key their dishes are shuffled by (stable from
   * day to day) and today's day number. With it each slot cycles through every
   * fitting dish before repeating; without it the best fit wins. */
  rotation?: { key: string; day: number };
};

const byId = new Map(FOODS.map((f) => [f.id, f]));
const mealById = new Map(MEALS.map((m) => [m.id, m]));

/**
 * Ingredients a dish still works without — the garnish, the squeeze of lemon,
 * the onion in the pan. Almost every recipe has one, so demanding them made a
 * normal kitchen list cook one lunch and no dinners at all.
 */
export const FLEXIBLE: ReadonlySet<string> = new Set([
  "onion", "garlic", "lemon", "lime", "parsley", "cilantro", "mint", "basil", "dill", "greenOnion",
  "honey", "olives", "sesame", "chia", "flaxseed", "celery", "radish", "arugula", "pumpkinSeeds",
  "sunflowerSeeds", "silan", "cinnamon",
]);

/**
 * Foods that do the same job in a dish, so the one on the list is used: pita
 * for bread, brown rice for rice, skyr for yoghurt. The menu adapts the recipe
 * itself — it never asks the person to go and buy the one the recipe named.
 */
const EQUIVALENT: { close: boolean; ids: string[] }[] = [
  // Close: the dish is the same dish either way, even when it is the star.
  { close: true, ids: ["wholeBread", "bread", "pitaWhole", "pita", "lafa", "tortilla"] },
  { close: true, ids: ["rice", "brownRice", "cookedRice"] },
  { close: true, ids: ["pasta", "cookedPasta"] },
  { close: true, ids: ["greekYogurt", "skyr", "proteinYogurt"] },
  { close: true, ids: ["chicken", "chickenThigh"] },
  { close: true, ids: ["nuts", "almonds", "walnuts", "cashews", "peanuts", "hazelnuts", "pecans", "pistachios"] },
  { close: true, ids: ["peanutButter", "almondButter"] },
  { close: true, ids: ["berries", "strawberries"] },
  { close: true, ids: ["milk", "soyMilk", "almondMilk", "oatMilk"] },
  { close: true, ids: ["tuna", "tunaOil"] },
  { close: true, ids: ["beef", "veal"] },
  // Loose: fine as a side or a supporting part, not in place of the dish's
  // headline ingredient ("mango with cottage" made with an apple is not it).
  { close: false, ids: ["rice", "brownRice", "quinoa", "bulgur", "couscous", "freekeh", "buckwheat", "barley", "millet"] },
  { close: false, ids: ["pasta", "noodles", "ptitim"] },
  { close: false, ids: ["potato", "sweetPotato"] },
  { close: false, ids: ["greekYogurt", "skyr", "proteinYogurt", "leben", "kefir"] },
  { close: false, ids: ["chicken", "chickenThigh", "turkey"] },
  { close: false, ids: ["salmon", "fish", "tilapia", "seaBream", "seaBass", "cod", "trout", "mackerel", "mullet"] },
  { close: false, ids: ["whiteCheese", "labneh", "creamCheese", "ricotta"] },
  { close: false, ids: ["yellowCheese", "mozzarella", "parmesan"] },
  { close: false, ids: ["feta", "tzfatit", "goatCheese", "halloumi"] },
  { close: false, ids: ["lettuce", "spinach", "kale", "chard", "arugula", "cabbage"] },
  { close: false, ids: ["zucchini", "eggplant", "pumpkin"] },
  { close: false, ids: ["broccoli", "cauliflower", "greenBeans", "brusselsSprouts", "asparagus"] },
  { close: false, ids: ["chickpeas", "beans", "blackBeans", "lentils", "fava"] },
  { close: false, ids: ["oats", "granola", "cornflakes"] },
  { close: false, ids: ["apple", "pear", "peach", "nectarine", "plum", "clementine", "orange", "kiwi", "mango"] },
];

/** What the kitchen uses for one of a recipe's ingredients: the ingredient
 * itself, a food that does the same job, "skip" for a garnish, or null.
 * `lead` is the dish's headline ingredient, which only a close equivalent
 * may stand in for. */
export function stands(id: string, have: ReadonlySet<string>, lead = false): string | "skip" | null {
  if (STAPLES.has(id) || have.has(id)) return id;
  for (const g of EQUIVALENT) {
    if (lead && !g.close) continue;
    if (!g.ids.includes(id)) continue;
    const alt = g.ids.find((x) => have.has(x));
    if (alt) return alt;
  }
  return FLEXIBLE.has(id) && !lead ? "skip" : null;
}

/** Whether a meal can be made from the kitchen (with the adaptations above). */
export function makeable(meal: Meal, have: ReadonlySet<string> | null): boolean {
  if (!have) return true;
  return meal.uses.every((id, i) => stands(id, have, i === 0) !== null);
}

/** How the recipe is made from this kitchen: what stands in for what, and
 * which garnishes are left out. Empty when it is made exactly as written. */
export function adaptations(meal: Meal, have: ReadonlySet<string> | null): { swaps: { from: Food; to: Food }[]; skipped: Food[] } {
  const swaps: { from: Food; to: Food }[] = [];
  const skipped: Food[] = [];
  if (!have) return { swaps, skipped };
  for (const [i, id] of meal.uses.entries()) {
    const r = stands(id, have, i === 0);
    const from = byId.get(id);
    if (!from || r === id || r === null) continue;
    if (r === "skip") skipped.push(from);
    else {
      const to = byId.get(r);
      if (to) swaps.push({ from, to });
    }
  }
  return { swaps, skipped };
}

/** What a dish needs that the kitchen cannot stand in for; null when it is
 * the headline ingredient that is missing (then it is not this dish), unless
 * `leadOk` — the last resort of a kitchen that can make nothing for a meal. */
export function missingFor(meal: Meal, have: ReadonlySet<string> | null, leadOk = false): Food[] | null {
  if (!have) return [];
  const out: Food[] = [];
  for (const [i, id] of meal.uses.entries()) {
    if (stands(id, have, i === 0) !== null) continue;
    if (i === 0 && !leadOk) return null;
    const f = byId.get(id);
    if (f) out.push(f);
  }
  return out;
}

/** Below this many dishes a kitchen can make for one meal, dishes an
 * ingredient or two away join that meal's rotation, each saying what it needs. */
export const SMALL_POOL = 5;

/** Whether a dish is offered for a meal: its own, or a lunch-or-dinner dish at
 * the other one. A breakfast is never someone's dinner. */
function suits(m: Meal, slot: MealSlot): boolean {
  return m.slot === slot || (slot !== "breakfast" && slot !== "snack" && m.slot !== "breakfast" && m.slot !== "snack");
}

/**
 * Every dish in a meal's rotation, in the order this person meets them.
 *
 * The pool is what the kitchen can make, within the goal's acceptable tiers —
 * not only the top one, which held two or three dishes and was why the same
 * breakfast came back day after day. A small kitchen widens it step by step:
 * dishes one ingredient short, then two, each carrying what it needs, until
 * the meal has SMALL_POOL to rotate through. The order is a shuffle keyed to
 * the person and stable across days, so walking it by day number serves every
 * dish once before any repeats.
 */
export function rotationPool(
  slot: MealSlot,
  input: Pick<MenuInput, "goal" | "have" | "diet"> & { key: string },
): { meal: Meal; missing: Food[] }[] {
  const fits = MEALS.filter((m) => suits(m, slot) && dietOk(m, input.diet));
  const short = new Map<string, Food[]>();
  for (const m of fits) {
    const miss = missingFor(m, input.have);
    if (miss) short.set(m.id, miss);
  }
  const tiered = (allowed: number) => {
    let pool = fits.filter((m) => (short.get(m.id)?.length ?? 99) <= allowed);
    // Its own meal's dishes first; a lunch dish at dinner only to fill a gap.
    const native = pool.filter((m) => m.slot === slot);
    if (native.length >= 3) pool = native;
    const best = pool.reduce((n, m) => Math.max(n, goalFit(m, input.goal)), 0);
    const fitting = pool.filter((m) => fitTier(goalFit(m, input.goal), best) >= 1);
    return fitting.length >= Math.min(SMALL_POOL, pool.length) ? fitting : pool;
  };
  let chosen = tiered(0);
  for (let allowed = 1; input.have && allowed <= 2 && chosen.length < SMALL_POOL; allowed++) chosen = tiered(allowed);
  // Nothing at all for this meal (a snack from eggs and bread): dishes whose
  // one missing thing is their main ingredient, so the person sees what one
  // purchase would open up instead of the same plate every day.
  if (input.have && chosen.length < 2) {
    for (const m of fits) {
      if (short.has(m.id) || m.slot !== slot) continue;
      const miss = missingFor(m, input.have, true);
      if (miss && miss.length === 1) short.set(m.id, miss);
    }
    chosen = tiered(1);
  }
  const h = (id: string) => seedHash(`${input.key}|${slot}|${id}`);
  return chosen
    .map((meal) => ({ meal, missing: short.get(meal.id) ?? [] }))
    .sort((a, b) => h(a.meal.id) - h(b.meal.id) || a.meal.id.localeCompare(b.meal.id));
}

/** Round to a quarter portion within the plate limits. */
export function quarter(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return MIN_SERVINGS;
  return Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, Math.round(n * 4) / 4));
}

/**
 * The meals that suit a slot, best first: from the kitchen only (when there
 * is a list), passing the diet, the right time of day, goal fit in tiers with
 * the seed deciding ties — so the day rotates without ever serving a dish that
 * works against the goal.
 */
export function candidatesFor(
  slot: MealSlot,
  opts: Pick<MenuInput, "goal" | "have" | "diet" | "seed">,
  exclude: ReadonlySet<string> = new Set(),
): Meal[] {
  const pool = MEALS.filter((m) => !exclude.has(m.id) && dietOk(m, opts.diet) && makeable(m, opts.have));
  const best = pool.reduce((n, m) => Math.max(n, goalFit(m, opts.goal)), 0);
  const order = (a: Meal, b: Meal) =>
    (b.slot === slot ? 1 : 0) - (a.slot === slot ? 1 : 0) ||
    fitTier(goalFit(b, opts.goal), best) - fitTier(goalFit(a, opts.goal), best) ||
    seedHash(`${opts.seed}|${slot}|${a.id}`) - seedHash(`${opts.seed}|${slot}|${b.id}`);
  // A dinner at breakfast is fine when the kitchen allows nothing else, but a
  // breakfast (yogurt, oats) is never offered as someone's dinner.
  return pool
    .filter((m) => m.slot === slot || (slot !== "breakfast" && slot !== "snack" && m.slot !== "breakfast" && m.slot !== "snack"))
    .sort(order);
}

/**
 * Something from the kitchen that makes this dish better for the goal:
 * lean protein when cutting or recomping, energy and protein when bulking,
 * vegetables for volume. Only foods on the person's list, unless they have no
 * list (then a few common ones, marked as suggestions). Nothing that breaks
 * their diet or the kosher meat-and-dairy rule, no fruit or sweet dairy beside
 * meat, and at most three.
 */
export function upgradesFor(meal: Meal, opts: Pick<MenuInput, "goal" | "have" | "diet">): Upgrade[] {
  const inDish = new Set(meal.uses);
  const dishFoods = meal.uses.map((id) => byId.get(id)).filter((f): f is Food => !!f);
  const meaty = dishFoods.some(isMeat);
  const fleshy = dishFoods.some(isFlesh);
  const dairy = dishFoods.some(isDairy);
  const kosher = dietList(opts.diet).includes("kosher");
  const pool: Food[] = opts.have
    ? [...opts.have].map((id) => byId.get(id)).filter((f): f is Food => !!f)
    : SUGGESTED_UPGRADES.map((id) => byId.get(id)).filter((f): f is Food => !!f);
  const out: Upgrade[] = [];
  for (const f of pool) {
    if (inDish.has(f.id) || STAPLES.has(f.id) || !foodDietOk(f, opts.diet)) continue;
    const kind = kindOf(f);
    if (kind === "spice" || kind === "drink" || kind === "sweet") continue;
    if (kosher && ((meaty && isDairy(f)) || (dairy && isMeat(f)))) continue;
    if (fleshy && (kind === "fruit" || SWEET_WITH_FRUIT.has(f.id))) continue;
    // Chicken in the morning yoghurt is not an upgrade anyone wants.
    if ((meal.slot === "breakfast" || meal.slot === "snack") && isFlesh(f)) continue;
    const p = portion(f.id);
    const n = gramsNutrition(f, p.g);
    const density = n.kcal > 0 ? n.protein / (n.kcal / 100) : 0;
    let why: Upgrade["why"] | null = null;
    let score = 0;
    if (opts.goal === "bulk") {
      if (n.kcal >= 120 || n.protein >= 10) {
        why = n.protein >= 10 ? "protein" : "energy";
        score = n.kcal / 10 + n.protein;
      }
    } else if (kind === "veg") {
      why = "volume";
      score = 20 - n.kcal / 10;
    } else if (density >= 8 && n.protein >= 6) {
      why = "protein";
      score = density * 3 + n.protein;
    }
    if (why) out.push({ food: f, grams: p.g, kcal: n.kcal, protein: n.protein, why, have: !!opts.have });
    void score;
  }
  const scoreOf = (u: Upgrade) =>
    opts.goal === "bulk" ? u.kcal / 10 + u.protein : u.why === "protein" ? 100 + u.protein : 50 - u.kcal / 10;
  return out.sort((a, b) => scoreOf(b) - scoreOf(a) || a.food.id.localeCompare(b.food.id)).slice(0, 3);
}

/** When the person has no list yet: upgrades most kitchens can do. */
const SUGGESTED_UPGRADES = ["cottage", "egg", "cucumber", "tomato", "greekYogurt", "tuna"];
const SWEET_WITH_FRUIT = new Set(["greekYogurt", "skyr", "kefir", "milk", "cottage", "proteinYogurt", "milky", "leben", "proteinPudding", "chocolateMilk", "iceCream"]);

/** The meal a slot resolves to: the person's choice, the planner's pick, or
 * the plate made of their own groceries. */
function resolveMeal(slot: MealSlot, input: MenuInput, used: Set<string>): { meal: Meal; chosen: boolean; missing: Food[] } | null {
  const pick = input.choices?.[slot]?.mealId;
  if (pick && pick !== OWN_PLATE) {
    const m = mealById.get(pick);
    if (m) return { meal: m, chosen: true, missing: [] };
  }
  if (pick !== OWN_PLATE) {
    if (input.rotation) {
      const pool = rotationPool(slot, { ...input, key: input.rotation.key });
      // A short rotation takes the plate made of the person's own groceries as
      // one more turn, rather than as the answer to every day.
      const withPlate = pool.length < SMALL_POOL && input.pantry.length >= 2;
      const n = pool.length + (withPlate ? 1 : 0);
      // Taken by another meal today: jump half a cycle rather than to the next
      // one, which is tomorrow's dish and would then come two days running.
      const half = Math.floor(n / 2);
      const steps = [0, ...(half > 1 ? [half] : []), ...Array.from({ length: n }, (_, i) => i + 1)];
      for (const i of steps) {
        const at = (((input.rotation.day + i) % n) + n) % n;
        if (at === pool.length) break;
        const p = pool[at]!;
        if (!used.has(p.meal.id)) return { meal: p.meal, chosen: false, missing: p.missing };
      }
    } else {
      const best = candidatesFor(slot, input, used)[0];
      if (best) return { meal: best, chosen: false, missing: [] };
    }
  }
  const plate = plateForGoal(input.pantry, slot, input.goal, input.diet ?? "all");
  return plate ? { meal: plate, chosen: pick === OWN_PLATE, missing: [] } : null;
}

export function planDay(input: MenuInput): DayMenu {
  const diaryIds = new Set(input.diary.map((d) => d.id));
  const eatenKcal = input.diary.reduce((n, d) => n + d.kcal, 0);
  const eatenProtein = input.diary.reduce((n, d) => n + d.protein, 0);
  const used = new Set<string>();
  type Draft = Omit<MenuSlot, "servings" | "kcal" | "protein"> & { loggedKcal: number; loggedProtein: number };
  const drafts: Draft[] = [];
  for (const slot of SLOTS) {
    const r = resolveMeal(slot, input, used);
    if (!r) continue;
    used.add(r.meal.id);
    const choice = input.choices?.[slot];
    const logged = choice?.loggedId && diaryIds.has(choice.loggedId) ? input.diary.find((d) => d.id === choice.loggedId)! : null;
    const all = upgradesFor(r.meal, input);
    const extraIds = new Set(choice?.extras ?? []);
    const extras = [...all.filter((u) => extraIds.has(u.food.id))];
    // An upgrade picked earlier stays even if it no longer ranks in the top 3.
    for (const id of extraIds) {
      if (extras.some((u) => u.food.id === id)) continue;
      const f = byId.get(id);
      if (!f) continue;
      const p = portion(id);
      const n = gramsNutrition(f, p.g);
      extras.push({ food: f, grams: p.g, kcal: n.kcal, protein: n.protein, why: "protein", have: true });
    }
    drafts.push({
      slot,
      meal: r.meal,
      extras,
      eaten: !!logged,
      chosen: r.chosen,
      fromKitchen: makeable(r.meal, input.have),
      missing: r.missing,
      loggedKcal: logged?.kcal ?? 0,
      loggedProtein: logged?.protein ?? 0,
    });
  }

  // What is left of the day, spread over the meals still to come by their
  // usual share — so the menu always adds up to the target.
  const left = Math.max(0, input.target.kcal - eatenKcal);
  const open = drafts.filter((d) => !d.eaten);
  const shareSum = open.reduce((n, d) => n + SLOT_SHARE[d.slot], 0) || 1;
  const slots: MenuSlot[] = drafts.map((d) => {
    if (d.eaten) {
      return { ...stripLogged(d), servings: 1, kcal: d.loggedKcal, protein: d.loggedProtein };
    }
    const extrasKcal = d.extras.reduce((n, u) => n + u.kcal, 0);
    const extrasProtein = d.extras.reduce((n, u) => n + u.protein, 0);
    const budget = (left * SLOT_SHARE[d.slot]) / shareSum;
    const servings = quarter((budget - extrasKcal) / Math.max(1, d.meal.kcal));
    return {
      ...stripLogged(d),
      servings,
      kcal: Math.round(d.meal.kcal * servings + extrasKcal),
      protein: Math.round(d.meal.protein * servings + extrasProtein),
    };
  });
  const plannedKcal = slots.filter((s) => !s.eaten).reduce((n, s) => n + s.kcal, 0);
  const plannedProtein = slots.filter((s) => !s.eaten).reduce((n, s) => n + s.protein, 0);
  return {
    slots,
    target: input.target.kcal,
    eatenKcal,
    plannedKcal,
    totalKcal: eatenKcal + plannedKcal,
    proteinTotal: eatenProtein + plannedProtein,
  };
}

function stripLogged<T extends { loggedKcal: number; loggedProtein: number }>(d: T): Omit<T, "loggedKcal" | "loggedProtein"> {
  const { loggedKcal: _k, loggedProtein: _p, ...rest } = d;
  return rest;
}

/** Other recipes for a slot — the swap sheet: from the kitchen, best first. */
export function alternativesFor(
  slot: MealSlot,
  current: string,
  input: Pick<MenuInput, "goal" | "have" | "diet" | "seed">,
  limit = 6,
): Meal[] {
  return candidatesFor(slot, input, new Set([current])).slice(0, limit);
}

/** The slot a recipe goes into when added from the book: its own, unless that
 * one is already eaten, then the next meal still open. */
export function slotForRecipe(meal: Meal, menu: DayMenu): MealSlot {
  const own = menu.slots.find((s) => s.slot === meal.slot);
  if (!own || !own.eaten) return meal.slot;
  return menu.slots.find((s) => !s.eaten)?.slot ?? meal.slot;
}

/** The meal of the day happening now, by the clock. */
export function slotNow(hour: number): MealSlot {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
