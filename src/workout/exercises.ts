/**
 * The exercise library — bundled on the device, so the training feature works
 * offline and costs nothing. Each exercise carries how to do it in both
 * languages and a search term that opens a real demonstration video on
 * YouTube: the app cannot make videos, but it can send you straight to a good
 * one for free, which is the honest best.
 */

export type Muscle =
  | "chest" | "back" | "shoulders" | "legs" | "glutes" | "arms" | "core" | "fullbody" | "cardio";

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell";

export type Exercise = {
  id: string;
  he: string;
  en: string;
  muscle: Muscle;
  equipment: Equipment;
  /** A compound (multi-joint) lift leads a session; accessories fill it out. */
  compound: boolean;
  howHe: string[];
  howEn: string[];
  /** What to search on YouTube for a form demo. */
  yt: string;
  /** True for a user's own manually-added move. */
  custom?: boolean;
};

const E = (
  id: string, he: string, en: string, muscle: Muscle, equipment: Equipment,
  compound: boolean, howHe: string[], howEn: string[], yt: string,
): Exercise => ({ id, he, en, muscle, equipment, compound, howHe, howEn, yt });

export const EXERCISES: Exercise[] = [
  // -- chest
  E("bench-press", "לחיצת חזה במוט", "Barbell bench press", "chest", "barbell", true,
    ["שכב על הספסל, אחיזה מעט רחבה מהכתפיים", "הורד את המוט לחזה ודחוף בשליטה כלפי מעלה"],
    ["Lie on the bench, grip a bit wider than shoulders", "Lower the bar to the chest and press up under control"],
    "barbell bench press proper form"),
  E("db-bench", "לחיצת חזה במשקולות", "Dumbbell bench press", "chest", "dumbbell", true,
    ["שכב עם משקולת בכל יד מעל החזה", "הורד לצדדים ודחוף חזרה עד יישור המרפקים"],
    ["Lie with a dumbbell in each hand over the chest", "Lower to the sides and press back to lockout"],
    "dumbbell bench press form"),
  E("incline-press", "לחיצת חזה עליון בשיפוע", "Incline press", "chest", "dumbbell", true,
    ["ספסל בשיפוע 30 מעלות, משקולות מעל החזה העליון", "דחוף מעלה ורד בשליטה"],
    ["Bench at 30°, dumbbells over the upper chest", "Press up and lower slowly"],
    "incline dumbbell press form"),
  E("pushup", "שכיבות סמיכה", "Push-up", "chest", "bodyweight", true,
    ["ידיים מעט רחבות מהכתפיים, גוף ישר", "רד עד שהחזה כמעט נוגע, דחוף חזרה"],
    ["Hands slightly wider than shoulders, body straight", "Lower until the chest nearly touches, press back"],
    "push up proper form"),
  E("chest-fly", "פרפר חזה", "Chest fly", "chest", "dumbbell", false,
    ["שכב עם משקולות מעל החזה, מרפקים רכים", "פתח לצדדים בקשת וסגור מעל החזה"],
    ["Lie with dumbbells over the chest, soft elbows", "Open in an arc and squeeze back together"],
    "dumbbell chest fly form"),
  // -- back
  E("deadlift", "דדליפט", "Deadlift", "back", "barbell", true,
    ["רגליים ברוחב אגן, אחוז את המוט מחוץ לברכיים", "גב ישר, דחוף דרך הרצפה והתרומם"],
    ["Feet hip-width, grip the bar outside the knees", "Flat back, drive through the floor and stand up"],
    "deadlift proper form"),
  E("pullup", "מתח", "Pull-up", "back", "bodyweight", true,
    ["אחיזה רחבה, תלייה מלאה", "משוך עד שהסנטר מעל המוט, רד בשליטה"],
    ["Wide grip, full hang", "Pull until the chin clears the bar, lower slowly"],
    "pull up proper form"),
  E("bent-row", "חתירה במוט", "Barbell row", "back", "barbell", true,
    ["רכון קדימה עם גב ישר, מוט תלוי", "משוך אל הבטן התחתונה ורד בשליטה"],
    ["Hinge forward with a flat back, bar hanging", "Row to the lower belly and lower under control"],
    "barbell bent over row form"),
  E("lat-pulldown", "משיכת פולי עליון", "Lat pulldown", "back", "cable", true,
    ["אחוז את המוט רחב, שב זקוף", "משוך אל החזה העליון וחזור לאט"],
    ["Grip the bar wide, sit tall", "Pull to the upper chest and return slowly"],
    "lat pulldown proper form"),
  E("seated-row", "חתירה בישיבה", "Seated cable row", "back", "cable", false,
    ["שב זקוף, אחוז את הידית", "משוך אל הבטן, כווץ שכמות, שחרר לאט"],
    ["Sit tall, grab the handle", "Pull to the belly, squeeze the shoulder blades, release slowly"],
    "seated cable row form"),
  // -- shoulders
  E("ohp", "לחיצת כתפיים במוט", "Overhead press", "shoulders", "barbell", true,
    ["מוט בגובה הכתפיים, ליבה אסופה", "דחוף מעל הראש עד יישור ורד בשליטה"],
    ["Bar at shoulder height, core braced", "Press overhead to lockout and lower under control"],
    "overhead press proper form"),
  E("db-shoulder-press", "לחיצת כתפיים במשקולות", "Dumbbell shoulder press", "shoulders", "dumbbell", true,
    ["משקולות בגובה האוזניים", "דחוף מעל הראש וסגור, רד לאט"],
    ["Dumbbells at ear height", "Press overhead and together, lower slowly"],
    "dumbbell shoulder press form"),
  E("lateral-raise", "הרחקת כתף", "Lateral raise", "shoulders", "dumbbell", false,
    ["משקולות לצד הגוף, מרפק רך", "הרם לצדדים עד גובה הכתף ורד לאט"],
    ["Dumbbells at the sides, soft elbow", "Raise out to shoulder height and lower slowly"],
    "lateral raise proper form"),
  E("face-pull", "משיכת פנים", "Face pull", "shoulders", "cable", false,
    ["כבל בגובה הפנים, אחיזה בחבל", "משוך אל הפנים ופתח את המרפקים לצדדים"],
    ["Cable at face height, rope grip", "Pull to the face and flare the elbows out"],
    "face pull form"),
  // -- legs
  E("squat", "סקוואט", "Back squat", "legs", "barbell", true,
    ["מוט על הגב העליון, רגליים ברוחב כתפיים", "רד עד שהירכיים מקבילות ודחוף מעלה"],
    ["Bar on the upper back, feet shoulder-width", "Descend to parallel and drive up"],
    "back squat proper form"),
  E("front-squat", "סקוואט קדמי", "Front squat", "legs", "barbell", true,
    ["מוט על הכתפיים הקדמיות, מרפקים גבוהים", "רד זקוף ודחוף מעלה"],
    ["Bar on the front shoulders, elbows high", "Descend upright and drive up"],
    "front squat form"),
  E("goblet-squat", "סקוואט גביע", "Goblet squat", "legs", "dumbbell", true,
    ["החזק משקולת מול החזה", "רד בין הרגליים ודחוף מעלה"],
    ["Hold a dumbbell at the chest", "Sink between the legs and drive up"],
    "goblet squat form"),
  E("lunge", "מספריים", "Lunge", "legs", "dumbbell", true,
    ["צעד קדימה, רד עד שהברך האחורית כמעט נוגעת", "דחוף חזרה והחלף רגל"],
    ["Step forward, lower until the back knee nearly touches", "Push back and switch legs"],
    "dumbbell lunge form"),
  E("leg-press", "לחיצת רגליים", "Leg press", "legs", "machine", true,
    ["רגליים על הפלטה ברוחב כתפיים", "רד בשליטה ודחוף בלי לנעול ברכיים"],
    ["Feet on the plate shoulder-width", "Lower under control and press without locking the knees"],
    "leg press proper form"),
  E("rdl", "רומני דדליפט", "Romanian deadlift", "glutes", "barbell", true,
    ["מוט מול הירכיים, ברכיים רכות", "דחוף אגן אחורה, רד לאורך הרגליים וחזור"],
    ["Bar at the thighs, soft knees", "Push the hips back, slide down the legs and return"],
    "romanian deadlift form"),
  E("hip-thrust", "הרמת אגן", "Hip thrust", "glutes", "barbell", true,
    ["גב עליון על ספסל, מוט על האגן", "דחוף את האגן מעלה וכווץ ישבן"],
    ["Upper back on a bench, bar over the hips", "Drive the hips up and squeeze the glutes"],
    "hip thrust form"),
  E("leg-curl", "כפיפת ברך", "Leg curl", "legs", "machine", false,
    ["שכב/שב במכונה, קרסוליים על הכרית", "כופף את הברכיים וחזור לאט"],
    ["Lie or sit in the machine, ankles on the pad", "Curl the knees and return slowly"],
    "leg curl machine form"),
  E("calf-raise", "הרמת עקבים", "Calf raise", "legs", "bodyweight", false,
    ["עמוד על קצות האצבעות", "הרם עקבים גבוה ורד לאט"],
    ["Stand on the balls of the feet", "Raise the heels high and lower slowly"],
    "calf raise form"),
  // -- arms
  E("biceps-curl", "כפיפת מרפק", "Biceps curl", "arms", "dumbbell", false,
    ["משקולות לצד הגוף, מרפקים צמודים", "כופף מעלה וכווץ, רד לאט"],
    ["Dumbbells at the sides, elbows pinned", "Curl up and squeeze, lower slowly"],
    "dumbbell biceps curl form"),
  E("hammer-curl", "כפיפת פטיש", "Hammer curl", "arms", "dumbbell", false,
    ["אחיזה ניטרלית, מרפקים צמודים", "כופף מעלה ורד בשליטה"],
    ["Neutral grip, elbows pinned", "Curl up and lower under control"],
    "hammer curl form"),
  E("triceps-pushdown", "פשיטת מרפק בפולי", "Triceps pushdown", "arms", "cable", false,
    ["אחוז את החבל, מרפקים צמודים", "דחוף מטה עד יישור וחזור לאט"],
    ["Grab the rope, elbows pinned", "Push down to lockout and return slowly"],
    "triceps pushdown form"),
  E("dips", "מקבילים", "Dips", "arms", "bodyweight", true,
    ["תלייה על מקבילים, גוף זקוף", "רד עד 90 מעלות ודחוף מעלה"],
    ["Support on parallel bars, torso upright", "Lower to 90° and press up"],
    "triceps dips form"),
  // -- core
  E("plank", "פלאנק", "Plank", "core", "bodyweight", false,
    ["מרפקים מתחת לכתפיים, גוף ישר", "אסוף ליבה והחזק"],
    ["Elbows under the shoulders, body straight", "Brace the core and hold"],
    "plank proper form"),
  E("hanging-leg-raise", "הרמת רגליים בתלייה", "Hanging leg raise", "core", "bodyweight", false,
    ["תלייה על מוט", "הרם רגליים ישרות ורד לאט"],
    ["Hang from a bar", "Raise straight legs and lower slowly"],
    "hanging leg raise form"),
  E("crunch", "כפיפות בטן", "Crunch", "core", "bodyweight", false,
    ["שכב, ברכיים כפופות", "כווץ בטן והרם כתפיים, רד לאט"],
    ["Lie down, knees bent", "Crunch and lift the shoulders, lower slowly"],
    "crunch proper form"),
  // -- cardio / fullbody
  E("burpee", "ברפי", "Burpee", "fullbody", "bodyweight", true,
    ["שכיבת סמיכה, קפיצה לרגליים", "קפוץ מעלה עם ידיים גבוה"],
    ["Drop to a push-up, jump the feet in", "Jump up with the arms overhead"],
    "burpee proper form"),
  E("kb-swing", "נדנוד קטלבל", "Kettlebell swing", "fullbody", "kettlebell", true,
    ["קטלבל בין הרגליים, דחוף אגן אחורה", "נדנד מעלה בכוח האגן עד גובה החזה"],
    ["Kettlebell between the legs, hips back", "Swing up with the hips to chest height"],
    "kettlebell swing form"),
];

/** Everyday muscle groups that a plan cycles through. */
export const MUSCLES: Muscle[] = [
  "chest", "back", "shoulders", "legs", "glutes", "arms", "core", "fullbody",
];

/** A YouTube search URL that opens a real form demo for an exercise. */
export function demoUrl(ex: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.yt)}`;
}
