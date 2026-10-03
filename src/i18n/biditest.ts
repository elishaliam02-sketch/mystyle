import { isolateDeep, isolateRanges } from "./bidi";
import { fill } from "./fill";
import { stepMinutes } from "../kitchen/recipes";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);
const L = "⁦", P = "⁩";

check("a range in Hebrew is held in reading order", isolateRanges("יעד 8–12 חזרות") === `יעד ${L}8–12${P} חזרות`);
check("decimals and spaces around the dash", isolateRanges("מומלץ 2.5 – 3.3 ליטר") === `מומלץ ${L}2.5–3.3${P} ליטר`);
check("English is left alone", isolateRanges("8–12 reps") === "8–12 reps");
check("a date with hyphens is left alone", isolateRanges("בתוקף מ־2026-09-23") === "בתוקף מ־2026-09-23");
check("never wrapped twice", isolateRanges(isolateRanges("8–12 חזרות")) === `${L}8–12${P} חזרות`);
check("fill keeps a range made by the template in order", fill("טווח בריא: {min}–{max} ק״ג", { min: 52, max: 76 }) === `טווח בריא: ${L}52–76${P} ק״ג`);
check("fill in English is unchanged", fill("Healthy: {min}–{max} kg", { min: 52, max: 76 }) === "Healthy: 52–76 kg");
check("every string of a nested object", isolateDeep({ a: ["3–4 דקות"], b: { c: "1–2 כפות" } }).b.c === `${L}1–2${P} כפות`);
check("the step timer still reads a range", stepMinutes(isolateRanges("מבשלים 5–6 דקות")) === 6);
check("and a plain number", stepMinutes("אופים 20 דקות") === 20);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
