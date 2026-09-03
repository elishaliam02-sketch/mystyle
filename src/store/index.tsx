import AsyncStorage from "@react-native-async-storage/async-storage";
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
  type Habit,
  type IntakeItem,
  type Profile,
  type Training,
  type WeighIn,
} from "./types";
import { isStorableWeight } from "./weight";
import { isStorableCm, type Reading } from "@/body";
import { isStorableKg, type Lift } from "@/workout/lifts";
import { blankSets, previousSets, type SetEntry } from "@/workout/sets";
import { demoLink } from "@/workout/video";
import { isHeightCm, isStorableGoal } from "@/health";
import {
  clampSteps,
  DEFAULT_STEP_GOAL,
  isStorableGoal as isStorableStepGoal,
} from "@/health/steps";
import { advanceHighWater, toLocalDate, trustedNowMs } from "@/time/clock";
import type { Goal } from "@/kitchen";
import type { Exercise } from "@/workout/exercises";

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
  addCheckIn: (entry: Omit<CheckIn, "date" | "updatedAt">) => void;
  /** Completions of active habits over the last 7 days, as a 0–1 ratio. */
  weeklyConsistency: () => number;
  /** True once the current habits are holding — the only moment we suggest adding one. */
  readyForAnotherHabit: () => boolean;
  /** The groceries the person keeps, as free text. */
  setPantry: (text: string) => void;
  /** Remembers the kitchen's nutrition goal across opens. */
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
  /** Today's food log and its running totals. */
  todayIntake: () => { items: IntakeItem[]; kcal: number; protein: number };
  /** Adds (or, with a negative delta, removes) a glass of water today. */
  addWater: (delta: number) => void;
  /** Glasses of water logged today. */
  todayWater: () => number;
  /** Records a tape-measure reading for a body part (today). */
  addMeasurement: (part: string, cm: number) => void;
  /** All readings for a body part, oldest first. */
  measurementSeries: (part: string) => Reading[];
  /** Sets up (or re-tunes) the training plan for a goal, weekly frequency,
   * session length and available equipment. */
  configureTraining: (goal: Goal, days: number, minutes?: number, equipment?: string) => void;
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
  addExerciseToday: (exerciseId: string) => void;
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
      return { ...s, profile: { ...next, updatedAt: now() } };
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

  const trustedToday = useCallback(
    () => toLocalDate(trustedNowMs(Date.now(), state.clockHighWaterMs ?? 0)),
    [state.clockHighWaterMs],
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
    [state.clockHighWaterMs],
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

  const setNutritionGoal = useCallback((goal: Goal) => {
    setState((s) => ({ ...s, nutritionGoal: goal }));
  }, []);

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

  const todayIntake = useCallback(() => {
    const d = trustedToday();
    const items = state.intake?.[d] ?? [];
    return {
      items,
      kcal: items.reduce((n, i) => n + i.kcal, 0),
      protein: items.reduce((n, i) => n + i.protein, 0),
    };
  }, [state.intake, trustedToday]);

  const addWater = useCallback((delta: number) => {
    setState((s) => {
      const { date, highWater } = trustedStamp(s);
      const next = Math.max(0, (s.water?.[date] ?? 0) + delta);
      return {
        ...s,
        clockHighWaterMs: highWater,
        water: { ...s.water, [date]: next },
      };
    });
  }, []);

  const todayWater = useCallback(
    () => state.water?.[trustedToday()] ?? 0,
    [state.water, trustedToday],
  );

  const addMeasurement = useCallback((part: string, cm: number) => {
    if (!isStorableCm(cm)) return;
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
    (goal: Goal, days: number, minutes?: number, equipment?: string) => {
      setState((s) => ({
        ...s,
        training: {
          goal,
          days,
          minutes,
          equipment,
          // Keep the log, lifted weights and the person's own moves through a re-tune.
          log: s.training?.log ?? {},
          custom: s.training?.custom ?? [],
          weights: s.training?.weights ?? {},
        },
      }));
    },
    [],
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
      addCheckIn,
      weeklyConsistency,
      readyForAnotherHabit,
      setPantry,
      setNutritionGoal,
      setDietFilter,
      toggleFavorite,
      isFavorite,
      logMeal,
      removeMeal,
      todayIntake,
      addWater,
      todayWater,
      addMeasurement,
      measurementSeries,
      configureTraining,
      toggleExerciseDone,
      isExerciseDone,
      addCustomExercise,
      completeSession,
      setsFor,
      updateSet,
      addSet,
      removeSet,
      lastSession,
      addExerciseToday,
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
      reset,
      replaceAll,
    }),
    [state, ready, saveProfile, addHabit, archiveHabit, updateHabit, streak,
     toggleCompletion, isDone, addWeighIn, addCheckIn, weeklyConsistency,
     readyForAnotherHabit, setPantry, setNutritionGoal, setDietFilter, toggleFavorite, isFavorite, logMeal, removeMeal, todayIntake,
     addWater, todayWater, addMeasurement, measurementSeries, configureTraining,
     toggleExerciseDone, isExerciseDone, addCustomExercise, noteServerTime,
     demoFor, mealSeed, shuffleMeals, setSteps, addSteps, todaySteps, stepGoal, setStepGoal, reset, replaceAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export * from "./types";
