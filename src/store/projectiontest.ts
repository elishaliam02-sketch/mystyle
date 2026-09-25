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
  check("weeks left are computed from the pace", p?.kind === "toward" && p.weeksLeft === 6, JSON.stringify(p));
  check("kilos to go are positive", p?.toGo === 6, String(p?.toGo));
}

// order of the readings must not matter
{
  const a = projectGoal(pts(["2026-01-29", 86], ["2026-01-01", 90]), 80);
  check("unsorted readings give the same answer", a?.kind === "toward" && a.weeksLeft === 6, JSON.stringify(a));
}

// refuse to project when the trend points the wrong way
{
  const gaining = projectGoal(pts(["2026-01-01", 86], ["2026-01-29", 90]), 80);
  check("gaining while the goal is below → 'moving away', no ETA", gaining?.kind === "away");
  const losing = projectGoal(pts(["2026-01-01", 90], ["2026-01-29", 86]), 95);
  check("losing while the goal is above → 'moving away', no ETA", losing?.kind === "away");
}

// a flat month says nothing rather than dividing by zero
{
  check("no change → a plateau, no ETA", projectGoal(pts(["2026-01-01", 90], ["2026-02-01", 90]), 80)?.kind === "plateau");
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
  const p = projectGoal(pts(["2026-01-01", 90], ["2026-01-29", 86]), 85.4);
  check("weeks left is at least one", p?.kind === "toward" && p.weeksLeft >= 1, JSON.stringify(p));
  check("within half a kilo of the goal is being there", projectGoal(pts(["2026-01-01", 90], ["2026-01-29", 86]), 85.8) === null);
}

// the recent weeks decide, not the first reading ever
{
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
  const lossThenFlat = [
    ...Array.from({ length: 30 }, (_, i) => ({ date: day(i), kg: 92 - i * 0.12 })),
    ...Array.from({ length: 28 }, (_, i) => ({ date: day(31 + i), kg: 88.4 + (i % 3 === 0 ? 0.3 : -0.2) })),
  ];
  check("a month flat after a loss is a plateau, not 34 weeks", projectGoal(lossThenFlat, 80)?.kind === "plateau",
    JSON.stringify(projectGoal(lossThenFlat, 80)));
  const regain = [
    ...Array.from({ length: 30 }, (_, i) => ({ date: day(i), kg: 92 - i * 0.2 })),
    ...Array.from({ length: 21 }, (_, i) => ({ date: day(31 + i), kg: 86 + i * 0.13 })),
  ];
  check("a regain in the last weeks reads as moving away", projectGoal(regain, 80)?.kind === "away",
    JSON.stringify(projectGoal(regain, 80)));
  const slow = projectGoal(pts(["2026-01-01", 90], ["2026-03-01", 89.8]), 70);
  check("a crawl never promises 849 weeks", slow?.kind === "plateau", JSON.stringify(slow));
  const base = [...lossThenFlat.slice(0, 30)];
  const a = projectGoal([...base, { date: day(30), kg: 88.0 }], 80);
  const b = projectGoal([...base, { date: day(30), kg: 89.2 }], 80);
  check("one heavy morning barely moves the ETA",
    a?.kind === "toward" && b?.kind === "toward" && Math.abs(a.weeksLeft - b.weeksLeft) <= 6, `${JSON.stringify(a)} ${JSON.stringify(b)}`);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
