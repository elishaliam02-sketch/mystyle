import type { CheckIn, Completion, Habit, Profile, WeighIn } from "@/store/types";
import { supabase } from "./client";
import type { Changes, CloudPort, Rows } from "./sync";

/**
 * The real transport: the merge logic in sync.ts is written against CloudPort
 * so it can be tested without a network, and this is the only file that knows
 * the table and column names.
 */

/** A row written before the sync columns existed has no timestamp of its own. */
const EPOCH = "1970-01-01T00:00:00.000Z";

type HabitRow = {
  id: string;
  title: string;
  slot: string | null;
  anchor: string | null;
  created_at: string;
  archived: boolean;
  updated_at: string | null;
};

type CompletionRow = {
  habit_id: string;
  date: string;
  done: boolean | null;
  updated_at: string | null;
};

type WeighInRow = { date: string; kg: number; updated_at: string | null };

type CheckInRow = { date: string; mood: string; note: string; updated_at: string | null };

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
  async pull(userId: string, since?: string): Promise<Rows> {
    const db = supabase();
    if (!db) return { profile: null, habits: [], completions: [], weighIns: [], checkIns: [] };

    // Filtered on `synced_at` — the moment the *server* recorded the row, set
    // by a trigger and never by us. Filtering on the device's own `updated_at`
    // would lose a week of history the first time someone syncs a phone that
    // had been offline: its rows are stamped when they happened, which is
    // before the cursor every other device is holding.
    // The indexes for exactly this filter are in supabase/schema.sql; without
    // them this is a sequential scan of the table per sync.
    const recent = <T>(q: T): T =>
      since ? ((q as { gt: (c: string, v: string) => T }).gt("synced_at", since) as T) : q;

    // One round trip each, in parallel: five small reads beat one join the
    // client would have to unpick anyway. `server_now` rides along with them
    // so the cursor we hand back is the server's clock, read before the reads.
    const [cursor, profile, habits, completions, weighIns, checkIns] = await Promise.all([
      db.rpc("server_now"),
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      recent(db.from("habits").select("*").eq("user_id", userId)),
      recent(db.from("completions").select("*").eq("user_id", userId)),
      recent(db.from("weigh_ins").select("*").eq("user_id", userId)),
      recent(db.from("check_ins").select("*").eq("user_id", userId)),
    ]);

    const p = profile.data as
      | {
          name: string;
          start_kg: number | null;
          goal_kg: number | null;
          reminders: boolean;
          updated_at: string | null;
        }
      | null;

    return {
      // No cursor rather than a guessed one: a device that never learns the
      // server's time keeps pulling everything, which is slow but correct,
      // where a wrong cursor silently skips rows forever.
      cursor: typeof cursor.data === "string" ? cursor.data : undefined,
      profile: p
        ? {
            name: p.name ?? "",
            startKg: p.start_kg ?? undefined,
            goalKg: p.goal_kg ?? undefined,
            reminders: p.reminders ?? false,
            // A profile row only exists once someone has signed in and saved,
            // so its presence with a name means onboarding happened.
            onboarded: Boolean(p.name),
            updatedAt: p.updated_at ?? undefined,
          }
        : null,
      habits: ((habits.data as HabitRow[] | null) ?? []).map(toHabit),
      completions: (
        (completions.data as CompletionRow[] | null) ?? []
      ).map(
        (c): Completion => ({
          habitId: c.habit_id,
          date: c.date,
          done: c.done ?? true,
          updatedAt: c.updated_at ?? EPOCH,
        }),
      ),
      weighIns: ((weighIns.data as WeighInRow[] | null) ?? []).map(
        (w): WeighIn => ({
          date: w.date,
          kg: Number(w.kg),
          updatedAt: w.updated_at ?? EPOCH,
        }),
      ),
      checkIns: ((checkIns.data as CheckInRow[] | null) ?? []).map(
        (c): CheckIn => ({
          date: c.date,
          mood: c.mood as CheckIn["mood"],
          note: c.note ?? "",
          updatedAt: c.updated_at ?? EPOCH,
        }),
      ),
    };
  },

  // Only what changed arrives here, and each row carries the timestamp the
  // device wrote — never `now()`. Restamping on arrival would make every row
  // look freshly changed to the user's other devices, and each sync would drag
  // the whole account across the network again.
  async push(userId: string, changes: Changes): Promise<void> {
    const db = supabase();
    if (!db) return;

    // Postgrest builders are thenables rather than real promises, which is why
    // this is PromiseLike; Promise.all accepts them all the same.
    const writes: PromiseLike<unknown>[] = [];

    if (changes.profile) {
      const profile: Profile = changes.profile;
      writes.push(
        db.from("profiles").upsert({
          id: userId,
          name: profile.name,
          start_kg: profile.startKg ?? null,
          goal_kg: profile.goalKg ?? null,
          reminders: profile.reminders ?? false,
          updated_at: profile.updatedAt ?? new Date().toISOString(),
        }),
      );
    }
    if (changes.habits.length) {
      writes.push(db.from("habits").upsert(changes.habits.map((h) => fromHabit(h, userId))));
    }
    if (changes.completions.length) {
      writes.push(
        db.from("completions").upsert(
          changes.completions.map((c) => ({
            user_id: userId,
            habit_id: c.habitId,
            date: c.date,
            done: c.done,
            updated_at: c.updatedAt,
          })),
        ),
      );
    }
    if (changes.weighIns.length) {
      writes.push(
        db.from("weigh_ins").upsert(
          changes.weighIns.map((w) => ({
            user_id: userId,
            date: w.date,
            kg: w.kg,
            updated_at: w.updatedAt,
          })),
        ),
      );
    }
    if (changes.checkIns.length) {
      writes.push(
        db.from("check_ins").upsert(
          changes.checkIns.map((c) => ({
            user_id: userId,
            date: c.date,
            mood: c.mood,
            note: c.note,
            updated_at: c.updatedAt,
          })),
        ),
      );
    }

    await Promise.all(writes);
  },
};
