/**
 * Searching and filtering the exercise catalogue.
 *
 * Kept out of the screen so the behaviour people actually complain about —
 * "I searched for my exercise and it wasn't there" — is testable. The filters
 * compose: a muscle, a kit, and a free-text term all narrow the same list, and
 * the result carries whether anything survived, because an empty result is the
 * moment to offer "add it yourself" rather than a blank screen.
 */
import { EXERCISES, type Equipment, type Exercise, type Muscle } from "./exercises";
import { difficulty } from "./difficulty";

export type LibraryFilter = {
  /** Free text over the Hebrew name, the English name and the search term. */
  query?: string;
  muscle?: Muscle | "all";
  equipment?: Equipment | "all";
  /** Only moves of this difficulty (1 beginner, 2 intermediate, 3 advanced).
   * A person's own moves always pass. */
  level?: 1 | 2 | 3;
  /** The person's own moves, shown alongside the built-in ones. */
  custom?: Exercise[];
};

/** Everything the app knows, the person's own additions last. */
export function allExercises(custom: Exercise[] = []): Exercise[] {
  return [...EXERCISES, ...custom];
}

/**
 * The words people actually type, mapped onto what the catalogue calls things.
 *
 * Nobody searches for "כפיפת מרפק" — they search for "ביצפס". A catalogue that
 * only answers to its own vocabulary reads as a catalogue that is missing the
 * exercise, which is the single fastest way to lose someone to the app they
 * came from.
 */
const MUSCLE_ALIASES: Record<Muscle, string[]> = {
  chest: ["חזה", "פקטורל", "pecs", "chest", "push"],
  back: ["גב", "לאט", "רחב גבי", "טרפז", "lats", "back", "pull"],
  shoulders: ["כתף", "כתפיים", "דלתא", "delts", "shoulder", "shoulders"],
  legs: ["רגל", "רגליים", "ירך", "ארבע ראשי", "קוואד", "quads", "hamstrings", "legs", "תאומים", "שוק"],
  glutes: ["ישבן", "עכוז", "גלוטס", "glutes", "butt"],
  arms: ["ביצפס", "בייספס", "טרייספס", "טרייספ", "יד", "ידיים", "זרוע", "biceps", "triceps", "arms"],
  forearms: ["אמה", "אמות", "אחיזה", "כף יד", "forearm", "forearms", "grip"],
  core: ["בטן", "ליבה", "אבס", "שרירי בטן", "abs", "core", "obliques"],
  fullbody: ["כל הגוף", "גוף מלא", "פונקציונלי", "full body", "functional"],
  cardio: ["אירובי", "קרדיו", "ריצה", "הליכון", "אופניים", "cardio", "conditioning"],
};

/** Kit people name in their own words. */
const EQUIPMENT_ALIASES: Record<Equipment, string[]> = {
  barbell: ["מוט", "ברבל", "משקולת חופשית", "barbell", "bar"],
  dumbbell: ["משקולת", "משקולות", "דמבל", "dumbbell", "dumbbells"],
  machine: ["מכונה", "מכשיר", "machine"],
  cable: ["כבל", "כבלים", "פולי", "cable", "pulley"],
  bodyweight: ["משקל גוף", "בלי ציוד", "בבית", "bodyweight", "no equipment"],
  kettlebell: ["קטלבל", "פעמון", "kettlebell"],
  smith: ["סמית", "מכונת סמית", "smith"],
  band: ["גומייה", "גומיה", "רצועה", "band", "resistance band"],
};

function norm(s: string): string {
  // Hebrew is typed with and without the final forms and with stray gershayim;
  // stripping punctuation means "לחיצת חזה" finds "לחיצת חזה במוט".
  return s.toLowerCase().replace(/["'׳״\-_.]/g, "").trim();
}

/**
 * Does this exercise answer to this term? Matches any word of the query
 * against any of the names, so "לחיצה חזה" and "chest press" both land — a
 * search that demands the exact phrase is a search that finds nothing.
 */
/** What gym-goers actually call a move, when the library's name is another. */
const MOVE_ALIASES: Record<string, string[]> = {
  dips: ["דיפס"],
  "bench-dip": ["דיפס"],
  lunge: ["לאנג", "מספריים"],
  "walking-lunge": ["לאנג", "מספריים"],
  "bw-lunge": ["לאנג", "מספריים"],
  "reverse-lunge": ["לאנג"],
  "bulgarian-split-squat": ["בולגרי", "לאנג"],
  "pec-deck": ["פק דק", "פרפר"],
  "lat-pulldown": ["פולי", "לט"],
  "rdl": ["רומני", "rdl"],
  "hip-thrust": ["היפ", "גשר"],
  "face-pull": ["פייס פול", "משיכת פנים"],
  "lateral-raise": ["הרחקת כתף", "הרחקה"],
  "hack-squat": ["הק", "האק"],
  pullup: ["מתח", "פול אפ"],
  chinup: ["מתח", "צ'ין"],
  pushup: ["שכיבות", "פוש אפ"],
  squat: ["סקוואט", "סקוואט במוט"],
  deadlift: ["דדליפט", "מתים"],
  plank: ["פלאנק", "פלנק"],
  "leg-press": ["לחיצת רגליים", "לג פרס"],
};

export function matches(ex: Exercise, query: string, muscleLabel?: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const hay = norm(
    [
      ex.he,
      ex.en,
      ex.yt,
      muscleLabel ?? "",
      ex.muscle,
      ex.equipment,
      ...MUSCLE_ALIASES[ex.muscle],
      ...EQUIPMENT_ALIASES[ex.equipment],
      ...(MOVE_ALIASES[ex.id] ?? []),
    ].join(" "),
  );
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/** The filtered catalogue, in catalogue order. */
export function filterExercises(
  filter: LibraryFilter,
  muscleLabels: Partial<Record<Muscle, string>> = {},
): Exercise[] {
  const { query = "", muscle = "all", equipment = "all", custom = [], level } = filter;
  return allExercises(custom).filter((ex) => {
    if (muscle !== "all" && ex.muscle !== muscle) return false;
    if (equipment !== "all" && ex.equipment !== equipment) return false;
    if (level && !ex.custom && difficulty(ex.id) !== level) return false;
    return matches(ex, query, muscleLabels[ex.muscle]);
  });
}

/** How many moves the catalogue holds for each muscle, for the chip counts. */
export function countByMuscle(custom: Exercise[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ex of allExercises(custom)) out[ex.muscle] = (out[ex.muscle] ?? 0) + 1;
  return out;
}

/** Every kit the catalogue actually contains, so no chip leads to nothing. */
export function equipmentKinds(custom: Exercise[] = []): Equipment[] {
  const seen = new Set<Equipment>();
  for (const ex of allExercises(custom)) seen.add(ex.equipment);
  return [...seen];
}
