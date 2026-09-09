import type { Colors } from "./tokens";

/**
 * One hue per metric family, fixed for the life of the app.
 *
 * Someone reading their phone between sets is not reading labels — they are
 * catching a shape and a colour at arm's length, upside down, out of breath.
 * So every number the app shows belongs to exactly one of three families, and
 * that family owns one of the three brights. Colour answers "what is this?"
 * before the eye reaches the word under it, and the answer never changes from
 * screen to screen: kilos are blue on the plan, blue in the progress corner,
 * blue on the weigh-in.
 *
 *   LOAD   (electric blue)  — mass and volume moved: kg on the bar, session
 *                             volume, an estimated 1RM, bodyweight, body fat,
 *                             water drunk, protein.
 *   COUNT  (neon lime)      — things finished: reps, sets, steps, habits
 *                             ticked, the day score, carbs.
 *   EFFORT (vibrant orange) — time and cost: the rest clock, minutes trained,
 *                             pace, distance, calories, a streak, a PR.
 *
 * Anything that is not a measurement — names, hints, dates — stays charcoal.
 * Three brights is the whole budget: a fourth "just for this screen" is what
 * turns a system back into decoration.
 */
export type MetricFamily = "load" | "count" | "effort";

export type Metric =
  // load
  | "load"
  | "volume"
  | "oneRm"
  | "bodyWeight"
  | "bodyFat"
  | "water"
  | "protein"
  // count
  | "reps"
  | "sets"
  | "steps"
  | "ticks"
  | "score"
  | "carbs"
  // effort
  | "duration"
  | "rest"
  | "pace"
  | "distance"
  | "calories"
  | "streak"
  | "personalBest"
  | "fat";

export const METRIC_FAMILY: Record<Metric, MetricFamily> = {
  load: "load",
  volume: "load",
  oneRm: "load",
  bodyWeight: "load",
  bodyFat: "load",
  water: "load",
  protein: "load",

  reps: "count",
  sets: "count",
  steps: "count",
  ticks: "count",
  score: "count",
  carbs: "count",

  duration: "effort",
  rest: "effort",
  pace: "effort",
  distance: "effort",
  calories: "effort",
  streak: "effort",
  personalBest: "effort",
  fat: "effort",
};

/** The colour a figure is *written* in — contrast-checked against the paper. */
export function metricInk(colors: Colors, metric: Metric): string {
  switch (METRIC_FAMILY[metric]) {
    case "load":
      return colors.accent;
    case "count":
      return colors.limeInk;
    case "effort":
      return colors.orangeInk;
  }
}

/**
 * The colour a figure is *filled* with — a bar, a dot, a ring, a chip. This is
 * the weight that survives the theme's own paper: on a light ground neon lime
 * is a highlighter, so the count family fills with `limeInk` there and keeps
 * the neon for the charcoal surfaces (use `colors.lime` directly on the band
 * or the hero, where it belongs).
 */
export function metricFill(colors: Colors, metric: Metric): string {
  switch (METRIC_FAMILY[metric]) {
    case "load":
      return colors.accent;
    case "count":
      return colors.limeInk;
    case "effort":
      return colors.orange;
  }
}

/** The ink to write *on* a metric fill. */
export function onMetric(colors: Colors, metric: Metric): string {
  switch (METRIC_FAMILY[metric]) {
    case "load":
      return colors.onAccent;
    case "count":
      return colors.onLime;
    case "effort":
      return colors.onOrange;
  }
}

/** The tinted block a metric sits in — a callout, a selected chip. */
export function metricWash(colors: Colors, metric: Metric): string {
  switch (METRIC_FAMILY[metric]) {
    case "load":
      return colors.accentWash;
    case "count":
      return colors.limeWash;
    case "effort":
      return colors.orangeWash;
  }
}
