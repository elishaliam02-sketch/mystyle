import { projectGoal } from "./projection";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const pts = (...rows: [string, number][]) => rows.map(([date, kg]) => ({ date, kg }));

// needs a goal, two readings and a real span
{
  check("no goal → no projection", projectGoal(pts(["2026-01-01", 90], ["2026-02-01", 86])) === null);
  check("one reading → no projection", projectGoal(pts(["2026-01-01", 90]), 80) === null);
  check("less than a week apart → no projection",
    projectGoal(pts(["2026-01-01", 90], ["2026-01-04", 89]), 80) === null);
}

// a steady loss toward a lower goal
{
  // 4 kg over 28 days = 1 kg/week; 6 kg still to go → 6 weeks
  const p = projectGoal(pts(["2026-01-01", 90], ["2026-01-29", 86]), 80);
  check("a steady loss projects", p !== null);
  check("pace is negative while losing", (p?.perWeek ?? 0) === -1, String(p?.perWeek));
  check("weeks left are computed from the pace", p?.weeksLeft === 6, String(p?.weeksLeft));
  check("kilos to go are positive", p?.toGo === 6, String(p?.toGo));
}

// order of the readings must not matter
{
  const a = projectGoal(pts(["2026-01-29", 86], ["2026-01-01", 90]), 80);
  check("unsorted readings give the same answer", a?.weeksLeft === 6, String(a?.weeksLeft));
}

// refuse to project when the trend points the wrong way
{
  const gaining = projectGoal(pts(["2026-01-01", 86], ["2026-01-29", 90]), 80);
  check("gaining while the goal is below → no projection", gaining === null);
  const losing = projectGoal(pts(["2026-01-01", 90], ["2026-01-29", 86]), 95);
  check("losing while the goal is above → no projection", losing === null);
}

// a flat month says nothing rather than dividing by zero
{
  check("no change → no projection", projectGoal(pts(["2026-01-01", 90], ["2026-02-01", 90]), 80) === null);
}

// already at the goal
{
  check("standing on the goal → no projection",
    projectGoal(pts(["2026-01-01", 84], ["2026-02-01", 80]), 80) === null);
}

// a bulk toward a higher goal projects too
{
  const p = projectGoal(pts(["2026-01-01", 70], ["2026-01-29", 72]), 76);
  check("gaining toward a higher goal projects", p !== null);
  check("pace is positive while gaining", (p?.perWeek ?? 0) > 0, String(p?.perWeek));
}

// never promises zero weeks
{
  const p = projectGoal(pts(["2026-01-01", 90], ["2026-01-29", 86]), 85.9);
  check("weeks left is at least one", (p?.weeksLeft ?? 0) >= 1, String(p?.weeksLeft));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
