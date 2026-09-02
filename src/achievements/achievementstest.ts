import { computeAchievements, unlockedCount, type Achievement } from "./index";
import { EMPTY_STATE, type AppState } from "@/store/types";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const get = (list: Achievement[], id: string) => list.find((a) => a.id === id)!;

function stateWith(patch: Partial<AppState>): AppState {
  return { ...EMPTY_STATE, ...patch };
}

const comp = (habitId: string, date: string, done = true) => ({
  habitId,
  date,
  done,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

// empty state unlocks nothing but still lists every badge
{
  const a = computeAchievements(EMPTY_STATE);
  check("empty state lists all badges", a.length === 16, String(a.length));
  check("empty state unlocks none", unlockedCount(a) === 0, String(unlockedCount(a)));
  check("every badge has a positive target", a.every((x) => x.target > 0));
  check("progress never exceeds target", a.every((x) => x.progress <= x.target));
}

// first tick unlocks the first badge
{
  const a = computeAchievements(stateWith({ completions: [comp("h1", "2026-01-01")] }));
  check("one tick unlocks first-tick", get(a, "first-tick").unlocked);
  check("one tick does not unlock ticks-50", !get(a, "ticks-50").unlocked);
  check("first-tick reads as bronze", get(a, "first-tick").tier === "bronze");
}

// unticked completions do not count
{
  const a = computeAchievements(stateWith({ completions: [comp("h1", "2026-01-01", false)] }));
  check("an unticked completion earns nothing", !get(a, "first-tick").unlocked);
}

// a seven-day run on one habit unlocks streak-7
{
  const dates = ["01", "02", "03", "04", "05", "06", "07"].map((d) => comp("h1", `2026-01-${d}`));
  const a = computeAchievements(stateWith({ completions: dates }));
  check("seven consecutive days unlock streak-7", get(a, "streak-7").unlocked);
  check("seven days do not unlock streak-30", !get(a, "streak-30").unlocked);
  check("streak progress is 7", get(a, "streak-7").progress === 7, String(get(a, "streak-7").progress));
}

// a gap breaks the run
{
  const dates = ["01", "02", "03", "05", "06", "07", "08"].map((d) => comp("h1", `2026-01-${d}`));
  const a = computeAchievements(stateWith({ completions: dates }));
  check("a gap keeps the run under 7", !get(a, "streak-7").unlocked,
    String(get(a, "streak-7").progress));
}

// two separate habits do not merge into one streak
{
  const a = computeAchievements(
    stateWith({
      completions: [
        ...["01", "02", "03", "04"].map((d) => comp("h1", `2026-01-${d}`)),
        ...["05", "06", "07"].map((d) => comp("h2", `2026-01-${d}`)),
      ],
    }),
  );
  check("streaks are per-habit, not merged", get(a, "streak-7").progress === 4,
    String(get(a, "streak-7").progress));
}

// training log drives workout badges
{
  const a = computeAchievements(
    stateWith({
      training: { goal: "recomp", days: 3, log: { "2026-01-01": ["squat", "bench-press"] }, custom: [] },
    }),
  );
  check("a logged day unlocks first-workout", get(a, "first-workout").unlocked);
  check("empty day would not count", get(a, "first-workout").progress === 1);
}

// a custom move unlocks own-move; gold tier on the big targets
{
  const a = computeAchievements(
    stateWith({
      training: {
        goal: "bulk",
        days: 4,
        log: {},
        custom: [{ id: "x", he: "", en: "", muscle: "core", equipment: "bodyweight", compound: false, howHe: [], howEn: [], yt: "x" }],
      },
    }),
  );
  check("adding a move unlocks own-move", get(a, "own-move").unlocked);
  check("workouts-100 is a gold badge", get(a, "workouts-100").tier === "gold");
}

// weight loss toward a cut
{
  const a = computeAchievements(
    stateWith({
      profile: { name: "", onboarded: true, startKg: 90, updatedAt: "2026-01-01T00:00:00.000Z" },
      weighIns: [
        { date: "2026-01-01", kg: 90, updatedAt: "2026-01-01T00:00:00.000Z" },
        { date: "2026-02-01", kg: 86, updatedAt: "2026-02-01T00:00:00.000Z" },
      ],
    }),
  );
  check("losing 4 kg unlocks weight-down-3", get(a, "weight-down-3").unlocked,
    String(get(a, "weight-down-3").progress));
  check("two weigh-ins do not yet unlock weigh-in-4", !get(a, "weigh-in-4").unlocked);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
