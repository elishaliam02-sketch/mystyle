import { BODY_PARTS, isStorableCm, measureChange, type Reading } from "./index";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

// the parts list is stable and unique
{
  check("six parts are tracked", BODY_PARTS.length === 6, String(BODY_PARTS.length));
  check("parts are unique", new Set(BODY_PARTS).size === BODY_PARTS.length);
}

// range guard
{
  check("a normal waist is storable", isStorableCm(84));
  check("zero is rejected", !isStorableCm(0));
  check("an absurd value is rejected", !isStorableCm(5000));
  check("NaN is rejected", !isStorableCm(Number.NaN));
}

// empty series
{
  const c = measureChange([]);
  check("empty series has no latest", c.latest === null && c.count === 0);
  check("empty series has zero delta", c.delta === 0);
}

// change is earliest → latest, regardless of insertion order
{
  const series: Reading[] = [
    { date: "2026-02-01", cm: 88 },
    { date: "2026-01-01", cm: 92 },
    { date: "2026-03-01", cm: 85 },
  ];
  const c = measureChange(series);
  check("latest is the most recent date", c.latest === 85, String(c.latest));
  check("first is the earliest date", c.first === 92, String(c.first));
  check("a shrinking waist reads negative", c.delta === -7, String(c.delta));
  check("count reflects all readings", c.count === 3);
}

// a single reading has no change yet
{
  const c = measureChange([{ date: "2026-01-01", cm: 40 }]);
  check("one reading: latest equals first", c.latest === 40 && c.first === 40);
  check("one reading: zero delta", c.delta === 0);
}

// rounding to one decimal
{
  const c = measureChange([
    { date: "2026-01-01", cm: 40.0 },
    { date: "2026-02-01", cm: 41.25 },
  ]);
  check("delta rounds to one decimal", c.delta === 1.3, String(c.delta));
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
