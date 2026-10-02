import {
  activityRows,
  dashboard,
  queryUsers,
  readTrajectory,
  summarize,
  usersCsv,
  type Raw,
} from "../../supabase/functions/_shared/adminMetrics";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const NOW = Date.parse("2026-10-02T10:00:00Z");
const ago = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);
const at = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const raw: Raw = {
  users: [
    { id: "a", email: "ana@x.com", createdAt: at(40), lastSignInAt: at(1), anonymous: false },
    { id: "b", email: "ben@x.com", createdAt: at(20), lastSignInAt: at(15), anonymous: false },
    { id: "c", email: null, createdAt: at(3), lastSignInAt: at(3), anonymous: true },
    { id: "d", email: "dan@x.com", createdAt: at(10), lastSignInAt: at(0), anonymous: false },
    { id: "e", email: "=cmd|calc@x.com", createdAt: at(0), lastSignInAt: at(0), anonymous: false },
  ],
  subs: [
    { userId: "a", status: "active", planId: "monthly", currentPeriodEnd: at(-20), trialEndsAt: null, stripe: true },
    { userId: "d", status: "trialing", planId: "yearly", currentPeriodEnd: null, trialEndsAt: at(-2), stripe: true },
    { userId: "b", status: "active", planId: "yearly", currentPeriodEnd: at(-200), trialEndsAt: null, stripe: true },
  ],
  weighIns: [
    { userId: "a", date: ago(30), kg: 90 }, { userId: "a", date: ago(16), kg: 88.5 }, { userId: "a", date: ago(2), kg: 87 },
    { userId: "d", date: ago(10), kg: 80 }, { userId: "d", date: ago(1), kg: 76 },
    { userId: "b", date: ago(20), kg: 70 }, { userId: "b", date: ago(12), kg: 71 },
  ],
  checkIns: [
    { userId: "a", date: ago(1), mood: "good" },
    { userId: "d", date: ago(1), mood: "hard" }, { userId: "d", date: ago(3), mood: "hard" },
  ],
  habits: [{ userId: "a", archived: false }, { userId: "a", archived: false }, { userId: "d", archived: false }, { userId: "d", archived: true }],
  completions: [
    ...Array.from({ length: 7 }, (_, i) => ({ userId: "a", date: ago(i), done: true })),
    { userId: "a", date: ago(0), done: false },
    { userId: "d", date: ago(0), done: true },
  ],
  profiles: [{ id: "a", goalKg: 80 }, { id: "b", goalKg: 65 }, { id: "d", goalKg: 70 }],
  backups: [{ userId: "b", date: ago(15) }, { userId: "c", date: ago(3) }],
};

const all = summarize(raw, NOW);
const by = (id: string) => all.find((u) => u.id === id)!;
check("one summary per user", all.length === 5);
check("last activity is the latest of any kind", by("a").lastActive === ago(0) && by("b").lastActive === ago(12), `${by("a").lastActive} ${by("b").lastActive}`);
check("never used it: no last activity", by("e").lastActive === null);
check("a steady loser toward the goal is on track", by("a").trajectory === "on-track", by("a").trajectory);
check("4 kg in 9 days is flagged as fast", by("d").trajectory === "fast", String(by("d").perWeek));
check("gaining with a lower goal is off track", by("b").trajectory === "off-track");
check("completion counts done habit-days only", by("a").completion7 !== null && Math.abs(by("a").completion7! - 7 / 14) < 1e-9, String(by("a").completion7));
check("archived habits are not counted", by("d").habits === 1);
check("no habits: no completion rate", by("c").completion7 === null);
check("hard recaps this week are counted", by("d").hard7 === 2);

const dash = dashboard(all, activityRows(raw), raw.checkIns, NOW);
check("totals", dash.totals.users === 5 && dash.totals.anonymous === 1 && dash.totals.accounts === 4);
check("new this week, and the week before", dash.totals.new7 === 2 && dash.totals.new7Prev === 1, `${dash.totals.new7}/${dash.totals.new7Prev}`);
check("daily actives today", dash.active.dau === 2, String(dash.active.dau));
check("weekly actives", dash.active.wau === 3, String(dash.active.wau));
check("30-day series end today", dash.series.signups.length === 30 && dash.series.signups[29]!.date === ago(0) && dash.series.signups[29]!.n === 1);
check("activity series counts people, not rows", dash.series.active[29]!.n === 2, String(dash.series.active[29]!.n));
check("day-7 retention counts only those old enough", dash.retention.d7.eligible === 3 && dash.retention.d7.retained === 3, JSON.stringify(dash.retention.d7));
check("day-30 retention", dash.retention.d30.eligible === 1 && dash.retention.d30.retained === 1);
check("MRR: a monthly plus a twelfth of a yearly", dash.subs.mrrMinor === 2990 + 2075, String(dash.subs.mrrMinor));
check("trialing is not revenue", dash.subs.trialing === 1 && dash.subs.paying === 2);
check("moods of the week", dash.engagement.moods7.good === 1 && dash.engagement.moods7.hard === 2);
check("eight weekly cohorts, oldest first", dash.cohorts.length === 8 && dash.cohorts[7]!.weekStart === ago(6));
const reasons = dash.attention.map((a) => `${a.id}:${a.reason}`);
check("a too-fast loss is the first thing to look at", reasons[0] === "d:fast", reasons.join(" "));
check("a hard week is flagged", reasons.includes("d:hard-week"));
check("a trial ending in two days is flagged", reasons.includes("d:trial-ending"));
check("someone who stopped coming is flagged as slipping", reasons.includes("b:slipping"), reasons.join(" "));
check("the happy, active user is not on the list", !reasons.some((r) => r.startsWith("a:")));

// The list: search, filters, sort, pages.
check("search by email", queryUsers(all, { q: "BEN" }, NOW).rows.map((u) => u.id).join() === "b");
check("search by id prefix", queryUsers(all, { q: "c" }, NOW).rows.some((u) => u.id === "c"));
check("paying filter", queryUsers(all, { filter: "paying" }, NOW).total === 2);
check("anonymous filter", queryUsers(all, { filter: "anonymous" }, NOW).rows.map((u) => u.id).join() === "c");
check("active this week", queryUsers(all, { filter: "active7" }, NOW).total === 3, String(queryUsers(all, { filter: "active7" }, NOW).total));
check("needs attention uses the dashboard's list", queryUsers(all, { filter: "attention" }, NOW, new Set(dash.attention.map((a) => a.id))).total === 2);
check("newest first by default", queryUsers(all, {}, NOW).rows[0]!.id === "e");
check("sort by last active, nulls last", queryUsers(all, { sort: "lastActive", dir: "desc" }, NOW).rows.at(-1)!.id === "e");
const paged = queryUsers(all, { perPage: 10, page: 9 }, NOW);
check("a page past the end clamps to the last", paged.page === 1 && paged.pages === 1);
check("an unknown filter or sort falls back", queryUsers(all, { filter: "drop table", sort: "x" }, NOW).total === 5);

// CSV
const csv = usersCsv(all);
check("CSV has a header and a line per user", csv.split("\n").length === 6 && csv.startsWith("id,email"));
check("a formula in an email is defused", csv.includes(`"'=cmd|calc@x.com"`), csv.split("\n").find((l) => l.includes("cmd")));
check("quotes are escaped", usersCsv([{ ...all[0]!, email: 'a"b@x.com' }]).includes('"a""b@x.com"'));

check("trajectory needs a week of span", readTrajectory([{ date: ago(3), kg: 80 }, { date: ago(0), kg: 79 }], 70, NOW).trajectory === "no-data");

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
