/**
 * Real nutrition, per 100 g, for every food in the library.
 *
 * Until this table existed, a food's calories were its CATEGORY's average: every
 * protein was 165 kcal/100g, so salmon, chicken breast and tofu all counted the
 * same, and avocado — filed under "fat" — counted as 600 kcal when it is 160.
 * A calorie counter that is wrong by a factor of four on a common food is not a
 * counter. These are per-food figures instead.
 *
 * Source: USDA FoodData Central (SR Legacy / Foundation), which is public
 * domain, rounded to one decimal. Israeli dairy that has no USDA twin (white
 * cheese 5%, cottage 5%, labneh, skyr) uses typical local label values.
 *
 * `basis` says what state the weight refers to, and it follows how the library
 * portions each food (src/kitchen/data.ts PORTIONS): grains and pasta are
 * weighed DRY (the portions say "1/2 cup dry"), meat and fish COOKED (what is
 * on the plate), vegetables and fruit RAW, canned fish DRAINED. A number with
 * the wrong basis is off by 2-3x — dry rice is 365 kcal/100g, cooked is 130 —
 * so the basis is data, not a comment.
 *
 * `npm run test:per100` checks every food is covered and every row is
 * internally consistent: its calories must agree with 4·protein + 4·carbs +
 * 9·fat (the Atwater factors) within a tolerance, which is what catches a
 * typo'd digit before it reaches anyone's diary.
 *
 * Pure data: no imports, no React, no network.
 */

export type Per100 = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** What the 100 g refers to. */
export type Basis = "raw" | "cooked" | "dry" | "drained" | "asSold";

/** `alcohol` (grams per 100 g) is only set for drinks: it carries 7 kcal a
 * gram that protein, carbs and fat do not account for. */
export type Per100Row = Per100 & { basis: Basis; alcohol?: number };

const r = (kcal: number, protein: number, carbs: number, fat: number, basis: Basis): Per100Row => ({
  kcal,
  protein,
  carbs,
  fat,
  basis,
});

export const NUTRITION: Record<string, Per100Row> = {
  // -- proteins (meat and fish cooked, as eaten)
  egg: r(143, 12.6, 0.7, 9.5, "raw"),
  chicken: r(165, 31, 0, 3.6, "cooked"),
  turkey: r(135, 30, 0, 0.7, "cooked"),
  beef: r(217, 26, 0, 12, "cooked"),
  pork: r(242, 27.3, 0, 13.9, "cooked"),
  lamb: r(258, 25.6, 0, 16.5, "cooked"),
  sausage: r(280, 11, 3, 25, "asSold"),
  tuna: r(116, 25.5, 0, 0.8, "drained"),
  salmon: r(206, 22, 0, 12.4, "cooked"),
  fish: r(120, 25, 0, 2, "cooked"),
  shrimp: r(99, 24, 0.2, 0.3, "cooked"),
  sardines: r(208, 24.6, 0, 11.5, "drained"),
  mackerel: r(262, 23.9, 0, 17.8, "cooked"),
  tofu: r(144, 17.3, 2.8, 8.7, "raw"),
  tempeh: r(192, 20.3, 7.6, 10.8, "raw"),
  lentils: r(116, 9, 20.1, 0.4, "cooked"),
  chickpeas: r(164, 8.9, 27.4, 2.6, "cooked"),
  beans: r(127, 8.7, 22.8, 0.5, "cooked"),
  blackBeans: r(132, 8.9, 23.7, 0.5, "cooked"),
  fava: r(110, 7.6, 19.7, 0.4, "cooked"),
  edamame: r(121, 11.9, 8.9, 5.2, "cooked"),
  proteinPowder: r(390, 78, 8, 6, "asSold"),

  // -- dairy
  cottage: r(98, 11, 3.4, 4.3, "asSold"),
  whiteCheese: r(96, 9, 4, 5, "asSold"),
  greekYogurt: r(97, 9, 4, 5, "asSold"),
  yellowCheese: r(350, 25, 1.5, 27, "asSold"),
  mozzarella: r(300, 22, 2.2, 22.4, "asSold"),
  creamCheese: r(342, 5.9, 4.1, 34, "asSold"),
  feta: r(264, 14.2, 4.1, 21.3, "asSold"),
  labneh: r(160, 6, 4, 13, "asSold"),
  kefir: r(52, 3.4, 4.5, 2, "asSold"),
  skyr: r(63, 11, 4, 0.2, "asSold"),
  milk: r(61, 3.2, 4.8, 3.3, "asSold"),
  butter: r(717, 0.9, 0.1, 81, "asSold"),

  // -- bread, grains (dry), starches
  bread: r(266, 7.6, 49.4, 3.3, "asSold"),
  wholeBread: r(247, 13, 41, 3.4, "asSold"),
  bagel: r(257, 10, 50.5, 1.6, "asSold"),
  tortilla: r(312, 8.3, 51.6, 8, "asSold"),
  pita: r(275, 9.1, 55.7, 1.2, "asSold"),
  pitaWhole: r(266, 9.8, 55, 2.6, "asSold"),
  oats: r(379, 13.2, 67.7, 6.5, "dry"),
  rice: r(365, 7.1, 80, 0.7, "dry"),
  brownRice: r(367, 7.5, 76, 3.2, "dry"),
  pasta: r(371, 13, 74.7, 1.5, "dry"),
  noodles: r(384, 14, 71, 4.4, "dry"),
  quinoa: r(368, 14.1, 64.2, 6.1, "dry"),
  couscous: r(376, 12.8, 77.4, 0.6, "dry"),
  bulgur: r(342, 12.3, 75.9, 1.3, "dry"),
  freekeh: r(350, 12.6, 70, 2.5, "dry"),
  barley: r(352, 9.9, 77.7, 1.2, "dry"),
  buckwheat: r(343, 13.3, 71.5, 3.4, "dry"),
  millet: r(378, 11, 72.8, 4.2, "dry"),
  cornflakes: r(357, 7.5, 84, 0.4, "asSold"),
  granola: r(471, 10, 64, 20, "asSold"),
  riceCakes: r(387, 8.2, 81.5, 2.8, "asSold"),
  potato: r(93, 2.5, 21.2, 0.1, "cooked"),
  sweetPotato: r(90, 2, 20.7, 0.2, "cooked"),
  corn: r(96, 3.4, 21, 1.5, "cooked"),
  cornVeg: r(81, 2.6, 19, 0.7, "cooked"),

  // -- vegetables (raw)
  tomato: r(18, 0.9, 3.9, 0.2, "raw"),
  cucumber: r(15, 0.7, 3.6, 0.1, "raw"),
  lettuce: r(15, 1.4, 2.9, 0.2, "raw"),
  sweetcornSalad: r(17, 1.4, 3.3, 0.2, "raw"),
  pepper: r(31, 1, 6, 0.3, "raw"),
  onion: r(40, 1.1, 9.3, 0.1, "raw"),
  garlic: r(149, 6.4, 33, 0.5, "raw"),
  spinach: r(23, 2.9, 3.6, 0.4, "raw"),
  carrot: r(41, 0.9, 9.6, 0.2, "raw"),
  broccoli: r(34, 2.8, 6.6, 0.4, "raw"),
  cauliflower: r(25, 1.9, 5, 0.3, "raw"),
  zucchini: r(17, 1.2, 3.1, 0.3, "raw"),
  mushroom: r(22, 3.1, 3.3, 0.3, "raw"),
  eggplant: r(25, 1, 5.9, 0.2, "raw"),
  avocado: r(160, 2, 8.5, 14.7, "raw"),
  cabbage: r(25, 1.3, 5.8, 0.1, "raw"),
  greenBeans: r(31, 1.8, 7, 0.2, "raw"),
  peas: r(81, 5.4, 14.5, 0.4, "raw"),
  beetroot: r(43, 1.6, 9.6, 0.2, "raw"),
  celery: r(16, 0.7, 3, 0.2, "raw"),
  kale: r(35, 2.9, 4.4, 1.5, "raw"),
  arugula: r(25, 2.6, 3.7, 0.7, "raw"),
  chard: r(19, 1.8, 3.7, 0.2, "raw"),
  brusselsSprouts: r(43, 3.4, 9, 0.3, "raw"),
  kohlrabi: r(27, 1.7, 6.2, 0.1, "raw"),
  radish: r(16, 0.7, 3.4, 0.1, "raw"),
  asparagus: r(20, 2.2, 3.9, 0.1, "raw"),
  pumpkin: r(26, 1, 6.5, 0.1, "raw"),
  artichoke: r(47, 3.3, 10.5, 0.2, "raw"),
  leek: r(61, 1.5, 14.2, 0.3, "raw"),
  parsley: r(36, 3, 6.3, 0.8, "raw"),
  cilantro: r(23, 2.1, 3.7, 0.5, "raw"),
  kimchi: r(15, 1.1, 2.4, 0.5, "asSold"),
  ketchup: r(101, 1, 27.4, 0.1, "asSold"),

  // -- fruit (raw)
  banana: r(89, 1.1, 22.8, 0.3, "raw"),
  apple: r(52, 0.3, 13.8, 0.2, "raw"),
  berries: r(50, 0.9, 12, 0.4, "raw"),
  orange: r(47, 0.9, 11.8, 0.1, "raw"),
  lemon: r(22, 0.4, 6.9, 0.2, "raw"),
  dates: r(277, 1.8, 75, 0.2, "raw"),
  grapes: r(69, 0.7, 18.1, 0.2, "raw"),
  mango: r(60, 0.8, 15, 0.4, "raw"),
  watermelon: r(30, 0.6, 7.6, 0.2, "raw"),
  pear: r(57, 0.4, 15.2, 0.1, "raw"),
  pineapple: r(50, 0.5, 13.1, 0.1, "raw"),
  pomegranate: r(83, 1.7, 18.7, 1.2, "raw"),
  strawberries: r(32, 0.7, 7.7, 0.3, "raw"),
  kiwi: r(61, 1.1, 14.7, 0.5, "raw"),
  clementine: r(47, 0.9, 12, 0.2, "raw"),
  grapefruit: r(42, 0.8, 10.7, 0.1, "raw"),
  peach: r(39, 0.9, 9.5, 0.3, "raw"),
  apricot: r(48, 1.4, 11.1, 0.4, "raw"),
  plum: r(46, 0.7, 11.4, 0.3, "raw"),
  fig: r(74, 0.8, 19.2, 0.3, "raw"),
  persimmon: r(70, 0.6, 18.6, 0.2, "raw"),
  cherries: r(63, 1.1, 16, 0.2, "raw"),

  // -- fats, nuts, seeds, spreads
  oliveOil: r(884, 0, 0, 100, "asSold"),
  tahini: r(595, 17, 21.2, 53.8, "asSold"),
  nuts: r(594, 17.3, 25.4, 51.5, "asSold"),
  almonds: r(579, 21.2, 21.6, 49.9, "asSold"),
  walnuts: r(654, 15.2, 13.7, 65.2, "asSold"),
  peanutButter: r(588, 25, 20, 50, "asSold"),
  pumpkinSeeds: r(559, 30.2, 10.7, 49, "asSold"),
  sunflowerSeeds: r(584, 20.8, 20, 51.5, "asSold"),
  flaxseed: r(534, 18.3, 28.9, 42.2, "asSold"),
  chia: r(486, 16.5, 42.1, 30.7, "asSold"),
  olives: r(125, 0.9, 5, 12.5, "drained"),
  hummusSpread: r(166, 7.9, 14.3, 9.6, "asSold"),
  honey: r(304, 0.3, 82.4, 0, "asSold"),
  darkChocolate: r(598, 7.8, 45.9, 42.6, "asSold"),
  mayo: r(680, 1, 0.6, 75, "asSold"),
};

/** The Atwater estimate of a row's calories from its macros. */
export function atwater(n: Per100 & { alcohol?: number }): number {
  return 4 * n.protein + 4 * n.carbs + 9 * n.fat + 7 * (n.alcohol ?? 0);
}
