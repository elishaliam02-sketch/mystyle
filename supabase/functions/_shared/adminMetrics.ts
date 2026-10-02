// APEX — the owner console's numbers, computed from raw rows.
//
// Pure TypeScript with no imports, so the same file runs inside the `admin`
// edge function (Deno) and under the app's unit tests (src/admin/metricstest.ts).
// The function fetches the rows; everything that turns rows into answers lives
// here, where every rule is tested:
//   - who is a real, active person and who signed up and never came back;
//   - growth, daily/weekly/monthly actives and retention at day 1, 7 and 30;
//   - subscription counts and the monthly recurring revenue they add up to;
//   - how people are doing: habit completion, recap moods, weight trajectory;
//   - the short list of people the owner should look at today, and why.

export type UserRow = { id: string; email: string | null; createdAt: string; lastSignInAt: string | null; anonymous: boolean };
export type SubRow = { userId: string; status: string; planId: string | null; currentPeriodEnd: string | null; trialEndsAt: string | null; stripe: boolean };
export type DateRow = { userId: string; date: string };
export type WeighRow = { userId: string; date: string; kg: number };
export type MoodRow = { userId: string; date: string; mood: string };
export type HabitRow = { userId: string; archived: boolean };
export type CompletionRow = { userId: string; date: string; done: boolean };
export type ProfileRow = { id: string; goalKg: number | null };

export type Raw = {
  users: UserRow[];
  subs: SubRow[];
  weighIns: WeighRow[];
  checkIns: MoodRow[];
  habits: HabitRow[];
  completions: CompletionRow[];
  profiles: ProfileRow[];
  /** Days a backup was written (the whole-device sync). */
  backups: DateRow[];
};

const DAY = 86_400_000;
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayNum = (iso: string) => Math.floor(Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso) / DAY);

// ------------------------------------------------------------------ trajectory
// The same rule as src/admin/trajectory.ts, over the weigh-ins the app synced.

export type Traj = "no-data" | "on-track" | "slow" | "stalled" | "fast" | "off-track";
export const TRAJECTORIES: Traj[] = ["on-track", "slow", "fast", "stalled", "off-track", "no-data"];

export function readTrajectory(points: { date: string; kg: number }[], goalKg: number | null, nowMs: number) {
  const clean = points
    .filter((p) => p && typeof p.date === "string" && Number.isFinite(p.kg))
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = clean[clean.length - 1];
  const daysSinceWeighIn = last ? Math.max(0, dayNum(dayKey(nowMs)) - dayNum(last.date)) : null;
  const base = { trajectory: "no-data" as Traj, perWeek: null as number | null, daysSinceWeighIn, points: clean.length, lastKg: last ? last.kg : null };
  if (clean.length < 2) return base;
  const first = clean[0]!;
  const days = dayNum(last!.date) - dayNum(first.date);
  if (!(days >= 7)) return base;
  const perWeek = Math.round(((last!.kg - first.kg) / days) * 7 * 100) / 100;
  const towardIsNegative = goalKg !== null ? goalKg - last!.kg < 0 : true;
  const magnitude = Math.abs(perWeek);
  const toward = perWeek === 0 ? false : perWeek < 0 === towardIsNegative;
  let trajectory: Traj;
  if (magnitude < 0.1) trajectory = "stalled";
  else if (!toward) trajectory = "off-track";
  else if (magnitude < 0.2) trajectory = "slow";
  else if (magnitude > 1.5) trajectory = "fast";
  else trajectory = "on-track";
  return { ...base, trajectory, perWeek };
}

// --------------------------------------------------------------- one person

/** The monthly price of each plan in agorot (src/billing/plans.ts); the
 * yearly plan counts as a twelfth of its price. Comp access earns nothing. */
export const PLAN_MONTHLY_MINOR: Record<string, number> = { monthly: 2990, yearly: Math.round(24900 / 12) };

export type Summary = {
  id: string;
  email: string | null;
  anonymous: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  /** The latest day with any activity (a tick, a weigh-in, a recap, a backup). */
  lastActive: string | null;
  /** Days with activity in the last 30. */
  activeDays30: number;
  status: string;
  planId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripe: boolean;
  trajectory: Traj;
  perWeek: number | null;
  lastKg: number | null;
  goalKg: number | null;
  daysSinceWeighIn: number | null;
  weighIns: number;
  habits: number;
  /** Done habit-days over possible habit-days in the last 7 days, 0–1; null without habits. */
  completion7: number | null;
  checkIns7: number;
  hard7: number;
};

export function summarize(raw: Raw, nowMs: number): Summary[] {
  const today = dayNum(dayKey(nowMs));
  const by = <T extends { userId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const a = m.get(r.userId);
      if (a) a.push(r);
      else m.set(r.userId, [r]);
    }
    return m;
  };
  const subs = new Map(raw.subs.map((s) => [s.userId, s]));
  const goals = new Map(raw.profiles.map((p) => [p.id, p.goalKg]));
  const weighs = by(raw.weighIns);
  const moods = by(raw.checkIns);
  const habits = by(raw.habits);
  const done = by(raw.completions.filter((c) => c.done));
  const backups = by(raw.backups);

  return raw.users.map((u) => {
    const days = new Set<number>();
    for (const r of weighs.get(u.id) ?? []) days.add(dayNum(r.date));
    for (const r of moods.get(u.id) ?? []) days.add(dayNum(r.date));
    for (const r of done.get(u.id) ?? []) days.add(dayNum(r.date));
    for (const r of backups.get(u.id) ?? []) days.add(dayNum(r.date));
    const valid = [...days].filter((d) => d <= today);
    const last = valid.length ? Math.max(...valid) : null;
    const s = subs.get(u.id);
    const t = readTrajectory(weighs.get(u.id) ?? [], goals.get(u.id) ?? null, nowMs);
    const active = (habits.get(u.id) ?? []).filter((h) => !h.archived).length;
    const done7 = (done.get(u.id) ?? []).filter((c) => today - dayNum(c.date) < 7 && today - dayNum(c.date) >= 0).length;
    const recent = (moods.get(u.id) ?? []).filter((m) => today - dayNum(m.date) < 7 && today - dayNum(m.date) >= 0);
    return {
      id: u.id,
      email: u.email,
      anonymous: u.anonymous,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      lastActive: last === null ? null : new Date(last * DAY).toISOString().slice(0, 10),
      activeDays30: valid.filter((d) => today - d < 30).length,
      status: s?.status ?? "none",
      planId: s?.planId ?? null,
      trialEndsAt: s?.trialEndsAt ?? null,
      currentPeriodEnd: s?.currentPeriodEnd ?? null,
      stripe: !!s?.stripe,
      trajectory: t.trajectory,
      perWeek: t.perWeek,
      lastKg: t.lastKg,
      goalKg: goals.get(u.id) ?? null,
      daysSinceWeighIn: t.daysSinceWeighIn,
      weighIns: t.points,
      habits: active,
      completion7: active > 0 ? Math.min(1, done7 / (active * 7)) : null,
      checkIns7: recent.length,
      hard7: recent.filter((m) => m.mood === "hard").length,
    };
  });
}

// -------------------------------------------------------------- the cohort

export type Attention = { id: string; email: string | null; reason: "fast" | "hard-week" | "slipping" | "trial-ending" | "off-track"; detail: number | null };

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function dashboard(all: Summary[], activity: DateRow[], moods: MoodRow[], nowMs: number) {
  const today = dayNum(dayKey(nowMs));
  const age = (iso: string) => today - dayNum(iso);
  const users = all;

  // Who was active on which day: every activity row, by person.
  const activeOn = new Map<number, Set<string>>();
  const daysOf = new Map<string, Set<number>>();
  for (const r of activity) {
    const d = dayNum(r.date);
    if (d > today) continue;
    (activeOn.get(d) ?? activeOn.set(d, new Set()).get(d)!).add(r.userId);
    (daysOf.get(r.userId) ?? daysOf.set(r.userId, new Set()).get(r.userId)!).add(d);
  }
  const activeIn = (from: number, to: number) => {
    const s = new Set<string>();
    for (let d = from; d <= to; d++) for (const id of activeOn.get(d) ?? []) s.add(id);
    return s.size;
  };

  const series = (n: number, f: (d: number) => number) =>
    Array.from({ length: n }, (_, i) => {
      const d = today - (n - 1 - i);
      return { date: new Date(d * DAY).toISOString().slice(0, 10), n: f(d) };
    });
  const signupDays = new Map<number, number>();
  for (const u of users) {
    const d = dayNum(u.createdAt);
    signupDays.set(d, (signupDays.get(d) ?? 0) + 1);
  }

  const retention = (n: number) => {
    const eligible = users.filter((u) => age(u.createdAt) >= n);
    const kept = eligible.filter((u) => {
      const start = dayNum(u.createdAt);
      for (const d of daysOf.get(u.id) ?? []) if (d >= start + n) return true;
      return false;
    });
    return { eligible: eligible.length, retained: kept.length, rate: pct(kept.length, eligible.length) };
  };

  // The last eight weeks of sign-ups, and how many of each are active now.
  const cohorts = Array.from({ length: 8 }, (_, i) => {
    const end = today - i * 7;
    const start = end - 6;
    const members = users.filter((u) => {
      const d = dayNum(u.createdAt);
      return d >= start && d <= end;
    });
    const activeNow = members.filter((u) => [...(daysOf.get(u.id) ?? [])].some((d) => today - d < 7)).length;
    return { weekStart: new Date(start * DAY).toISOString().slice(0, 10), signups: members.length, activeNow, rate: pct(activeNow, members.length) };
  }).reverse();

  const statusCounts: Record<string, number> = {};
  let mrrMinor = 0;
  for (const u of users) {
    statusCounts[u.status] = (statusCounts[u.status] ?? 0) + 1;
    if (u.status === "active" && u.planId) mrrMinor += PLAN_MONTHLY_MINOR[u.planId] ?? 0;
  }

  const recentMoods = moods.filter((m) => age(m.date) >= 0 && age(m.date) < 7);
  const moodCounts = { good: 0, ok: 0, hard: 0 } as Record<string, number>;
  for (const m of recentMoods) if (m.mood in moodCounts) moodCounts[m.mood]! += 1;

  const withHabits = users.filter((u) => u.completion7 !== null);
  const trajectory = Object.fromEntries(TRAJECTORIES.map((t) => [t, 0])) as Record<Traj, number>;
  for (const u of users) trajectory[u.trajectory] += 1;

  // People worth a look today, most urgent first.
  const attention: Attention[] = [];
  for (const u of users) {
    if (u.trajectory === "fast") attention.push({ id: u.id, email: u.email, reason: "fast", detail: u.perWeek });
    if (u.hard7 >= 2) attention.push({ id: u.id, email: u.email, reason: "hard-week", detail: u.hard7 });
    const days = daysOf.get(u.id) ?? new Set<number>();
    const before = [...days].some((d) => today - d >= 7 && today - d < 28);
    const lately = [...days].some((d) => today - d < 7);
    if (before && !lately) attention.push({ id: u.id, email: u.email, reason: "slipping", detail: u.lastActive ? today - dayNum(u.lastActive) : null });
    if (u.status === "trialing" && u.trialEndsAt) {
      const left = dayNum(u.trialEndsAt) - today;
      if (left >= 0 && left <= 3) attention.push({ id: u.id, email: u.email, reason: "trial-ending", detail: left });
    }
    if (u.trajectory === "off-track") attention.push({ id: u.id, email: u.email, reason: "off-track", detail: u.perWeek });
  }
  const rank = { fast: 0, "hard-week": 1, "trial-ending": 2, slipping: 3, "off-track": 4 } as const;
  attention.sort((a, b) => rank[a.reason] - rank[b.reason]);

  const new7 = users.filter((u) => age(u.createdAt) >= 0 && age(u.createdAt) < 7).length;
  const new7Prev = users.filter((u) => age(u.createdAt) >= 7 && age(u.createdAt) < 14).length;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    totals: {
      users: users.length,
      accounts: users.filter((u) => !u.anonymous).length,
      anonymous: users.filter((u) => u.anonymous).length,
      new7,
      new7Prev,
      new30: users.filter((u) => age(u.createdAt) >= 0 && age(u.createdAt) < 30).length,
    },
    active: {
      dau: activeIn(today, today),
      wau: activeIn(today - 6, today),
      wauPrev: activeIn(today - 13, today - 7),
      mau: activeIn(today - 29, today),
    },
    series: {
      signups: series(30, (d) => signupDays.get(d) ?? 0),
      active: series(30, (d) => activeOn.get(d)?.size ?? 0),
    },
    retention: { d1: retention(1), d7: retention(7), d30: retention(30) },
    cohorts,
    subs: {
      status: statusCounts,
      paying: statusCounts.active ?? 0,
      trialing: statusCounts.trialing ?? 0,
      mrrMinor,
      conversion: pct(statusCounts.active ?? 0, (statusCounts.active ?? 0) + (statusCounts.canceled ?? 0) + (statusCounts.expired ?? 0) + (statusCounts.trialing ?? 0)),
    },
    engagement: {
      completion7: withHabits.length ? Math.round((withHabits.reduce((n, u) => n + (u.completion7 ?? 0), 0) / withHabits.length) * 1000) / 10 : null,
      checkIns7: recentMoods.length,
      moods7: moodCounts,
      weighIns7: users.filter((u) => u.daysSinceWeighIn !== null && u.daysSinceWeighIn < 7).length,
    },
    trajectory,
    attention: attention.slice(0, 25),
  };
}

// ------------------------------------------------------------ the user list

export type UserQuery = { q?: string; filter?: string; sort?: string; dir?: "asc" | "desc"; page?: number; perPage?: number };
export const FILTERS = ["all", "accounts", "anonymous", "paying", "trialing", "free", "active7", "inactive", "attention"] as const;
export const SORTS = ["created", "lastActive", "email", "status", "trajectory", "perWeek", "completion7"] as const;

export function queryUsers(all: Summary[], query: UserQuery, nowMs: number, attentionIds: ReadonlySet<string> = new Set()) {
  const today = dayNum(dayKey(nowMs));
  const q = (query.q ?? "").trim().toLowerCase();
  const filter = (FILTERS as readonly string[]).includes(query.filter ?? "") ? query.filter! : "all";
  const sort = (SORTS as readonly string[]).includes(query.sort ?? "") ? query.sort! : "created";
  const dir = query.dir === "asc" ? 1 : -1;
  const perPage = Math.max(10, Math.min(200, Math.floor(query.perPage ?? 50)));

  const recent = (u: Summary) => u.lastActive !== null && today - dayNum(u.lastActive) < 7;
  let rows = all.filter((u) => {
    if (q && !(u.email ?? "").toLowerCase().includes(q) && !u.id.toLowerCase().startsWith(q)) return false;
    switch (filter) {
      case "accounts": return !u.anonymous;
      case "anonymous": return u.anonymous;
      case "paying": return u.status === "active";
      case "trialing": return u.status === "trialing";
      case "free": return u.status !== "active" && u.status !== "trialing";
      case "active7": return recent(u);
      case "inactive": return !recent(u);
      case "attention": return attentionIds.has(u.id);
      default: return true;
    }
  });
  const nullsLast = (a: number | string | null, b: number | string | null) =>
    a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -dir : a > b ? dir : 0;
  const key = (u: Summary): number | string | null => {
    switch (sort) {
      case "lastActive": return u.lastActive;
      case "email": return u.email?.toLowerCase() ?? null;
      case "status": return u.status;
      case "trajectory": return TRAJECTORIES.indexOf(u.trajectory);
      case "perWeek": return u.perWeek;
      case "completion7": return u.completion7;
      default: return u.createdAt;
    }
  };
  rows = rows.sort((a, b) => nullsLast(key(a), key(b)) || a.id.localeCompare(b.id));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.max(1, Math.min(pages, Math.floor(query.page ?? 1)));
  return { total, page, pages, perPage, filter, sort, dir: dir === 1 ? "asc" : "desc", rows: rows.slice((page - 1) * perPage, page * perPage) };
}

/** Every row that shows a person used the app on a day. */
export function activityRows(raw: Raw): DateRow[] {
  return [
    ...raw.weighIns,
    ...raw.checkIns,
    ...raw.completions.filter((c) => c.done),
    ...raw.backups,
  ].map((r) => ({ userId: r.userId, date: r.date.slice(0, 10) }));
}

/** The user list as a CSV file — the columns a spreadsheet needs. Every field
 * is quoted, and a leading = + - @ is defused, so a crafted email address
 * cannot become a formula in the owner's spreadsheet. */
export function usersCsv(rows: Summary[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["id", "email", "anonymous", "created", "last_active", "active_days_30", "status", "plan", "trajectory", "kg_per_week", "last_kg", "goal_kg", "habits", "completion_7d", "recaps_7d"];
  const lines = rows.map((u) =>
    [u.id, u.email, u.anonymous, u.createdAt.slice(0, 10), u.lastActive, u.activeDays30, u.status, u.planId, u.trajectory, u.perWeek, u.lastKg, u.goalKg, u.habits, u.completion7 === null ? null : Math.round(u.completion7 * 100), u.checkIns7]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
