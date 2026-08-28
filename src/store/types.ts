/** A habit the user wrote for themselves. Nothing here is generated for them. */
export type Habit = {
  id: string;
  title: string;
  /** Rough time of day, chosen from chips. Undefined means "whenever". */
  slot?: "morning" | "noon" | "evening";
  createdAt: string;
  archived: boolean;
};

/** One habit ticked off on one day. Keyed by `${habitId}|${date}`. */
export type Completion = {
  habitId: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
};

export type WeighIn = {
  date: string;
  kg: number;
};

export type CheckIn = {
  date: string;
  mood: "good" | "ok" | "hard";
  note: string;
};

export type Profile = {
  name: string;
  startKg?: number;
  goalKg?: number;
  onboarded: boolean;
};

export type AppState = {
  profile: Profile;
  habits: Habit[];
  completions: Completion[];
  weighIns: WeighIn[];
  checkIns: CheckIn[];
};

export const EMPTY_STATE: AppState = {
  profile: { name: "", onboarded: false },
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
