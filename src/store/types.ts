import type { Goal } from "@/kitchen";
import type { Exercise } from "@/workout/exercises";

/** The training plan config and log, device-local like the pantry. */
export type Training = {
  goal: Goal;
  /** How many days a week the plan spans. */
  days: number;
  /** How long one session runs, in minutes. Undefined for plans built before
   * duration was a criterion — the plan then falls back to a goal-based size. */
  minutes?: number;
  /** Which equipment the plan is built for: "gym" | "home" | "bodyweight". */
  equipment?: string;
  /** Muscle groups the person flagged as weak, so a generated plan leads with
   * them. Muscle ids from the workout library. */
  focus?: string[];
  /** The salt this plan's exercise rotation was rolled from. Bumping it (the
   * "regenerate" button) re-rolls the exact moves without changing the goal. */
  planSeed?: string;
  /** Weight lifted per exercise over time (exercise id → readings), so each
   * session can show what was moved last time — progressive overload. */
  weights?: Record<string, { date: string; kg: number }[]>;
  /** Local date (YYYY-MM-DD) → ids of exercises ticked that day. */
  log: Record<string, string[]>;
  /** Set-by-set logging: date → exercise id → its sets (weight, reps, ticked). */
  setLog?: Record<string, Record<string, { kg: number; reps: number; done: boolean }[]>>;
  /** Exercises added to a given day on top of the plan: date → exercise ids. */
  extra?: Record<string, string[]>;
  /** Per-day, permanent edits to the plan the person made by hand, Hevy-style:
   * plan-day index → exercises added to and removed from that day. Applied on
   * top of whatever the generator produced, so a re-roll keeps the person's own
   * picks. Removing every generated move and adding your own is how a fully
   * self-built day works. */
  planEdits?: Record<number, { add?: string[]; remove?: string[] }>;
  /** How the plan was made: "auto" fills each day from the library; "custom"
   * hands the person empty days to build themselves. Undefined reads as "auto". */
  mode?: "auto" | "custom";
  /** The person's own manually-added moves. */
  custom: Exercise[];
};

/** A progress photo the person took, with the day's numbers frozen beside it. */
export type ProgressPhoto = {
  id: string;
  /** A local file uri on the device. Never uploaded — stays on the phone. */
  uri: string;
  /** Local date YYYY-MM-DD. */
  date: string;
  /** The weigh-in and body-fat estimate at the time, so a before/after compares
   * numbers and not only pixels. */
  kg?: number;
  bf?: number;
};

/** One thing eaten and logged against the day's target. */
export type IntakeItem = {
  id: string;
  label: string;
  kcal: number;
  protein: number;
};

export type Habit = {
  id: string;
  title: string;
  /** Rough time of day, chosen from chips. Undefined means "whenever". */
  slot?: "morning" | "noon" | "evening";
  /** The existing routine this habit hangs off — "after I brush my teeth". */
  anchor?: string;
  createdAt: string;
  archived: boolean;
  /** When this habit was last edited on any device, ISO 8601. */
  updatedAt?: string;
};

/**
 * One habit on one day, with its state written down rather than implied by the
 * row existing. Presence-as-truth could not express "I unticked this": the row
 * simply vanished locally and the server's copy brought it back on the next
 * sync. An explicit `done`, with a timestamp, makes unticking a change like
 * any other.
 */
export type Completion = {
  habitId: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  done: boolean;
  updatedAt: string;
};

export type WeighIn = {
  date: string;
  kg: number;
  updatedAt: string;
};

export type CheckIn = {
  date: string;
  mood: "good" | "ok" | "hard";
  note: string;
  updatedAt: string;
};

export type Profile = {
  name: string;
  startKg?: number;
  goalKg?: number;
  /** Height in centimetres. Without it the app cannot tell a healthy target
   * weight from a dangerous one, so it is asked for and guarded. */
  heightCm?: number;
  /** Sex, for the body-fat estimate (the RFM formula needs it). Optional — the
   * progress corner asks for it only when the person wants a body-fat reading. */
  sex?: "male" | "female";
  onboarded: boolean;
  /** Whether daily reminders are scheduled on this device. */
  reminders?: boolean;
  updatedAt?: string;
};

/**
 * What the person has agreed to, and when.
 *
 * Device-local and never synced: an agreement is given by a person on a
 * device, and a record of it that could be overwritten by another device's
 * copy would be worth nothing as evidence.
 */
export type LegalAcceptance = {
  /** The document version accepted — see LEGAL.version. */
  version: number;
  acceptedAt: string;
};

/**
 * The two things that can send personal data off the phone, each off until
 * the person turns it on. Kept apart from the acceptance record because
 * accepting the terms is not the same act as agreeing to cloud storage, and
 * consent that is bundled is not consent.
 */
export type Consent = {
  /** Sync and back up to the account. */
  cloud: boolean;
  /** Send questions, numbers and meal photos to the AI provider. */
  ai: boolean;
  updatedAt: string;
};

export type AppState = {
  profile: Profile;
  habits: Habit[];
  completions: Completion[];
  weighIns: WeighIn[];
  checkIns: CheckIn[];
  /**
   * How far the server had got, in *its* clock, when this device last pulled.
   * The next pull asks for everything after it. Server time, not ours: a
   * device that was offline for a week writes rows stamped a week ago, and a
   * device filtering by its own clock would never see them.
   */
  lastSyncAt?: string;
  /**
   * When this device last pushed, in *its own* clock — the stamps on its rows
   * come from the same clock, so this is the only honest way to ask "what have
   * I changed since?".
   */
  lastPushAt?: string;
  /**
   * The groceries the person keeps around, as they typed them. One free-text
   * blob rather than a parsed list: the kitchen reads the whole thing, the way
   * someone actually writes a shopping list. Device-local for now — it rides
   * through a sync untouched because mergeState carries local fields it does
   * not own, but it is never sent to the server.
   */
  pantry?: string;
  /**
   * The furthest instant in time the app has ever observed, in device-clock
   * milliseconds. "Today" for anything that feeds a streak is read as never
   * before this, so winding the phone's clock back cannot manufacture a fresh
   * day. Device-local; the server holds the real record.
   */
  clockHighWaterMs?: number;
  /**
   * The training plan and its day-by-day log. Device-local like the pantry —
   * it rides through a sync untouched (mergeState keeps local fields) and is
   * never sent to the server.
   */
  training?: Training;
  /** What was eaten each day (YYYY-MM-DD → items), for the daily food log. */
  intake?: Record<string, IntakeItem[]>;
  /** Glasses of water logged each day (YYYY-MM-DD → count). */
  water?: Record<string, number>;
  /** The person's chosen daily water goal, in cups. Undefined = derive from weight. */
  waterGoal?: number;
  /** Tape-measure readings per body part (part id → readings over time). */
  measurements?: Record<string, { date: string; cm: number }[]>;
  /** The single goal that drives the whole app — training, kitchen, cardio and
   * the progress targets all read it, so changing it in one place changes
   * everything. Kept in step with nutritionGoal and training.goal for the
   * screens that still read those. */
  goal?: Goal;
  /** The nutrition goal the kitchen was last set to, so it is remembered
   * across opens and the Today hub can read a calorie target from it. Kept in
   * step with the canonical `goal`. */
  nutritionGoal?: Goal;
  /** Progress photos, newest last. Device-local — the file uris live on the
   * phone and are never uploaded. */
  photos?: ProgressPhoto[];
  /** The kitchen's dietary filter ("all" | "kosher" | "vegetarian"), remembered. */
  dietFilter?: string;
  /** Meal ids the person starred, so a dish they love is one tap away. */
  favorites?: string[];
  /** Steps walked each day (YYYY-MM-DD → count). Device-local. */
  steps?: Record<string, number>;
  /** The daily step target, when the person set one of their own. */
  stepGoal?: number;
  /**
   * A random string minted once on this device. It seeds the kitchen's meal
   * rotation, so two people with the same fridge and the same goal are not
   * handed the same three dishes — the suggestions feel like theirs.
   */
  salt?: string;
  /** Bumped by the shuffle button, to re-roll today's picks on demand. */
  mealShuffle?: number;
  /** Backup bookkeeping (device-local, never itself backed up): a signature of
   * the last backed-up data, when it was last uploaded, and the server stamp
   * this device last adopted. */
  backupSig?: string;
  backupAt?: string;
  backupSeenAt?: string;
  /** Focus mode: the app drains its own colour while someone trains. Holds
   * the moment it was switched on, so a session forgotten overnight does not
   * leave the app grey forever. Device-local; never synced. */
  focusSince?: string;
  /** How hard the daily challenge should be. Chosen in the intro, changed
   * whenever they like; undefined means the intro has not asked yet. */
  challengeLevel?: "easy" | "moderate" | "hard";
  /** Local date → the id of the challenge finished that day. One a day, and
   * the id is kept so the board can say *which* one was done. */
  challengesDone?: Record<string, string>;
  /** The accepted version of the terms and privacy policy, device-local. */
  legal?: LegalAcceptance;
  /** Explicit opt-ins for anything that leaves the device, device-local. */
  consent?: Consent;
  /** Exercise id → the YouTube id resolved for its form demo, so the exact
   * video opens instantly on every tap after the first, and offline too. */
  videoIds?: Record<string, string>;
  /** What the billing server last told us about this account. Written only by
   * a sync; the app never edits it, because an entitlement the phone can set
   * is an entitlement anyone can set. */
  subscription?: {
    status: "none" | "trialing" | "active" | "past_due" | "canceled" | "expired";
    plan?: string;
    currentPeriodEnd?: string;
    trialEndsAt?: string;
  };
  /** date (YYYY-MM-DD) → how many of each metered thing was used that day.
   * Only the days that were used are kept, so it stays small. */
  usage?: Record<string, { coach?: number; mealPhoto?: number }>;
};

export const EMPTY_STATE: AppState = {
  // Stamped at the epoch rather than left blank: an undefined timestamp reads
  // as "newer than anything", which would make a fresh install's blank profile
  // outrank the real one waiting on the server.
  profile: { name: "", onboarded: false, updatedAt: "1970-01-01T00:00:00.000Z" },
  habits: [],
  completions: [],
  weighIns: [],
  checkIns: [],
};

/** Local calendar date as YYYY-MM-DD — never UTC, or a 22:00 tick lands on tomorrow. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function now(): string {
  return new Date().toISOString();
}

/**
 * Brings a stored state up to the current shape. Data written by an earlier
 * build has completions with no `done` (their presence meant done) and rows
 * with no timestamp; without this they would be dropped or, worse, treated as
 * newer than everything on the server.
 */
export function migrateState(raw: unknown): AppState {
  if (typeof raw !== "object" || raw === null) return EMPTY_STATE;
  const s = raw as Partial<AppState> & { completions?: unknown[] };
  const EPOCH = "1970-01-01T00:00:00.000Z";

  return {
    // Untimed rows are stamped at the epoch rather than left blank: an
    // undefined timestamp reads as "newer than anything", so it would both
    // beat a real edit from another device and re-upload on every sync.
    profile: {
      ...EMPTY_STATE.profile,
      ...(s.profile ?? {}),
      updatedAt: s.profile?.updatedAt ?? EPOCH,
    },
    habits: (s.habits ?? []).map((h) => ({ ...h, updatedAt: h.updatedAt ?? EPOCH })),
    completions: (s.completions ?? []).map((c) => {
      const row = c as Partial<Completion>;
      return {
        habitId: String(row.habitId ?? ""),
        date: String(row.date ?? ""),
        // A row written by the old build existed only when it was done.
        done: row.done ?? true,
        updatedAt: row.updatedAt ?? EPOCH,
      };
    }).filter((c) => c.habitId && c.date),
    weighIns: (s.weighIns ?? []).map((w) => ({ ...w, updatedAt: w.updatedAt ?? EPOCH })),
    checkIns: (s.checkIns ?? []).map((c) => ({ ...c, updatedAt: c.updatedAt ?? EPOCH })),
    lastSyncAt: s.lastSyncAt,
    lastPushAt: s.lastPushAt,
    pantry: s.pantry,
    clockHighWaterMs: s.clockHighWaterMs,
    training: s.training,
    intake: s.intake,
    water: s.water,
    waterGoal: s.waterGoal,
    measurements: s.measurements,
    // The canonical goal: prefer an explicit one, else adopt whatever the
    // kitchen or the plan was last set to, so an upgrade doesn't reset it.
    goal: s.goal ?? s.nutritionGoal ?? s.training?.goal,
    nutritionGoal: s.nutritionGoal ?? s.goal,
    photos: s.photos,
    dietFilter: s.dietFilter,
    favorites: s.favorites,
    videoIds: s.videoIds,
    subscription: s.subscription,
    usage: s.usage,
    steps: s.steps,
    stepGoal: s.stepGoal,
    salt: s.salt,
    mealShuffle: s.mealShuffle,
    backupSig: s.backupSig,
    backupAt: s.backupAt,
    backupSeenAt: s.backupSeenAt,
    // A build that predates the consent gate has no record, which reads as
    // "not accepted" and "nothing allowed" — the gate then asks, which is the
    // correct behaviour for an upgrade, not a bug.
    legal: s.legal,
    consent: s.consent,
    focusSince: s.focusSince,
    challengeLevel: s.challengeLevel,
    challengesDone: s.challengesDone,
  };
}
