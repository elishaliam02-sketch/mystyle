/**
 * Reading a self-assigned task and deciding how hard it is.
 *
 * The app lets people write their own tasks in their own words, which is the
 * only way a habit ever sticks — and it is also why a flat reward is wrong.
 * "Drink a glass of water" and "Run 10 km before work" are one tick each, and
 * paying them the same turns the board into a game you win by writing easy
 * tasks. So the text itself is read: the numbers in it, the units they carry,
 * the verb, whether it is a thing done or a thing resisted, and how much of it
 * there is. Out comes a difficulty and the points a completion is worth.
 *
 * It is a scanner, not a judge. It says what it noticed (`reasons`) and the
 * screen shows that back — "5 km · a real distance" — so a person can see why
 * their task landed where it did, and reword it if the app misread them.
 *
 * Deliberately pure and offline: no model call, no network, instant on every
 * keystroke, and it works the same on a plane. Hebrew and English both, since
 * the app is written in both and people mix them in one line.
 */

export type Difficulty = "easy" | "moderate" | "hard";

/** What the scanner spotted. The screen turns these into words. */
export type Reason =
  /** A number with a unit: "5 km", "50 reps", "3 liters". */
  | "quantity"
  /** A stretch of time to be spent: "30 minutes", "שעה". */
  | "duration"
  /** Words that mean this costs something: heavy, sprint, cold, max. */
  | "intensity"
  /** A verb that moves a body: run, lift, swim, ride. */
  | "effort"
  /** A thing resisted rather than done: no sugar, quit smoking. All day, every
   *  day, with no moment where it is finished — the hardest shape there is. */
  | "abstain"
  /** Hours that cost sleep or planning: 5am, before work, late. */
  | "schedule"
  /** More than one thing in one task, or one thing that runs all day. */
  | "scope"
  /** Words that mark it as small on purpose: just, one, a couple. */
  | "small";

export type Scan = {
  level: Difficulty;
  /** 0–100. Exposed so a screen can draw a meter rather than three buckets. */
  score: number;
  /** What a completion of this task is worth. */
  points: number;
  /** In the order they were found, most telling first. */
  reasons: Reason[];
};

/** What each difficulty pays. Steep enough to be worth writing a real task. */
export const POINTS: Record<Difficulty, number> = {
  easy: 10,
  moderate: 25,
  hard: 45,
};

/** Where a score lands. */
export const BANDS: Record<Difficulty, [number, number]> = {
  easy: [0, 29],
  moderate: [30, 59],
  hard: [60, 100],
};

/**
 * Hebrew is written with and without niqqud and with different final forms in
 * the middle of an inflected word; folding both means one keyword list covers
 * what people actually type.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[״"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Bucket = { words: string[]; weight: number; reason: Reason };

/**
 * Matches a keyword at the start of a word, so a stem still catches its
 * inflections ("run" finds "running", "ריצה" finds "ריצה שלי") without a word
 * matching inside an unrelated one — "phone" is not an instance of "one", and
 * that near-miss is exactly what a plain substring test gets wrong.
 */
function hasWord(text: string, word: string): boolean {
  return ` ${text} `.includes(` ${word}`);
}

/**
 * The keyword buckets, English and Hebrew side by side. Each bucket fires at
 * most once, however many of its words appear.
 */
const BUCKETS: Bucket[] = [
  {
    reason: "intensity",
    weight: 22,
    words: [
      "heavy", "max", "maximum", "sprint", "hiit", "failure", "pr", "personal best",
      "cold shower", "ice bath", "fasting", "fast ", "burpee", "hill", "incline",
      "interval", "intervals",
      "כבד", "מקסימום", "ספרינט", "כשל", "שיא", "מקלחת קרה", "אמבטיה קרה", "צום", "ברפי", "עליה",
      "אינטרוול",
    ],
  },
  {
    reason: "effort",
    weight: 14,
    words: [
      "run", "running", "jog", "gym", "workout", "train", "lift", "squat", "deadlift",
      "bench", "swim", "cycle", "bike", "row", "climb", "hike", "push-up", "pushup",
      "pull-up", "pullup", "plank", "yoga", "walk", "sprint", "interval",
      "ריצה", "לרוץ", "רץ", "חדר כושר", "אימון", "להתאמן", "מתאמן", "סקוואט", "דדליפט",
      "לחיצת חזה", "שחיה", "שחייה", "לשחות", "אופניים", "חתירה", "טיפוס", "הליכה", "ללכת",
      "שכיבות סמיכה", "מתח", "פלאנק", "יוגה", "מסלול",
    ],
  },
  {
    // A task that has to hold all day never has a moment where it is done.
    reason: "scope",
    weight: 8,
    words: ["all day", "every day", "daily", "כל היום", "כל יום", "יומי"],
  },
  {
    reason: "abstain",
    weight: 20,
    words: [
      "no ", "quit", "stop ", "avoid", "without", "zero ", "cut out", "give up",
      "לא ", "בלי", "להפסיק", "להימנע", "לוותר", "אפס ",
    ],
  },
  {
    reason: "schedule",
    weight: 12,
    words: [
      "5am", "6am", "4am", "5:00", "6:00", "sunrise", "before work", "early",
      "midnight", "late night", "before bed",
      "מוקדם", "לפני העבודה", "זריחה", "בבוקר מוקדם", "לפני השינה", "חצות",
    ],
  },
  {
    reason: "small",
    weight: -12,
    words: [
      "just ", "only ", "one ", "a glass", "a cup", "a few", "quick", "small", "single",
      "רק ", "כוס", "כוסית", "קטן", "קצר", "מהיר", "אחד", "אחת",
    ],
  },
];

/** A number with a unit, in either language. */
type Quantity = { value: number; unit: UnitKind };
type UnitKind = "distance" | "minutes" | "hours" | "reps" | "mass" | "volume" | "count" | "pages";

/**
 * Units are bounded by spaces rather than by `\b`: a word boundary is defined
 * against ASCII word characters, so between a space and a Hebrew letter there
 * is no boundary at all and every Hebrew unit would silently never match.
 */
const UNITS: [string[], UnitKind][] = [
  [["km", "kms", "kilometer", "kilometers", "mile", "miles", "קמ", "קילומטר", "קילומטרים"], "distance"],
  [["min", "mins", "minute", "minutes", "דק", "דקה", "דקות"], "minutes"],
  [["hour", "hours", "hr", "hrs", "שעה", "שעות"], "hours"],
  [["rep", "reps", "repetition", "repetitions", "set", "sets", "חזרות", "חזרה", "סטים", "סט"], "reps"],
  [["kg", "kgs", "kilo", "kilos", "lb", "lbs", "pound", "pounds", "קג", "קילו", "קילוגרם"], "mass"],
  [["l", "liter", "liters", "litre", "litres", "glass", "glasses", "cup", "cups", "ליטר", "כוסות", "כוס"], "volume"],
  [["page", "pages", "chapter", "chapters", "עמודים", "עמוד", "פרקים", "פרק"], "pages"],
];

/**
 * Pulls "5 km", "50 reps", "שעה וחצי"-style pairs out of the text. Only the
 * number immediately before a unit counts, so "log 3 meals of 500 kcal" does
 * not read as a 500-unit anything.
 */
function quantities(text: string): Quantity[] {
  const found: Quantity[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*([a-z֐-׿]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = Number(m[1].replace(",", "."));
    if (!Number.isFinite(value)) continue;
    const word = m[2];
    const unit = UNITS.find(([words]) => words.includes(word));
    found.push({ value, unit: unit ? unit[1] : "count" });
  }
  // An hour written as a word rather than a number still means an hour.
  const hasTime = found.some((q) => q.unit === "minutes" || q.unit === "hours");
  if (!hasTime && (hasWord(text, "an hour") || hasWord(text, "שעה"))) {
    found.push({ value: 1, unit: "hours" });
  }
  return found;
}

/** How much a quantity adds, by unit and by size. */
function weighQuantity(q: Quantity): number {
  const { value, unit } = q;
  switch (unit) {
    case "distance":
      return value >= 15 ? 38 : value >= 10 ? 32 : value >= 5 ? 24 : value >= 2 ? 16 : 8;
    case "minutes":
    case "hours": {
      const minutes = unit === "hours" ? value * 60 : value;
      return minutes >= 90 ? 34 : minutes >= 60 ? 28 : minutes >= 30 ? 20 : minutes >= 15 ? 14 : 2;
    }
    case "reps":
      return value >= 100 ? 30 : value >= 50 ? 22 : value >= 20 ? 12 : 6;
    case "mass":
      return value >= 100 ? 26 : value >= 60 ? 18 : value >= 20 ? 10 : 4;
    case "volume":
      return value >= 3 ? 12 : value >= 2 ? 8 : 2;
    case "pages":
      return value >= 50 ? 22 : value >= 20 ? 14 : value >= 10 ? 8 : 4;
    case "count":
      return value >= 100 ? 14 : value >= 20 ? 8 : 3;
  }
}

/**
 * Reads a task and prices it.
 *
 * The baseline is 18 — a bare "meditate" is a real task, not a freebie — and
 * everything the text says about itself moves it from there.
 */
export function scanTask(title: string): Scan {
  const text = normalize(title);
  if (!text) return { level: "easy", score: 0, points: POINTS.easy, reasons: [] };

  let score = 18;
  const reasons: Reason[] = [];
  const add = (weight: number, reason: Reason) => {
    score += weight;
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  // The numbers first: they are the strongest signal a person gives, and the
  // one they can argue with ("I said 5 km").
  const qs = quantities(text);
  const heaviest = qs.map(weighQuantity).sort((a, b) => b - a)[0];
  if (heaviest !== undefined && heaviest > 0) {
    const q = qs[qs.map(weighQuantity).indexOf(heaviest)];
    add(heaviest, q.unit === "minutes" || q.unit === "hours" ? "duration" : "quantity");
  }

  // Then the words. Each bucket fires once, however many of its words appear:
  // "run and swim" is not twice as hard as "run".
  for (const bucket of BUCKETS) {
    if (bucket.words.some((w) => hasWord(text, w))) add(bucket.weight, bucket.reason);
  }

  // Two things joined into one task is two things to do.
  const clauses = text.split(/\s(?:and|then|plus|ו|וגם|אחר כך)\s|[,;+]/).filter((c) => c.trim());
  if (clauses.length > 1) add(8 * Math.min(clauses.length - 1, 3), "scope");

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: Difficulty = score >= BANDS.hard[0] ? "hard" : score >= BANDS.moderate[0] ? "moderate" : "easy";

  return { level, score, points: POINTS[level], reasons };
}

/** The points a task is worth, without the rest of the scan. */
export function taskPoints(title: string): number {
  return scanTask(title).points;
}
