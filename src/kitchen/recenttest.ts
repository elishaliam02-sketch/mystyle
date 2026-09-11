import { recentMeals } from "./recent";
import type { IntakeItem } from "@/store/types";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const M = (label: string, kcal: number, protein = 0, id = label): IntakeItem => ({ id, label, kcal, protein });

// ---- the basics
{
  const intake = {
    "2026-03-01": [M("קפה", 40, 2), M("ביצים", 160, 12)],
    "2026-03-02": [M("קפה", 40, 2)],
    "2026-03-03": [M("קפה", 40, 2), M("סלט", 220, 8)],
  };
  const r = recentMeals(intake, "2026-03-10");
  check("distinct meals are collapsed", r.length === 3, String(r.length));
  check("the thing eaten most is first", r[0]!.label === "קפה", r[0]!.label);
  check("and carries how many days it was eaten", r[0]!.count === 3, String(r[0]!.count));
  check("a once-eaten meal counts once", r.find((m) => m.label === "סלט")!.count === 1);
  check("calories are carried through", r[0]!.kcal === 40);
}

// ---- today is excluded
{
  const intake = {
    "2026-03-01": [M("קפה", 40)],
    "2026-03-10": [M("קפה", 40), M("עוגה", 400)],
  };
  const r = recentMeals(intake, "2026-03-10");
  check("today's own meals are not offered back",
    r.every((m) => m.label !== "עוגה"), JSON.stringify(r.map((m) => m.label)));
  check("but the same meal on an earlier day still is", r.some((m) => m.label === "קפה"));
}

// ---- same name, different calories is not the same meal
{
  const intake = {
    "2026-03-01": [M("סנדוויץ", 300)],
    "2026-03-02": [M("סנדוויץ", 500)],
  };
  const r = recentMeals(intake, "2026-03-10");
  check("a name at two calorie counts is two meals", r.length === 2, String(r.length));
}

// ---- ordering: often beats recent
{
  const intake = {
    "2026-03-01": [M("שייק", 250)],
    "2026-03-02": [M("שייק", 250)],
    "2026-03-09": [M("פיצה", 800)],
  };
  const r = recentMeals(intake, "2026-03-10");
  check("eaten-twice-long-ago beats eaten-once-yesterday",
    r[0]!.label === "שייק", r[0]!.label);
}

// ---- the limit
{
  const intake: Record<string, IntakeItem[]> = {};
  for (let i = 1; i <= 20; i++) intake[`2026-02-${String(i).padStart(2, "0")}`] = [M(`מאכל ${i}`, 100 + i)];
  check("the list is capped", recentMeals(intake, "2026-03-10", 8).length === 8);
  check("a zero limit yields nothing", recentMeals(intake, "2026-03-10", 0).length === 0);
}

// ---- adversarial: nothing may throw, nothing may return a poisoned number
{
  check("no diary yields nothing", recentMeals(undefined, "2026-03-10").length === 0);
  check("an empty diary yields nothing", recentMeals({}, "2026-03-10").length === 0);
  const nasty = {
    "2026-03-01": [
      { id: "a", label: "", kcal: 100, protein: 5 },
      { id: "b", label: "   ", kcal: 100, protein: 5 },
      { id: "c", label: "טוב", kcal: NaN, protein: Infinity },
    ] as IntakeItem[],
    "2026-03-02": null as unknown as IntakeItem[],
    "bad-date": [M("שדה", 50)],
  };
  const r = recentMeals(nasty, "2026-03-10");
  check("blank names are dropped", r.every((m) => m.label.trim().length > 0));
  check("a NaN calorie becomes zero, never NaN",
    r.every((m) => Number.isFinite(m.kcal) && Number.isFinite(m.protein)), JSON.stringify(r));
  check("a non-array day does not crash it", true);
  check("every count is a positive whole number",
    r.every((m) => Number.isInteger(m.count) && m.count >= 1));
  // __proto__ as a label must not pollute anything
  const proto = { "2026-03-01": [M("__proto__", 10)] };
  check("a __proto__ label is just a string", recentMeals(proto, "2026-03-10").length === 1);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
