/**
 * The evening recap's "tomorrow, try this" — worked out on the device.
 *
 * The promise of the app is that the evening's answers change tomorrow. That
 * change came only from the cloud model, and the model is off until someone
 * opts in — so for most people the recap thanked them and changed nothing.
 * This finds the habit that is not happening and proposes the one change most
 * likely to make it happen, from the person's own last week:
 *
 *   1. Smaller: a number in the habit is halved — "walk 30 minutes" becomes
 *      "walk 15 minutes". A small habit done every day beats a big one skipped.
 *   2. Anchored: no trigger yet — hang it on something that already happens
 *      ("after I brush my teeth"), from the support library for its kind.
 *   3. Moved: it sits in a part of the day where little gets done, while
 *      another part is where this person's habits do get ticked.
 *
 * A hard week (two or more "hard" recaps) lowers the bar for stepping in.
 * Pure: dates and ticks in, one suggestion (or none) out; the words live in
 * src/i18n. Tested in adjusttest.ts.
 */
import { addDays, dueOn } from "@/habits/schedule";

export type Slot = "morning" | "noon" | "evening";

export type AdjustInput = {
  today: string;
  habits: { id: string; title: string; slot?: Slot; anchor?: string; days?: number[]; createdAt: string; updatedAt?: string }[];
  /** Dates each habit was ticked done. */
  doneDates: Record<string, readonly string[]>;
  moods: { date: string; mood: "good" | "ok" | "hard" }[];
  /** Triggers that suit a habit, best first (the support library). */
  anchorsFor: (title: string) => readonly string[];
};

export type LocalAdjustment = {
  kind: "smaller" | "anchor" | "reschedule";
  habitId: string;
  habitTitle: string;
  newTitle?: string;
  anchor?: string;
  slot?: Slot;
  why: "missed" | "hard";
  done: number;
  days: number;
  /** For a move: how often habits get done in the new part of the day, 0–100. */
  slotRate?: number;
};

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) / DAY);

/** Halves the first count in a habit — not a clock time — or null. */
export function shrinkTitle(title: string): string | null {
  const re = /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g;
  for (let m = re.exec(title); m; m = re.exec(title)) {
    const raw = m[1]!;
    const before = title[m.index - 1];
    const after = title[m.index + raw.length];
    if (before === ":" || after === ":") continue;
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 2) continue;
    const half = n / 2;
    const next = n >= 1000 ? Math.round(half / 500) * 500 : n >= 20 ? Math.round(half / 5) * 5 : Math.max(1, Math.round(half));
    if (next >= n || next < 1) continue;
    const text = raw.includes(",") ? next.toLocaleString("en-US") : String(next);
    return title.slice(0, m.index) + text + title.slice(m.index + raw.length);
  }
  return null;
}

export function suggestAdjustment(input: AdjustInput): LocalAdjustment | null {
  const today = dayNum(input.today);
  const inWeek = (d: string) => today - dayNum(d) >= 0 && today - dayNum(d) < 7;
  const hard = input.moods.filter((m) => m.mood === "hard" && inWeek(m.date)).length;
  const bar = hard >= 2 ? 4 / 7 : 3 / 7;

  // The week's days each habit was owed — its rest days are not misses.
  const week = Array.from({ length: 7 }, (_, i) => addDays(input.today, -i));
  const reading = input.habits.map((h) => {
    const age = today - dayNum(h.createdAt) + 1;
    const owed = week.filter((d) => dueOn(h, d));
    const days = owed.length;
    const done = new Set((input.doneDates[h.id] ?? []).filter((d) => owed.includes(d))).size;
    // Enough to judge: four days old, and owed at least twice this week.
    return { h, days, done, rate: days > 0 ? done / days : 1, judged: age >= 4 && days >= 2 };
  });

  // Where in the day this person's habits do get done.
  const slotRate = (slot: Slot) => {
    const there = reading.filter((r) => r.h.slot === slot && r.judged);
    const days = there.reduce((n, r) => n + r.days, 0);
    return days ? there.reduce((n, r) => n + r.done, 0) / days : null;
  };

  // A habit changed this week (made smaller, moved, anchored) gets the week to
  // work before it is touched again — or "30 minutes" would halve every night.
  const settling = (h: AdjustInput["habits"][number]) =>
    !!h.updatedAt && h.updatedAt.slice(0, 10) > h.createdAt.slice(0, 10) && today - dayNum(h.updatedAt) < 7;
  const struggling = reading
    .filter((r) => r.judged && r.rate <= bar && !settling(r.h))
    .sort((a, b) => a.rate - b.rate || a.h.createdAt.localeCompare(b.h.createdAt));

  for (const r of struggling) {
    const base = { habitId: r.h.id, habitTitle: r.h.title, why: hard >= 2 ? ("hard" as const) : ("missed" as const), done: r.done, days: r.days };
    const smaller = shrinkTitle(r.h.title);
    if (smaller) return { ...base, kind: "smaller", newTitle: smaller };
    if (!r.h.anchor?.trim()) {
      const anchor = input.anchorsFor(r.h.title)[0];
      if (anchor) return { ...base, kind: "anchor", anchor };
    }
    const options = (["morning", "noon", "evening"] as const)
      .filter((s) => s !== r.h.slot)
      .map((s) => ({ s, rate: slotRate(s) }))
      .filter((x): x is { s: Slot; rate: number } => x.rate !== null && x.rate - r.rate >= 0.3)
      .sort((a, b) => b.rate - a.rate);
    if (options[0]) return { ...base, kind: "reschedule", slot: options[0].s, slotRate: Math.round(options[0].rate * 100) };
  }
  return null;
}
