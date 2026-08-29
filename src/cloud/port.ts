import type { AppState, CheckIn, Completion, Habit, Profile, WeighIn } from "@/store/types";
import { supabase } from "./client";
import type { CloudPort, Rows } from "./sync";

/**
 * The real transport: the merge logic in sync.ts is written against CloudPort
 * so it can be tested without a network, and this is the only file that knows
 * the table and column names.
 */

type HabitRow = {
  id: string;
  title: string;
  slot: string | null;
  anchor: string | null;
  created_at: string;
  archived: boolean;
  updated_at: string | null;
};

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    title: row.title,
    slot: (row.slot as Habit["slot"]) ?? undefined,
    anchor: row.anchor ?? undefined,
    createdAt: row.created_at,
    archived: row.archived,
    updatedAt: row.updated_at ?? undefined,
  };
}

function fromHabit(habit: Habit, userId: string): HabitRow & { user_id: string } {
  return {
    id: habit.id,
    user_id: userId,
    title: habit.title,
    slot: habit.slot ?? null,
    anchor: habit.anchor ?? null,
    created_at: habit.createdAt,
    archived: habit.archived,
    updated_at: habit.updatedAt ?? new Date().toISOString(),
  };
}

export const supabasePort: CloudPort = {
  async pull(userId: string): Promise<Rows> {
    const db = supabase();
    if (!db) return { profile: null, habits: [], completions: [], weighIns: [], checkIns: [] };

    // One round trip each, in parallel: five small reads beat one join the
    // client would have to unpick anyway.
    const [profile, habits, completions, weighIns, checkIns] = await Promise.all([
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db.from("habits").select("*").eq("user_id", userId),
      db.from("completions").select("*").eq("user_id", userId),
      db.from("weigh_ins").select("*").eq("user_id", userId),
      db.from("check_ins").select("*").eq("user_id", userId),
    ]);

    const p = profile.data as
      | { name: string; start_kg: number | null; goal_kg: number | null; reminders: boolean }
      | null;

    return {
      profile: p
        ? {
            name: p.name ?? "",
            startKg: p.start_kg ?? undefined,
            goalKg: p.goal_kg ?? undefined,
            reminders: p.reminders ?? false,
            // A profile row only exists once someone has signed in and saved,
            // so its presence with a name means onboarding happened.
            onboarded: Boolean(p.name),
          }
        : null,
      habits: ((habits.data as HabitRow[] | null) ?? []).map(toHabit),
      completions: ((completions.data as { habit_id: string; date: string }[] | null) ?? []).map(
        (c): Completion => ({ habitId: c.habit_id, date: c.date }),
      ),
      weighIns: ((weighIns.data as { date: string; kg: number }[] | null) ?? []).map(
        (w): WeighIn => ({ date: w.date, kg: Number(w.kg) }),
      ),
      checkIns: ((checkIns.data as { date: string; mood: string; note: string }[] | null) ?? []).map(
        (c): CheckIn => ({ date: c.date, mood: c.mood as CheckIn["mood"], note: c.note ?? "" }),
      ),
    };
  },

  async push(userId: string, state: AppState): Promise<void> {
    const db = supabase();
    if (!db) return;

    const profile: Profile = state.profile;
    await db.from("profiles").upsert({
      id: userId,
      name: profile.name,
      start_kg: profile.startKg ?? null,
      goal_kg: profile.goalKg ?? null,
      reminders: profile.reminders ?? false,
      updated_at: new Date().toISOString(),
    });

    if (state.habits.length) {
      await db.from("habits").upsert(state.habits.map((h) => fromHabit(h, userId)));
    }
    if (state.completions.length) {
      await db.from("completions").upsert(
        state.completions.map((c) => ({ user_id: userId, habit_id: c.habitId, date: c.date })),
      );
    }
    if (state.weighIns.length) {
      await db.from("weigh_ins").upsert(
        state.weighIns.map((w) => ({ user_id: userId, date: w.date, kg: w.kg })),
      );
    }
    if (state.checkIns.length) {
      await db.from("check_ins").upsert(
        state.checkIns.map((c) => ({
          user_id: userId,
          date: c.date,
          mood: c.mood,
          note: c.note,
        })),
      );
    }
  },
};
