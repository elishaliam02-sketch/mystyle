import type { CheckIn, Completion, Habit, Profile, WeighIn } from "@/store/types";
import type { SupabaseClient } from "@supabase/supabase-js";
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

/** The server's limits (supabase/migration-007-limits.sql). Values are clamped
 * to them before sending: one over-long row would otherwise be refused on
 * every round and hold back everything queued behind it. */
export const LIMITS = { name: 100, title: 200, slot: 32, anchor: 200, note: 2000 } as const;
const clip = (s: string | null | undefined, n: number): string | null => (s == null ? null : s.slice(0, n));
const kgOrNull = (kg: number | null | undefined): number | null =>
  typeof kg === "number" && kg >= 20 && kg <= 500 ? kg : null;

/** Rows per request. PostgREST caps a response (1000 on Supabase by default,
 * lower if the project says so), and a capped response looks exactly like a
 * complete one — so every table is read page by page until a page is empty. */
const PAGE = 1000;
/** Rows per write, so a first sync of years of history is not one huge body. */
const CHUNK = 500;
/** The cursor is moved back this far. A write stamped just before the cursor
 * but committed just after it would otherwise fall between two pulls for
 * good; re-reading a minute is harmless because merging is idempotent. */
const CURSOR_OVERLAP_MS = 60_000;

/** A value inside PostgREST's or=(…) filter, quoted: timestamps carry the
 * reserved `.` and `:`. */
const quote = (v: unknown): string => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Keyset condition "strictly after `last`" over the ordered columns:
 * (a > x) or (a = x and b > y) or (a = x and b = y and c > z). Offset paging
 * would skip a row whenever an earlier one changed mid-read. */
export function afterFilter(cols: string[], last: Record<string, unknown>): string {
  return cols
    .map((col, i) => {
      const gt = `${col}.gt.${quote(last[col])}`;
      if (i === 0) return gt;
      const eqs = cols.slice(0, i).map((p) => `${p}.eq.${quote(last[p])}`);
      return `and(${[...eqs, gt].join(",")})`;
    })
    .join(",");
}

async function pullAll<T>(
  db: SupabaseClient,
  table: string,
  key: string[],
  userId: string,
  since?: string,
): Promise<T[]> {
  const order = ["synced_at", ...key];
  const rows: T[] = [];
  let last: Record<string, unknown> | null = null;
  for (;;) {
    let q = db.from(table).select("*").eq("user_id", userId);
    if (since) q = q.gt("synced_at", since);
    if (last) q = q.or(afterFilter(order, last));
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q.limit(PAGE);
    if (error) throw new Error(`pull ${table} failed`);
    if (!data || data.length === 0) return rows;
    rows.push(...(data as T[]));
    last = data[data.length - 1] as Record<string, unknown>;
  }
}

async function upsertAll(db: SupabaseClient, table: string, rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK));
    // supabase-js reports a refused write in `error` instead of throwing. Left
    // unchecked, the round committed and the push cursor moved past rows the
    // server never stored.
    if (error) throw new Error(`push ${table} failed`);
  }
}

function fromHabit(habit: Habit, userId: string): HabitRow & { user_id: string } {
  return {
    id: habit.id,
    user_id: userId,
    title: clip(habit.title, LIMITS.title) ?? "",
    slot: clip(habit.slot, LIMITS.slot),
    anchor: clip(habit.anchor, LIMITS.anchor),
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
    // The server's clock first, before any row is read: a cursor taken after
    // a read could claim rows that read never saw.
    const clock = await db.rpc("server_now");
    if (clock.error) throw new Error("server_now failed");
    const cursor =
      typeof clock.data === "string"
        ? new Date(Date.parse(clock.data) - CURSOR_OVERLAP_MS).toISOString()
        : undefined;

    const [profile, habits, completions, weighIns, checkIns] = await Promise.all([
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      pullAll<HabitRow>(db, "habits", ["id"], userId, since),
      pullAll<CompletionRow>(db, "completions", ["habit_id", "date"], userId, since),
      pullAll<WeighInRow>(db, "weigh_ins", ["date"], userId, since),
      pullAll<CheckInRow>(db, "check_ins", ["date"], userId, since),
    ]);
    if (profile.error) throw new Error("pull profiles failed");

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
      cursor,
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
      habits: habits.map(toHabit),
      completions: completions.map(
        (c): Completion => ({
          habitId: c.habit_id,
          date: c.date,
          done: c.done ?? true,
          updatedAt: c.updated_at ?? EPOCH,
        }),
      ),
      weighIns: weighIns.map(
        (w): WeighIn => ({
          date: w.date,
          kg: Number(w.kg),
          updatedAt: w.updated_at ?? EPOCH,
        }),
      ),
      checkIns: checkIns.map(
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

    const writes: Promise<void>[] = [];

    if (changes.profile) {
      const profile: Profile = changes.profile;
      writes.push(
        upsertAll(db, "profiles", [
          {
            id: userId,
            name: clip(profile.name, LIMITS.name) ?? "",
            start_kg: kgOrNull(profile.startKg),
            goal_kg: kgOrNull(profile.goalKg),
            reminders: profile.reminders ?? false,
            updated_at: profile.updatedAt ?? new Date().toISOString(),
          },
        ]),
      );
    }
    if (changes.habits.length) {
      writes.push(upsertAll(db, "habits", changes.habits.map((h) => fromHabit(h, userId))));
    }
    if (changes.completions.length) {
      writes.push(
        upsertAll(
          db,
          "completions",
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
        upsertAll(
          db,
          "weigh_ins",
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
        upsertAll(
          db,
          "check_ins",
          changes.checkIns.map((c) => ({
            user_id: userId,
            date: c.date,
            mood: c.mood,
            note: clip(c.note, LIMITS.note) ?? "",
            updated_at: c.updatedAt,
          })),
        ),
      );
    }

    await Promise.all(writes);
  },
};
