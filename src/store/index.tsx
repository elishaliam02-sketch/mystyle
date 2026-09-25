import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState as RNAppState } from "react-native";
import { PAYMENTS_LIVE } from "@/billing/launch";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_STATE,
  migrateState,
  newId,
  now,
  today,
  type AppState,
  type CheckIn,
  type Consent,
  type Habit,
  type IntakeItem,
  type Profile,
  type Training,
  type WeighIn,
  type Wish,
} from "./types";
import { isStorableWeight } from "./weight";
import { acceptanceCurrent, LEGAL, publishAiConsent, publishPhotoConsent } from "@/legal";
import { challengeFor, type Challenge } from "@/challenge";
import { FOCUS_MAX_MS } from "@/focus";
import type { Difficulty } from "@/tasks/difficulty";
import { isStorableCm, type Reading } from "@/body";
import { isStorableKg, type Lift } from "@/workout/lifts";
import { blankSets, previousSets, type SetEntry } from "@/workout/sets";
import { demoLink } from "@/workout/video";
import { entitlement as entitlementOf, trialEndsAt, TRIAL_DAYS, type Entitlement } from "@/billing/plans";
import { check, type Feature, type Verdict } from "@/billing/gate";
import { isHeightCm, isStorableGoal } from "@/health";
import {
  clampSteps,
  DEFAULT_STEP_GOAL,
  isStorableGoal as isStorableStepGoal,
} from "@/health/steps";
import { cupMlOf, defaultGoalMl, goalMlOf, isStorableCupMl, isStorableGoalMl, MAX_DAY_ML, waterMlLog } from "@/health/water";
import { advanceHighWater, toLocalDate, trustedNowMs } from "@/time/clock";
import type { Goal } from "@/kitchen";
import type { Exercise, Muscle } from "@/workout/exercises";
import { buildPlan, freshSeed } from "@/workout/plan";

/**
 * "Today" that a rewound phone clock cannot fake, together with the advanced
 * high-water mark to store alongside it. Anything that feeds a streak stamps
 * itself through here, so the date is never earlier than the furthest instant
 * the app has already seen.
 */
function trustedStamp(s: AppState): { date: string; highWater: number } {
  const nowMs = Date.now();
  const eff = trustedNowMs(nowMs, s.clockHighWaterMs ?? 0);
  return { date: toLocalDate(eff), highWater: advanceHighWater(s.clockHighWaterMs ?? 0, nowMs) };
}

const STORAGE_KEY = "mystyle.state.v1";

type Store = {
  state: AppState;
  ready: boolean;
  saveProfile: (patch: Partial<Profile>) => void;
  addHabit: (title: string, slot?: Habit["slot"]) => string | null;
  archiveHabit: (id: string) => void;
  updateHabit: (id: string, patch: Partial<Pick<Habit, "title" | "slot" | "anchor">>) => void;
  /** Consecutive days completed, counting back from today (or yesterday). */
  streak: (habitId: string) => number;
  toggleCompletion: (habitId: string) => void;
  isDone: (habitId: string, date?: string) => boolean;
  addWeighIn: (kg: number) => void;
  /** Corrects the reading of one day. */
  editWeighIn: (date: string, kg: number) => void;
  /** Deletes the reading of one day (a typo), for good — a sync keeps it gone. */
  removeWeighIn: (date: string) => void;
  addCheckIn: (entry: Omit<CheckIn, "date" | "updatedAt">) => void;
  /** Completions of active habits over the last 7 days, as a 0–1 ratio. */
  weeklyConsistency: () => number;
  /** True once the current habits are holding — the only moment we suggest adding one. */
  readyForAnotherHabit: () => boolean;
  /** The groceries the person keeps, as free text. */
  setPantry: (text: string) => void;
  /** The one goal the whole app follows (training, kitchen, cardio, targets). */
  goal: () => Goal;
  /** Sets the unified goal — mirrors to the kitchen and re-rolls the plan. */
  setGoal: (goal: Goal) => void;
  /** Remembers the kitchen's nutrition goal across opens (alias of setGoal). */
  setNutritionGoal: (goal: Goal) => void;
  /** Remembers the kitchen's dietary filter across opens. */
  setDietFilter: (diet: string) => void;
  /** Stars or unstars a meal. */
  toggleFavorite: (mealId: string) => void;
  /** True when the meal is starred. */
  isFavorite: (mealId: string) => boolean;
  /** Logs a meal against today's food diary. */
  logMeal: (label: string, kcal: number, protein: number) => void;
  /** Removes one logged item from today. */
  removeMeal: (id: string) => void;
  /** Foods the person said they want to eat, newest first. */
  wishes: () => Wish[];
  /** Remembers something they want to eat. Returns false if it was already there. */
  addWish: (text: string) => boolean;
  /** Forgets one. */
  removeWish: (id: string) => void;
  /** Today's food log and its running totals. */
  todayIntake: () => { items: IntakeItem[]; kcal: number; protein: number };
  /** Today, as the clock-safe date key the diary and logs are written under. */
  todayKey: () => string;
  /** The clock-safe date key n days back — what the logs were written under. */
  dayKeyAgo: (n: number) => string;
  /** Adds (or, with a negative delta, removes) glasses of the chosen size today. */
  addWater: (deltaCups: number) => void;
  /** Millilitres of water logged today. */
  todayWater: () => number;
  /** The daily water goal in ml — the person's own, or derived from weight. */
  waterGoal: () => number;
  setWaterGoal: (ml: number) => void;
  /** Water per day in ml, every day there is. */
  waterLog: () => Record<string, number>;
  /** The size of one cup in ml. */
  cupMl: () => number;
  setCupMl: (ml: number) => void;
  /** Records a tape-measure reading for a body part (today). */
  addMeasurement: (part: string, cm: number) => void;
  /** All readings for a body part, oldest first. */
  measurementSeries: (part: string) => Reading[];
  /** Sets the person's sex, for the body-fat estimate. */
  setSex: (sex: "male" | "female") => void;
  /** Adds a progress photo with the day's numbers frozen beside it. */
  addPhoto: (uri: string, kg?: number, bf?: number) => void;
  /** Removes a progress photo. */
  removePhoto: (id: string) => void;
  /** Sets up (or re-tunes) the training plan for a goal, weekly frequency,
   * session length and available equipment. */
  configureTraining: (
    goal: Goal,
    days: number,
    minutes?: number,
    equipment?: string,
    focus?: string[],
    mode?: "auto" | "custom",
    level?: "beginner" | "intermediate" | "advanced",
  ) => void;
  /** Re-rolls the plan's exact exercises (new planSeed), same goal and split. */
  regeneratePlan: () => void;
  /** Switches between the generated plan and the self-built one. Non-destructive:
   * the generated days and the person's own picks both survive the switch. */
  setTrainingMode: (mode: "auto" | "custom") => void;
  /** Permanently adds an exercise to a specific plan day (Hevy-style). */
  addToDay: (dayIndex: number, exerciseId: string) => void;
  /** Permanently removes an exercise from a specific plan day. */
  removeFromDay: (dayIndex: number, exerciseId: string) => void;
  /** The hand-made add/remove edits for a plan day. */
  dayEdits: (dayIndex: number) => { add?: string[]; remove?: string[] };
  /** The seed a generated plan should roll its exercises from: the plan's own
   * saved seed, else the device salt — so it is this person's plan. */
  planSeed: () => string;
  /** Ticks or unticks an exercise as done for the clock-safe today. */
  toggleExerciseDone: (id: string) => void;
  /** True if that exercise is ticked done today. */
  isExerciseDone: (id: string) => boolean;
  /** Adds the person's own move to the library, kept device-local. */
  addCustomExercise: (ex: Omit<Exercise, "custom">) => void;
  /** Ticks every exercise of a session done in one go. */
  completeSession: (ids: string[]) => void;
  /** Today's sets for an exercise, seeded from the prescribed count. */
  setsFor: (exerciseId: string, prescribed: number) => SetEntry[];
  /** Writes one field of one set. */
  updateSet: (exerciseId: string, index: number, patch: Partial<SetEntry>, prescribed: number) => void;
  /** Appends an extra set to today's exercise. */
  addSet: (exerciseId: string, prescribed: number) => void;
  /** Drops the last set of today's exercise. */
  removeSet: (exerciseId: string) => void;
  /** What this exercise looked like the previous time it was trained. */
  lastSession: (exerciseId: string) => SetEntry[] | null;
  /** Adds a library exercise to today's session. */
  /** What this account is entitled to right now, judged against the trusted
   * clock rather than the device's. */
  entitlement: () => Entitlement;
  /** Whether one more of a metered thing is allowed, and how many are left. */
  allowance: (feature: Feature) => Verdict;
  /** Records that one was used. Only the metered-per-day features count. */
  noteUsed: (feature: Feature) => void;
  /** What the billing server said, stored verbatim. */
  setSubscription: (sub: AppState["subscription"]) => void;
  addExerciseToday: (exerciseId: string) => void;
  /** Takes one back off today's session — a mis-tap in the library should not
   * need a trip to another tab to undo. */
  removeExerciseToday: (exerciseId: string) => void;
  /** Exercise ids added to today on top of the plan. */
  todayExtras: () => string[];
  /** The URL to open for an exercise's form demo: the exact video when it can
   * be resolved, the search page when it cannot. Remembers what it resolves. */
  demoFor: (ex: Exercise) => Promise<string>;
  /** The seed behind the kitchen's meal rotation: this device, this day, and
   * however many times the person has asked for another set. */
  mealSeed: () => string;
  /** Re-rolls today's suggestions. */
  shuffleMeals: () => void;
  /** Sets today's step count outright (from the phone's own counter). */
  setSteps: (n: number) => void;
  /** Adds to today's step count — the +1000 buttons. */
  addSteps: (n: number) => void;
  /** Steps logged today. */
  todaySteps: () => number;
  /** The daily step target, the person's own or the default. */
  stepGoal: () => number;
  setStepGoal: (n: number) => void;
  /** Records the weight lifted on an exercise today. */
  logExerciseWeight: (id: string, kg: number) => void;
  /** Every weight logged for an exercise, oldest first. */
  exerciseLifts: (id: string) => Lift[];
  /** Advances the clock guard from a trusted server timestamp. */
  noteServerTime: (iso: string) => void;
  /** Whether focus mode is on right now. */
  focusOn: () => boolean;
  /** Turns the app's colour off, or back on. */
  toggleFocus: () => void;
  /** Today's challenge, at the level this person chose. Null until the intro
   * has asked, so a screen can offer the choice rather than guess. */
  todayChallenge: () => Challenge | null;
  /** The level itself, for the settings screen. */
  challengeLevel: () => Difficulty | null;
  setChallengeLevel: (level: Difficulty) => void;
  /** Whether today's challenge is already done, and the toggle for it. */
  isChallengeDone: (date?: string) => boolean;
  toggleChallenge: () => void;
  /** Records acceptance of the current terms and privacy policy. */
  acceptLegal: () => void;
  /** Whether the accepted documents are still the current ones. */
  legalCurrent: () => boolean;
  /** The two opt-ins, with "off" as the answer when nothing was ever chosen. */
  consent: () => Consent;
  /** Turns one of them on or off, stamping when it changed. */
  setConsent: (patch: Partial<Pick<Consent, "cloud" | "ai" | "photos">>) => void;
  reset: () => void;
  /** Adopts a merged state wholesale — used after a cloud sync. */
  replaceAll: (next: AppState) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        // Anything written by an earlier build is brought up to the current
        // shape here, so no screen has to cope with a row missing a field.
        if (raw) setState(migrateState(JSON.parse(raw)));
        // Every device gets its own salt on first load, so the kitchen's
        // rotation differs between two people with identical fridges.
        setState((s) => (s.salt ? s : { ...s, salt: newId() }));
      } catch {
        // Unreadable or corrupt storage: start clean rather than crash on launch.
      }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  // Persist after every change, but never before the first read has finished —
  // that would write the empty state over real data.
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  /** The most recent weigh-in by date, for judging a goal against reality. */
  function latestWeighIn(s: AppState): WeighIn | null {
    if (s.weighIns.length === 0) return null;
    return [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date))[s.weighIns.length - 1]!;
  }

  /**
   * The last line of defence on the profile's numbers.
   *
   * The screens check too, and say something useful when they refuse — but the
   * check lives here as well, because a screen can be forgotten, deep-linked
   * past, or added later. A goal weight below the healthy floor for this
   * person's height is dropped from the patch rather than stored: everything
   * else in the patch still saves, so a bad goal never costs someone their
   * name or their height.
   */
  const saveProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => {
      const next = { ...s.profile, ...patch };
      if (next.heightCm !== undefined && !isHeightCm(next.heightCm)) {
        next.heightCm = s.profile.heightCm;
      }
      if (next.goalKg !== undefined) {
        const currentKg = latestWeighIn(s)?.kg ?? s.profile.startKg;
        if (!isStorableGoal(next.goalKg, currentKg, next.heightCm)) {
          next.goalKg = s.profile.goalKg;
        }
      }
      // Finishing onboarding starts the trial, here on the device and without
      // a card. Someone who has just written their first habit has seen none
      // of what they would be paying for, and meeting a limit in the first
      // minute is how an app gets deleted in the second. The server overwrites
      // this the moment it has anything truer to say; the worst it can be
      // abused for is another week by reinstalling, which is a far smaller
      // cost than a wall across a new user's first session.
      const startsTrial = !s.subscription && !s.profile.onboarded && next.onboarded;
      // A clock so broken that seven days from now cannot be computed gets no
      // trial rather than an endless one.
      const ends = startsTrial ? trialEndsAt(new Date().toISOString(), TRIAL_DAYS) : null;
      const subscription: AppState["subscription"] =
        ends === null ? s.subscription : { status: "trialing", trialEndsAt: ends };
      return { ...s, subscription, profile: { ...next, updatedAt: now() } };
    });
  }, []);

  const addHabit = useCallback((title: string, slot?: Habit["slot"]) => {
    const clean = title.trim();
    if (!clean) return null;
    const id = newId();
    setState((s) => ({
      ...s,
      habits: [
        ...s.habits,
        {
          id,
          title: clean,
          slot,
          createdAt: today(),
          archived: false,
          updatedAt: now(),
        },
      ],
    }));
    return id;
  }, []);

  const archiveHabit = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, archived: true, updatedAt: now() } : h,
      ),
    }));
  }, []);

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, "title" | "slot" | "anchor">>) => {
      setState((s) => ({
        ...s,
        habits: s.habits.map((h) =>
          h.id === id ? { ...h, ...patch, updatedAt: now() } : h,
        ),
      }));
    },
    [],
  );

  // Unticking rewrites the row as `done: false` instead of deleting it. A
  // deleted row is indistinguishable from one this device never had, so the
  // server's copy used to bring the tick straight back on the next sync.
  const toggleCompletion = useCallback((habitId: string) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      const current = s.completions.find((c) => c.habitId === habitId && c.date === date);
      const row = { habitId, date, done: !current?.done, updatedAt: now() };
      return {
        ...s,
        clockHighWaterMs: highWater,
        completions: [
          ...s.completions.filter((c) => !(c.habitId === habitId && c.date === date)),
          row,
        ],
      };
    });
  }, []);

  // The calendar day, re-read at local midnight and whenever the app comes
  // back to the front: without it an app left open overnight kept showing
  // (and undoing into) yesterday's water, food and habits.
  const [dayKey, setDayKey] = useState(() => toLocalDate(Date.now()));
  useEffect(() => {
    const refresh = () => setDayKey(toLocalDate(Date.now()));
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    const timer = setTimeout(refresh, Math.max(1000, midnight.getTime() - now.getTime()));
    const sub = RNAppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [dayKey]);

  const trustedToday = useCallback(
    () => toLocalDate(trustedNowMs(Date.now(), state.clockHighWaterMs ?? 0)),
    // dayKey is not read here, but a new day must hand out a new function so
    // every screen that asked "what is today" asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.clockHighWaterMs, dayKey],
  );

  // The same anchor, n calendar days back — so streak windows count from the
  // clock-safe today, not from whatever the device says.
  const trustedDaysAgo = useCallback(
    (n: number) => {
      const d = new Date(trustedNowMs(Date.now(), state.clockHighWaterMs ?? 0));
      d.setDate(d.getDate() - n);
      const pad = (x: number) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.clockHighWaterMs, dayKey],
  );

  const isDone = useCallback(
    (habitId: string, date?: string) => {
      const d = date ?? trustedToday();
      return state.completions.some((c) => c.habitId === habitId && c.date === d && c.done);
    },
    [state.completions, trustedToday],
  );

  const addWeighIn = useCallback((kg: number) => {
    // The store is the last gate: a value outside the human range never lands,
    // whatever a screen or a future caller passes.
    if (!isStorableWeight(kg)) return;
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      return {
        ...s,
        clockHighWaterMs: highWater,
        weighIns: [
          ...s.weighIns.filter((w) => w.date !== date),
          { date, kg, updatedAt: now() },
        ].sort((a, b) => a.date.localeCompare(b.date)),
        profile: s.profile.startKg ? s.profile : { ...s.profile, startKg: kg },
      };
    });
  }, []);

  const editWeighIn = useCallback((date: string, kg: number) => {
    if (!isStorableWeight(kg)) return;
    setState((s) => {
      if (!s.weighIns.some((w) => w.date === date)) return s;
      return {
        ...s,
        weighIns: s.weighIns.map((w) => (w.date === date ? { ...w, kg, updatedAt: now() } : w)),
      };
    });
  }, []);

  const removeWeighIn = useCallback((date: string) => {
    setState((s) => ({
      ...s,
      weighIns: s.weighIns.filter((w) => w.date !== date),
      weighInsRemoved: { ...s.weighInsRemoved, [date]: now() },
    }));
  }, []);

  const addCheckIn = useCallback((entry: Omit<CheckIn, "date" | "updatedAt">) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      return {
      ...s,
      clockHighWaterMs: highWater,
      checkIns: [
        ...s.checkIns.filter((c) => c.date !== date),
        { ...entry, date, updatedAt: now() },
      ],
      };
    });
  }, []);

  const streak = useCallback(
    (habitId: string) => {
      const done = new Set(
        state.completions
          .filter((c) => c.habitId === habitId && c.done)
          .map((c) => c.date),
      );
      // Today not being ticked yet shouldn't read as a broken streak at 09:00,
      // so an unticked today is skipped rather than counted as a miss.
      let offset = done.has(trustedDaysAgo(0)) ? 0 : 1;
      let count = 0;
      while (done.has(trustedDaysAgo(offset))) {
        count += 1;
        offset += 1;
      }
      return count;
    },
    [state.completions, trustedDaysAgo],
  );

  const weeklyConsistency = useCallback(() => {
    const active = state.habits.filter((h) => !h.archived);
    if (active.length === 0) return 0;

    const window = Array.from({ length: 7 }, (_, i) => trustedDaysAgo(i));
    // Only count days a habit already existed, so a habit added yesterday
    // is not scored against the six days before it was created.
    let possible = 0;
    let done = 0;
    for (const habit of active) {
      for (const date of window) {
        if (date < habit.createdAt) continue;
        possible += 1;
        if (state.completions.some((c) => c.habitId === habit.id && c.date === date && c.done)) {
          done += 1;
        }
      }
    }
    return possible === 0 ? 0 : done / possible;
  }, [state.habits, state.completions, trustedDaysAgo]);

  const readyForAnotherHabit = useCallback(() => {
    const active = state.habits.filter((h) => !h.archived);
    if (active.length === 0) return true;
    // A habit needs to have been around long enough to have a track record.
    const anchor = trustedToday();
    const oldest = active.reduce((a, h) => (h.createdAt < a ? h.createdAt : a), anchor);
    const ageInDays = Math.round((Date.parse(anchor) - Date.parse(oldest)) / 86_400_000);
    return ageInDays >= 4 && weeklyConsistency() >= 0.6;
  }, [state.habits, weeklyConsistency, trustedToday]);

  const setPantry = useCallback((text: string) => {
    setState((s) => ({ ...s, pantry: text }));
  }, []);

  // The one goal the whole app follows. Setting it mirrors into the kitchen's
  // nutritionGoal and the training plan's goal (re-rolling its exercises so the
  // plan visibly changes), so changing the goal anywhere changes everything.
  const setGoal = useCallback((goal: Goal) => {
    setState((s) => ({
      ...s,
      goal,
      nutritionGoal: goal,
      training: s.training
        ? { ...s.training, goal, planSeed: newId() }
        : s.training,
    }));
  }, []);

  const goal = useCallback(
    (): Goal => state.goal ?? state.nutritionGoal ?? state.training?.goal ?? "recomp",
    [state.goal, state.nutritionGoal, state.training],
  );

  // Kept for the kitchen's own goal chips; routes through the unified setter so
  // the plan and the rest of the app follow along.
  const setNutritionGoal = setGoal;

  const setDietFilter = useCallback((diet: string) => {
    setState((s) => ({ ...s, dietFilter: diet }));
  }, []);

  const toggleFavorite = useCallback((mealId: string) => {
    setState((s) => {
      const list = s.favorites ?? [];
      return {
        ...s,
        favorites: list.includes(mealId) ? list.filter((m) => m !== mealId) : [...list, mealId],
      };
    });
  }, []);

  const isFavorite = useCallback(
    (mealId: string) => (state.favorites ?? []).includes(mealId),
    [state.favorites],
  );

  const logMeal = useCallback((label: string, kcal: number, protein: number) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      const item: IntakeItem = { id: newId(), label, kcal, protein };
      const day = s.intake?.[date] ?? [];
      return {
        ...s,
        clockHighWaterMs: highWater,
        intake: { ...s.intake, [date]: [...day, item] },
      };
    });
  }, []);

  const removeMeal = useCallback((id: string) => {
    setState((s) => {
      const date = toLocalDate(trustedNowMs(Date.now(), s.clockHighWaterMs ?? 0));
      const day = (s.intake?.[date] ?? []).filter((i) => i.id !== id);
      return { ...s, intake: { ...s.intake, [date]: day } };
    });
  }, []);

  const wishes = useCallback(() => state.wishlist ?? [], [state.wishlist]);

  const addWish = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return false;
    let added = false;
    setState((s) => {
      const list = s.wishlist ?? [];
      // The same craving twice is one craving. Compared case-insensitively,
      // because "Pizza" and "pizza" are not two different questions.
      if (list.some((w) => w.text.toLowerCase() === clean.toLowerCase())) return s;
      added = true;
      return { ...s, wishlist: [{ id: newId(), text: clean, addedAt: now() }, ...list].slice(0, 40) };
    });
    return added;
  }, []);

  const removeWish = useCallback((id: string) => {
    setState((s) => ({ ...s, wishlist: (s.wishlist ?? []).filter((w) => w.id !== id) }));
  }, []);

  const todayIntake = useCallback(() => {
    const d = trustedToday();
    const items = state.intake?.[d] ?? [];
    return {
      items,
      kcal: items.reduce((n, i) => n + i.kcal, 0),
      protein: items.reduce((n, i) => n + i.protein, 0),
    };
  }, [state.intake, trustedToday]);

  const addWater = useCallback((deltaCups: number) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      const log = waterMlLog(s);
      const next = Math.max(0, Math.min(MAX_DAY_ML, (log[date] ?? 0) + deltaCups * cupMlOf(s.cupMl)));
      return {
        ...s,
        clockHighWaterMs: highWater,
        waterMl: { ...s.waterMl, [date]: next },
      };
    });
  }, []);

  const waterLog = useCallback(() => waterMlLog(state), [state.water, state.waterMl, state.cupMl]);

  const waterGoal = useCallback(() => {
    const own = goalMlOf(state);
    if (own !== null) return own;
    const kg =
      [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ??
      state.profile.startKg;
    return defaultGoalMl(kg);
  }, [state.waterGoal, state.waterGoalMl, state.cupMl, state.weighIns, state.profile.startKg]);

  const cupMl = useCallback(() => cupMlOf(state.cupMl), [state.cupMl]);
  const setCupMl = useCallback((ml: number) => {
    if (!isStorableCupMl(ml)) return;
    setState((s) => ({ ...s, cupMl: Math.round(ml) }));
  }, []);

  const setWaterGoal = useCallback((ml: number) => {
    if (!isStorableGoalMl(ml)) return;
    setState((s) => ({ ...s, waterGoalMl: Math.round(ml), waterGoal: undefined }));
  }, []);

  const todayWater = useCallback(
    () => waterMlLog(state)[trustedToday()] ?? 0,
    [state.water, state.waterMl, state.cupMl, trustedToday],
  );

  const addMeasurement = useCallback((part: string, cm: number) => {
    if (!isStorableCm(cm, part)) return;
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      const prior = (s.measurements?.[part] ?? []).filter((r) => r.date !== date);
      const next = [...prior, { date, cm }].sort((a, b) => a.date.localeCompare(b.date));
      return {
        ...s,
        clockHighWaterMs: highWater,
        measurements: { ...s.measurements, [part]: next },
      };
    });
  }, []);

  const measurementSeries = useCallback(
    (part: string) => state.measurements?.[part] ?? [],
    [state.measurements],
  );

  const configureTraining = useCallback(
    (
      goal: Goal,
      days: number,
      minutes?: number,
      equipment?: string,
      focus?: string[],
      mode: "auto" | "custom" = "auto",
      level?: "beginner" | "intermediate" | "advanced",
    ) => {
      setState((s) => {
        // Changing how many days the plan spans reshuffles the day indices, so
        // hand-made per-day edits from the old split no longer line up — clear
        // them. Keep them through a same-frequency re-tune so the person's own
        // picks survive a goal or equipment change.
        const daysChanged = s.training ? s.training.days !== days : false;
        return {
          ...s,
          // The plan's goal is the app's goal — keep them in step.
          goal,
          nutritionGoal: goal,
          training: {
            goal,
            days,
            minutes,
            equipment,
            focus,
            mode,
            level: level ?? s.training?.level,
            // A fresh configure rolls a fresh plan seed unless one exists, so the
            // exercises are stable across opens but this person's, not everyone's.
            planSeed: s.training?.planSeed ?? s.salt ?? newId(),
            planEdits: daysChanged ? {} : s.training?.planEdits,
            // Keep the log, lifted weights and the person's own moves through a re-tune.
            log: s.training?.log ?? {},
            custom: s.training?.custom ?? [],
            weights: s.training?.weights ?? {},
            setLog: s.training?.setLog,
            extra: s.training?.extra,
          },
        };
      });
    },
    [],
  );

  const regeneratePlan = useCallback(() => {
    setState((s) => {
      const t = s.training;
      if (!t) return s;
      // A new seed whose plan actually differs from the one on screen.
      // A plan from before levels existed moves to the level-shaped builder the
      // moment the person asks for a new one — they asked for a change anyway.
      const level = t.level ?? "intermediate";
      const make = (seed: string, lv = level as typeof t.level) =>
        buildPlan(t.goal, t.days, t.minutes, t.equipment, {
          seed,
          focus: (t.focus ?? []) as Muscle[],
          level: lv,
        });
      const current = make(t.planSeed ?? s.salt ?? "", t.level);
      const planSeed = freshSeed(current, (seed) => make(seed), Array.from({ length: 12 }, () => newId()));
      return { ...s, training: { ...t, planSeed, level } };
    });
  }, []);

  // Hevy-style per-day editing: add a library/own move to a specific plan day,
  // or remove one, and it sticks — a re-roll keeps these picks. Removing a
  // generated move records it in `remove`; adding records it in `add`. Adding
  // back something you removed just cancels the removal, and vice versa.
  const addToDay = useCallback((dayIndex: number, exerciseId: string) => {
    setState((s) => {
      if (!s.training) return s;
      const edits = { ...(s.training.planEdits ?? {}) };
      const cur = edits[dayIndex] ?? {};
      const remove = (cur.remove ?? []).filter((id) => id !== exerciseId);
      const add = cur.add?.includes(exerciseId) ? cur.add : [...(cur.add ?? []), exerciseId];
      edits[dayIndex] = { add, remove };
      return { ...s, training: { ...s.training, planEdits: edits } };
    });
  }, []);

  const removeFromDay = useCallback((dayIndex: number, exerciseId: string) => {
    setState((s) => {
      if (!s.training) return s;
      const edits = { ...(s.training.planEdits ?? {}) };
      const cur = edits[dayIndex] ?? {};
      const add = (cur.add ?? []).filter((id) => id !== exerciseId);
      const remove = cur.remove?.includes(exerciseId)
        ? cur.remove
        : [...(cur.remove ?? []), exerciseId];
      edits[dayIndex] = { add, remove };
      return { ...s, training: { ...s.training, planEdits: edits } };
    });
  }, []);

  const dayEdits = useCallback(
    (dayIndex: number) => state.training?.planEdits?.[dayIndex] ?? { add: [], remove: [] },
    [state.training],
  );

  // Sex, for the body-fat estimate. Guarded to the two values the formula knows.
  const setSex = useCallback((sex: "male" | "female") => {
    setState((s) => ({ ...s, profile: { ...s.profile, sex, updatedAt: now() } }));
  }, []);

  // A progress photo, with the day's numbers frozen beside it. Device-local: the
  // uri stays on the phone and never rides a sync.
  const addPhoto = useCallback((uri: string, kg?: number, bf?: number) => {
    if (!uri) return;
    setState((s) => {
      const { date } = trustedStamp(s);
      const photo = { id: newId(), uri, date, kg, bf };
      return { ...s, photos: [...(s.photos ?? []), photo] };
    });
  }, []);

  const removePhoto = useCallback((id: string) => {
    setState((s) => ({ ...s, photos: (s.photos ?? []).filter((p) => p.id !== id) }));
  }, []);

  // Switching how the plan is built never throws anything away: the generated
  // sessions are recomputed from the seed and the person's per-day edits are
  // kept, so flipping back and forth returns exactly what was there before.
  const setTrainingMode = useCallback((mode: "auto" | "custom") => {
    setState((s) => (s.training ? { ...s, training: { ...s.training, mode } } : s));
  }, []);

  const planSeed = useCallback(
    () => state.training?.planSeed ?? state.salt ?? "",
    [state.training, state.salt],
  );

  // Ticking a workout done feeds a streak, so it stamps through the clock guard
  // for the same reason a habit does — a rewound phone can't manufacture a day.
  const toggleExerciseDone = useCallback((id: string) => {
    setState((s) => {
      if (!s.training) return s;
      const { date, highWater } = trustedStamp(s);
      const doneToday = s.training.log[date] ?? [];
      const next = doneToday.includes(id)
        ? doneToday.filter((x) => x !== id)
        : [...doneToday, id];
      return {
        ...s,
        clockHighWaterMs: highWater,
        training: { ...s.training, log: { ...s.training.log, [date]: next } },
      };
    });
  }, []);

  const isExerciseDone = useCallback(
    (id: string) => {
      const d = trustedToday();
      return (state.training?.log[d] ?? []).includes(id);
    },
    [state.training, trustedToday],
  );

  const addCustomExercise = useCallback((ex: Omit<Exercise, "custom">) => {
    setState((s) => {
      const base: Training = s.training ?? { goal: "maintain", days: 3, log: {}, custom: [] };
      // Skip a duplicate id so re-adding the same move is a no-op.
      if (base.custom.some((c) => c.id === ex.id)) return s;
      return { ...s, training: { ...base, custom: [...base.custom, { ...ex, custom: true }] } };
    });
  }, []);

  const logExerciseWeight = useCallback((id: string, kg: number) => {
    if (!isStorableKg(kg)) return;
    setState((s) => {
      const base: Training = s.training ?? { goal: "maintain", days: 3, log: {}, custom: [] };
      const { date, highWater } = trustedStamp(s);
      const prior = (base.weights?.[id] ?? []).filter((l) => l.date !== date);
      const next = [...prior, { date, kg }].sort((a, b) => a.date.localeCompare(b.date));
      return {
        ...s,
        clockHighWaterMs: highWater,
        training: { ...base, weights: { ...base.weights, [id]: next } },
      };
    });
  }, []);

  // One state write for a whole session: ticking six exercises one by one
  // would queue six renders and six storage writes.
  const completeSession = useCallback((ids: string[]) => {
    setState((s) => {
      if (!s.training || ids.length === 0) return s;
      const { date, highWater } = trustedStamp(s);
      const doneToday = s.training.log[date] ?? [];
      const merged = [...new Set([...doneToday, ...ids])];
      return {
        ...s,
        clockHighWaterMs: highWater,
        training: { ...s.training, log: { ...s.training.log, [date]: merged } },
      };
    });
  }, []);

  // --- set-by-set logging -------------------------------------------------
  const setsFor = useCallback(
    (exerciseId: string, prescribed: number) => {
      const d = trustedToday();
      const stored = state.training?.setLog?.[d]?.[exerciseId];
      return stored && stored.length > 0 ? stored : blankSets(prescribed);
    },
    [state.training, trustedToday],
  );

  /** Every set write funnels through here so today's rows are created once. */
  const writeSets = useCallback(
    (exerciseId: string, prescribed: number, edit: (rows: SetEntry[]) => SetEntry[]) => {
      setState((s) => {
        const base: Training = s.training ?? { goal: "maintain", days: 3, log: {}, custom: [] };
        const { date, highWater } = trustedStamp(s);
        const day = base.setLog?.[date] ?? {};
        const current = day[exerciseId]?.length ? day[exerciseId] : blankSets(prescribed);
        const next = edit(current);
        // Ticking a set also marks the exercise done for the day, so the
        // session counters and the streak stay in step with the set table.
        const anyDone = next.some((r) => r.done);
        const doneToday = base.log[date] ?? [];
        const log = {
          ...base.log,
          [date]: anyDone
            ? [...new Set([...doneToday, exerciseId])]
            : doneToday.filter((x) => x !== exerciseId),
        };
        return {
          ...s,
          clockHighWaterMs: highWater,
          training: { ...base, log, setLog: { ...base.setLog, [date]: { ...day, [exerciseId]: next } } },
        };
      });
    },
    [],
  );

  const updateSet = useCallback(
    (exerciseId: string, index: number, patch: Partial<SetEntry>, prescribed: number) => {
      writeSets(exerciseId, prescribed, (rows) =>
        rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
      );
    },
    [writeSets],
  );

  const addSet = useCallback(
    (exerciseId: string, prescribed: number) => {
      writeSets(exerciseId, prescribed, (rows) =>
        rows.length >= 12 ? rows : [...rows, { kg: 0, reps: 0, done: false }],
      );
    },
    [writeSets],
  );

  const removeSet = useCallback(
    (exerciseId: string) => {
      writeSets(exerciseId, 1, (rows) => (rows.length <= 1 ? rows : rows.slice(0, -1)));
    },
    [writeSets],
  );

  const lastSession = useCallback(
    (exerciseId: string) => previousSets(state.training?.setLog ?? {}, exerciseId, trustedToday()),
    [state.training, trustedToday],
  );

  const addExerciseToday = useCallback((exerciseId: string) => {
    setState((s) => {
      const base: Training = s.training ?? { goal: "maintain", days: 3, log: {}, custom: [] };
      const { date, highWater } = trustedStamp(s);
      const day = base.extra?.[date] ?? [];
      if (day.includes(exerciseId)) return s;
      return {
        ...s,
        clockHighWaterMs: highWater,
        training: { ...base, extra: { ...base.extra, [date]: [...day, exerciseId] } },
      };
    });
  }, []);

  const removeExerciseToday = useCallback((exerciseId: string) => {
    setState((s) => {
      const base = s.training;
      if (!base) return s;
      const { date, highWater } = trustedStamp(s);
      const day = base.extra?.[date] ?? [];
      if (!day.includes(exerciseId)) return s;
      return {
        ...s,
        clockHighWaterMs: highWater,
        training: {
          ...base,
          extra: { ...base.extra, [date]: day.filter((id) => id !== exerciseId) },
        },
      };
    });
  }, []);

  // ------------------------------------------------------------- entitlement

  // The clock guard matters here more than anywhere else in the app: a trial
  // that ends "tomorrow" on a device whose owner has wound the date back is a
  // trial that never ends. `trustedToday` is already high-water-marked against
  // the server, so the same guard that protects a streak protects the billing.
  const entitlement = useCallback((): Entitlement => {
    const sub = state.subscription;
    if (!sub) return "free";
    return entitlementOf({
      nowIso: `${trustedToday()}T12:00:00.000Z`,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
    });
  }, [state.subscription, trustedToday]);

  const usedCount = useCallback(
    (feature: Feature): number => {
      switch (feature) {
        case "habits":
          return state.habits.filter((h) => !h.archived).length;
        case "progressPhotos":
          return state.photos?.length ?? 0;
        case "customExercises":
          return state.training?.custom?.length ?? 0;
        case "cloudBackup":
          return 0;
        case "coach":
        case "mealPhoto":
          return state.usage?.[trustedToday()]?.[feature] ?? 0;
      }
    },
    [state.habits, state.photos, state.training, state.usage, trustedToday],
  );

  // Until payments are live nobody can buy Pro, so nothing may be held back
  // behind it: a limit whose only way past is a "coming soon" screen is just a
  // broken feature. The server keeps its own ceilings on what costs money.
  const allowance = useCallback(
    (feature: Feature) =>
      PAYMENTS_LIVE ? check(feature, entitlement(), usedCount(feature)) : { ok: true as const, remaining: null },
    [entitlement, usedCount],
  );

  const noteUsed = useCallback(
    (feature: Feature) => {
      // Only the daily ones have a counter; the rest are counted by what
      // exists, so there is nothing to record.
      if (feature !== "coach" && feature !== "mealPhoto") return;
      setState((s) => {
        const { date, highWater } = trustedStamp(s);
        const day = s.usage?.[date] ?? {};
        return {
          ...s,
          clockHighWaterMs: highWater,
          // Only today's row is kept plus whatever was already there; a used
          // day is a few bytes and the history is never read back.
          usage: { ...s.usage, [date]: { ...day, [feature]: (day[feature] ?? 0) + 1 } },
        };
      });
    },
    [],
  );

  const setSubscription = useCallback((sub: AppState["subscription"]) => {
    setState((s) => ({ ...s, subscription: sub }));
  }, []);

  const todayExtras = useCallback(
    () => state.training?.extra?.[trustedToday()] ?? [],
    [state.training, trustedToday],
  );

  // Minted lazily rather than at install: an existing user gets one the first
  // time the kitchen asks, without a migration.
  const mealSeed = useCallback(() => {
    const salt = state.salt ?? "";
    return `${salt}|${trustedToday()}|${state.mealShuffle ?? 0}`;
  }, [state.salt, state.mealShuffle, trustedToday]);

  const shuffleMeals = useCallback(() => {
    setState((s) => ({
      ...s,
      salt: s.salt ?? newId(),
      mealShuffle: (s.mealShuffle ?? 0) + 1,
    }));
  }, []);

  const setSteps = useCallback((n: number) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      return { ...s, clockHighWaterMs: highWater, steps: { ...s.steps, [date]: clampSteps(n) } };
    });
  }, []);

  const addSteps = useCallback((n: number) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      const now = s.steps?.[date] ?? 0;
      return { ...s, clockHighWaterMs: highWater, steps: { ...s.steps, [date]: clampSteps(now + n) } };
    });
  }, []);

  const todaySteps = useCallback(
    () => state.steps?.[trustedToday()] ?? 0,
    [state.steps, trustedToday],
  );

  const stepGoal = useCallback(
    () => state.stepGoal ?? DEFAULT_STEP_GOAL,
    [state.stepGoal],
  );

  const setStepGoal = useCallback((n: number) => {
    if (!isStorableStepGoal(n)) return;
    setState((s) => ({ ...s, stepGoal: n }));
  }, []);

  const exerciseLifts = useCallback(
    (id: string) => state.training?.weights?.[id] ?? [],
    [state.training],
  );

  // Resolving the demo video is a read of the network, so it lives behind the
  // store rather than in the screen: the id it finds is written into state and
  // survives a restart, which is what turns "open the video" from a request
  // into a lookup on every tap but the first.
  const demoFor = useCallback(
    (ex: Exercise) =>
      demoLink(ex, {
        fetchText: async (url) => {
          const res = await fetch(url, { headers: { "Accept-Language": "en" } });
          return res.text();
        },
        cache: state.videoIds ?? {},
        remember: (exerciseId, videoId) =>
          setState((s) => ({ ...s, videoIds: { ...s.videoIds, [exerciseId]: videoId } })),
      }),
    [state.videoIds],
  );


  // The server's clock, learned at each sync, pushes the high-water mark
  // forward. This is what makes the clock guard trustworthy rather than merely
  // monotonic: a device whose clock was set back is snapped up to real time the
  // next time it reaches the server, so a rewound day cannot survive a sync.
  const noteServerTime = useCallback((iso: string) => {
    const serverMs = Date.parse(iso);
    if (!Number.isFinite(serverMs)) return;
    setState((s) => ({
      ...s,
      clockHighWaterMs: advanceHighWater(s.clockHighWaterMs ?? 0, serverMs),
    }));
  }, []);

  /**
   * Focus mode lapses by itself. Someone who starts a session and forgets it
   * should not find a grey app tomorrow morning wondering what broke, so a
   * switch older than this simply reads as off.
   */
  const focusOn = useCallback(() => {
    const since = state.focusSince;
    if (!since) return false;
    const age = Date.now() - Date.parse(since);
    return Number.isFinite(age) && age >= 0 && age < FOCUS_MAX_MS;
  }, [state.focusSince]);

  const toggleFocus = useCallback(() => {
    setState((s) => {
      const since = s.focusSince;
      const live = since ? Date.now() - Date.parse(since) < FOCUS_MAX_MS : false;
      return { ...s, focusSince: live ? undefined : now() };
    });
  }, []);

  const challengeLevel = useCallback(
    (): Difficulty | null => state.challengeLevel ?? null,
    [state.challengeLevel],
  );

  const setChallengeLevel = useCallback((level: Difficulty) => {
    setState((s) => ({ ...s, challengeLevel: level }));
  }, []);

  const todayChallenge = useCallback((): Challenge | null => {
    if (!state.challengeLevel) return null;
    // The device's own salt, so two people at the same level on the same day
    // are not handed the same dare.
    return challengeFor(today(), state.challengeLevel, state.salt ?? "");
  }, [state.challengeLevel, state.salt]);

  const isChallengeDone = useCallback(
    (date?: string) => !!state.challengesDone?.[date ?? today()],
    [state.challengesDone],
  );

  const toggleChallenge = useCallback(() => {
    const challenge = todayChallenge();
    if (!challenge) return;
    const day = today();
    setState((s) => {
      const done = { ...(s.challengesDone ?? {}) };
      // Unticking removes the row rather than writing a false: a challenge is
      // offered fresh each day and there is no history to contradict.
      if (done[day]) delete done[day];
      else done[day] = challenge.id;
      return { ...s, challengesDone: done };
    });
  }, [todayChallenge]);

  const acceptLegal = useCallback(() => {
    setState((s) => ({ ...s, legal: { version: LEGAL.version, acceptedAt: now() } }));
  }, []);

  const legalCurrent = useCallback(() => acceptanceCurrent(state.legal?.version), [state.legal]);

  const consent = useCallback(
    (): Consent => ({
      cloud: state.consent?.cloud ?? false,
      ai: state.consent?.ai ?? false,
      // Photos are on unless turned off — see the note on `Consent`.
      photos: state.consent?.photos ?? true,
      updatedAt: state.consent?.updatedAt ?? "",
    }),
    [state.consent],
  );

  const setConsent = useCallback(
    (patch: Partial<Pick<Consent, "cloud" | "ai" | "photos">>) => {
      setState((s) => ({
        ...s,
        consent: {
          cloud: patch.cloud ?? s.consent?.cloud ?? false,
          ai: patch.ai ?? s.consent?.ai ?? false,
          photos: patch.photos ?? s.consent?.photos ?? true,
          updatedAt: now(),
        },
      }));
    },
    [],
  );

  // The AI transport is a plain module and cannot read this context, so the
  // answer is published to it whenever it changes. Withdrawing consent has to
  // take effect on the very next call, not on the next launch.
  useEffect(() => {
    publishAiConsent(state.consent?.ai ?? false);
  }, [state.consent?.ai]);

  // Likewise for the meal photographs — but published during render rather than
  // from an effect. Effects run child-first, so a meal card's effect asks before
  // this provider's effect has answered, and on the one render that matters —
  // the launch where `ready` flips true — every card would be told no and never
  // ask again. The assignment is idempotent, so doing it on every render costs
  // nothing.
  //
  // `ready` is part of the condition, not an afterthought: until the stored
  // state has loaded there is no answer to publish, and publishing the default
  // instead would fetch for someone who had turned photos off.
  publishPhotoConsent(ready && (state.consent?.photos ?? true));

  const reset = useCallback(() => setState(EMPTY_STATE), []);

  const replaceAll = useCallback((next: AppState) => setState(next), []);

  const value = useMemo<Store>(
    () => ({
      state,
      ready,
      saveProfile,
      addHabit,
      archiveHabit,
      updateHabit,
      streak,
      toggleCompletion,
      isDone,
      addWeighIn,
      editWeighIn,
      removeWeighIn,
      addCheckIn,
      weeklyConsistency,
      readyForAnotherHabit,
      setPantry,
      goal,
      setGoal,
      setNutritionGoal,
      setDietFilter,
      toggleFavorite,
      isFavorite,
      logMeal,
      removeMeal,
      wishes,
      addWish,
      removeWish,
      todayIntake,
      todayKey: trustedToday,
      dayKeyAgo: trustedDaysAgo,
      addWater,
      todayWater,
      waterGoal,
      waterLog,
      setWaterGoal,
      cupMl,
      setCupMl,
      addMeasurement,
      measurementSeries,
      setSex,
      addPhoto,
      removePhoto,
      configureTraining,
      regeneratePlan,
      setTrainingMode,
      addToDay,
      removeFromDay,
      dayEdits,
      planSeed,
      toggleExerciseDone,
      isExerciseDone,
      addCustomExercise,
      completeSession,
      setsFor,
      updateSet,
      addSet,
      removeSet,
      lastSession,
      entitlement,
      allowance,
      noteUsed,
      setSubscription,
      addExerciseToday,
      removeExerciseToday,
      todayExtras,
      mealSeed,
      shuffleMeals,
      setSteps,
      addSteps,
      todaySteps,
      stepGoal,
      setStepGoal,
      demoFor,
      logExerciseWeight,
      exerciseLifts,
      noteServerTime,
      focusOn,
      toggleFocus,
      todayChallenge,
      challengeLevel,
      setChallengeLevel,
      isChallengeDone,
      toggleChallenge,
      acceptLegal,
      legalCurrent,
      consent,
      setConsent,
      reset,
      replaceAll,
    }),
    [
      trustedDaysAgo,state, ready, saveProfile, addHabit, archiveHabit, updateHabit, streak,
     toggleCompletion, isDone, addWeighIn, editWeighIn, removeWeighIn, addCheckIn, weeklyConsistency,
     readyForAnotherHabit, setPantry, goal, setGoal, setNutritionGoal, setDietFilter, toggleFavorite, isFavorite, logMeal, removeMeal, wishes, addWish, removeWish, todayIntake,
     addWater, todayWater, waterGoal, waterLog, setWaterGoal, cupMl, setCupMl, addMeasurement, measurementSeries, setSex, addPhoto, removePhoto, configureTraining, regeneratePlan, setTrainingMode,
     addToDay, removeFromDay, dayEdits, planSeed, removeExerciseToday,
     entitlement, allowance, noteUsed, setSubscription,
     toggleExerciseDone, isExerciseDone, addCustomExercise, noteServerTime,
     demoFor, mealSeed, shuffleMeals, setSteps, addSteps, todaySteps, stepGoal, setStepGoal,
     focusOn, toggleFocus,
     todayChallenge, challengeLevel, setChallengeLevel, isChallengeDone, toggleChallenge,
     acceptLegal, legalCurrent, consent, setConsent, reset, replaceAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export * from "./types";
