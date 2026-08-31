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
  type Profile,
} from "./types";
import { isStorableWeight } from "./weight";
import { advanceHighWater, toLocalDate, trustedNowMs } from "@/time/clock";

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
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch, updatedAt: now() } }));
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
      reset,
      replaceAll,
    }),
    [state, ready, saveProfile, addHabit, archiveHabit, updateHabit, streak,
     toggleCompletion, isDone, addWeighIn, addCheckIn, weeklyConsistency,
     readyForAnotherHabit, setPantry, reset, replaceAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export * from "./types";
