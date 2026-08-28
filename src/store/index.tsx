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
  daysAgo,
  newId,
  today,
  type AppState,
  type CheckIn,
  type Habit,
  type Profile,
} from "./types";

const STORAGE_KEY = "mystyle.state.v1";

type Store = {
  state: AppState;
  ready: boolean;
  saveProfile: (patch: Partial<Profile>) => void;
  addHabit: (title: string, slot?: Habit["slot"]) => void;
  archiveHabit: (id: string) => void;
  updateHabit: (id: string, patch: Partial<Pick<Habit, "title" | "slot" | "anchor">>) => void;
  /** Consecutive days completed, counting back from today (or yesterday). */
  streak: (habitId: string) => number;
  toggleCompletion: (habitId: string) => void;
  isDone: (habitId: string, date?: string) => boolean;
  addWeighIn: (kg: number) => void;
  addCheckIn: (entry: Omit<CheckIn, "date">) => void;
  /** Completions of active habits over the last 7 days, as a 0–1 ratio. */
  weeklyConsistency: () => number;
  /** True once the current habits are holding — the only moment we suggest adding one. */
  readyForAnotherHabit: () => boolean;
  reset: () => void;
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
        if (raw) setState({ ...EMPTY_STATE, ...(JSON.parse(raw) as AppState) });
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

  const saveProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  }, []);

  const addHabit = useCallback((title: string, slot?: Habit["slot"]) => {
    const clean = title.trim();
    if (!clean) return;
    setState((s) => ({
      ...s,
      habits: [
        ...s.habits,
        { id: newId(), title: clean, slot, createdAt: today(), archived: false },
      ],
    }));
  }, []);

  const archiveHabit = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
    }));
  }, []);

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, "title" | "slot" | "anchor">>) => {
      setState((s) => ({
        ...s,
        habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      }));
    },
    [],
  );

  const toggleCompletion = useCallback((habitId: string) => {
    const date = today();
    setState((s) => {
      const has = s.completions.some(
        (c) => c.habitId === habitId && c.date === date,
      );
      return {
        ...s,
        completions: has
          ? s.completions.filter(
              (c) => !(c.habitId === habitId && c.date === date),
            )
          : [...s.completions, { habitId, date }],
      };
    });
  }, []);

  const isDone = useCallback(
    (habitId: string, date = today()) =>
      state.completions.some((c) => c.habitId === habitId && c.date === date),
    [state.completions],
  );

  const addWeighIn = useCallback((kg: number) => {
    if (!Number.isFinite(kg) || kg <= 0) return;
    const date = today();
    setState((s) => ({
      ...s,
      weighIns: [...s.weighIns.filter((w) => w.date !== date), { date, kg }].sort(
        (a, b) => a.date.localeCompare(b.date),
      ),
      profile: s.profile.startKg ? s.profile : { ...s.profile, startKg: kg },
    }));
  }, []);

  const addCheckIn = useCallback((entry: Omit<CheckIn, "date">) => {
    const date = today();
    setState((s) => ({
      ...s,
      checkIns: [...s.checkIns.filter((c) => c.date !== date), { ...entry, date }],
    }));
  }, []);

  const streak = useCallback(
    (habitId: string) => {
      const done = new Set(
        state.completions.filter((c) => c.habitId === habitId).map((c) => c.date),
      );
      // Today not being ticked yet shouldn't read as a broken streak at 09:00,
      // so an unticked today is skipped rather than counted as a miss.
      let offset = done.has(daysAgo(0)) ? 0 : 1;
      let count = 0;
      while (done.has(daysAgo(offset))) {
        count += 1;
        offset += 1;
      }
      return count;
    },
    [state.completions],
  );

  const weeklyConsistency = useCallback(() => {
    const active = state.habits.filter((h) => !h.archived);
    if (active.length === 0) return 0;

    const window = Array.from({ length: 7 }, (_, i) => daysAgo(i));
    // Only count days a habit already existed, so a habit added yesterday
    // is not scored against the six days before it was created.
    let possible = 0;
    let done = 0;
    for (const habit of active) {
      for (const date of window) {
        if (date < habit.createdAt) continue;
        possible += 1;
        if (state.completions.some((c) => c.habitId === habit.id && c.date === date)) {
          done += 1;
        }
      }
    }
    return possible === 0 ? 0 : done / possible;
  }, [state.habits, state.completions]);

  const readyForAnotherHabit = useCallback(() => {
    const active = state.habits.filter((h) => !h.archived);
    if (active.length === 0) return true;
    // A habit needs to have been around long enough to have a track record.
    const oldest = active.reduce((a, h) => (h.createdAt < a ? h.createdAt : a), today());
    const ageInDays = Math.round(
      (Date.parse(today()) - Date.parse(oldest)) / 86_400_000,
    );
    return ageInDays >= 4 && weeklyConsistency() >= 0.6;
  }, [state.habits, weeklyConsistency]);

  const reset = useCallback(() => setState(EMPTY_STATE), []);

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
      reset,
    }),
    [state, ready, saveProfile, addHabit, archiveHabit, updateHabit, streak,
     toggleCompletion, isDone, addWeighIn, addCheckIn, weeklyConsistency,
     readyForAnotherHabit, reset],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export * from "./types";
