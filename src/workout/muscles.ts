/**
 * What an exercise actually works.
 *
 * The library gives every move one primary muscle, which is enough to build a
 * plan from but not enough to answer the question a person actually asks
 * looking at a row they do not recognise: *what does this do?* A bench press
 * is not only chest, and someone who does not already know that cannot tell
 * from the name.
 *
 * So the primary muscle is paired with the muscles that genuinely take load
 * alongside it. Only for compound lifts: an isolation move earns its name by
 * working one thing, and listing helpers for a bicep curl would be noise
 * dressed as information.
 */
import type { Exercise, Muscle } from "./exercises";

/** The muscles that share the work on a compound lift, per primary. */
const HELPERS: Record<Muscle, Muscle[]> = {
  chest: ["shoulders", "arms"],
  back: ["arms", "forearms", "shoulders"],
  shoulders: ["arms", "core"],
  legs: ["glutes", "core"],
  glutes: ["legs", "core"],
  arms: ["forearms"],
  forearms: [],
  core: [],
  fullbody: ["legs", "back", "shoulders", "core"],
  cardio: ["legs", "core"],
};

export type Worked = { primary: Muscle; secondary: Muscle[] };

export function worked(ex: Pick<Exercise, "muscle" | "compound">): Worked {
  const secondary = ex.compound ? (HELPERS[ex.muscle] ?? []) : [];
  // A muscle is never its own helper — that would draw the same region twice
  // and read as if it mattered less than it does.
  return { primary: ex.muscle, secondary: secondary.filter((m) => m !== ex.muscle) };
}

/**
 * Which way the body has to be facing for the worked muscle to be visible at
 * all. Drawing a lat pulldown on a front view highlights nothing a person can
 * see, which is worse than drawing no picture.
 */
export function view(m: Muscle): "front" | "back" {
  return m === "back" || m === "glutes" ? "back" : "front";
}

/** The worked muscles in the order they should be read: primary first. */
export function workedList(w: Worked): Muscle[] {
  return [w.primary, ...w.secondary];
}
