/**
 * How hard each exercise is to learn and do safely — what lets a plan match the
 * person holding the phone. A beginner handed snatches and pistol squats gives
 * up in a week; an experienced lifter handed a machine circuit is bored in one.
 *
 *   1 — beginner: machines, cables, bands and the simple free-weight and
 *       bodyweight moves you can do well the first day.
 *   2 — intermediate: the standard free-weight lifts; the default.
 *   3 — advanced: heavy barbell and Olympic lifts, and the bodyweight skills
 *       that need real strength or technique first.
 *
 * A list rather than a field on every exercise so the library stays readable;
 * anything not named here is a 2. A person's own exercise is never filtered out.
 */

export type Level = "beginner" | "intermediate" | "advanced";
export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

const BEGINNER = new Set([
  // chest
  "machine-chest-press", "pec-deck", "db-bench", "pushup", "incline-pushup", "smith-bench",
  "band-chest-press", "cable-crossover", "chest-fly",
  // back
  "lat-pulldown", "seated-row", "machine-row", "chest-supported-row", "db-row", "wide-pulldown",
  "close-pulldown", "straight-arm-pulldown", "band-pulldown", "back-extension", "superman", "shrug",
  // shoulders
  "machine-shoulder-press", "db-shoulder-press", "seated-db-press", "lateral-raise", "machine-lateral",
  "cable-lateral", "band-lateral", "face-pull", "reverse-pec-deck", "rear-delt-fly", "front-raise",
  "smith-ohp",
  // legs & glutes
  "leg-press", "leg-extension", "leg-curl", "seated-leg-curl", "lying-leg-curl", "goblet-squat",
  "air-squat", "bw-lunge", "step-up", "wall-sit", "reverse-lunge", "inverted-row", "calf-raise", "seated-calf-raise", "standing-calf",
  "smith-squat", "adductor-machine", "abductor-machine", "glute-bridge", "frog-pump", "cable-kickback",
  "banded-walk", "kb-deadlift",
  // arms & forearms
  "biceps-curl", "hammer-curl", "cable-curl", "machine-curl", "concentration-curl", "preacher-curl",
  "band-curl", "triceps-pushdown", "rope-pushdown", "overhead-triceps", "triceps-kickback", "bench-dip",
  "wrist-curl", "reverse-wrist-curl", "farmers-walk", "dead-hang",
  // core
  "plank", "side-plank", "crunch", "dead-bug", "reverse-crunch", "cable-crunch", "flutter-kick",
  "bicycle-crunch", "mountain-climber",
  // cardio
  "incline-walk", "stationary-bike", "elliptical", "rowing-machine", "treadmill-run", "swimming",
]);

const ADVANCED = new Set([
  "deadlift", "sumo-deadlift", "front-squat", "good-morning", "pendlay-row", "kroc-row", "push-press",
  "power-clean", "snatch", "clean-and-press", "man-maker", "devil-press", "kb-snatch", "turkish-getup",
  "pullup", "dips", "pistol-squat", "nordic-curl", "glute-ham-raise", "sissy-squat", "toes-to-bar",
  "l-sit", "hanging-leg-raise", "ab-wheel", "jm-press", "decline-pushup", "diamond-pushup",
  "weighted-plank", "box-jump", "sprint-intervals", "assault-bike",
]);

/** 1, 2 or 3 — see above. */
export function difficulty(id: string): 1 | 2 | 3 {
  if (BEGINNER.has(id)) return 1;
  if (ADVANCED.has(id)) return 3;
  return 2;
}

/** The hardest an exercise may be for this level. No level at all — a plan set
 * up before levels existed — filters nothing, so nobody's plan changes under
 * them on an update. */
export function maxDifficulty(level: Level | undefined): 1 | 2 | 3 {
  if (level === "beginner") return 1;
  if (level === "intermediate") return 2;
  return 3;
}
