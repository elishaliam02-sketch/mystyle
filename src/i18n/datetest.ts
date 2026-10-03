/** The date must render on any engine, so it is formatted from our own names. */
import { formatDate, formatShortDate, formatStamp, formatTime } from "./date";
import { en } from "./en";
import { he } from "./he";

const results: [string, boolean][] = [];
const check = (name: string, pass: boolean) => results.push([name, pass]);

// 2026-08-29 is a Saturday; 2026-01-01 a Thursday.
const saturday = new Date(2026, 7, 29);
const thursday = new Date(2026, 0, 1);

const heSat = formatDate(saturday, he);
const enSat = formatDate(saturday, en);

console.log("he:", heSat);
console.log("en:", enSat);

check("Hebrew names the weekday", heSat.includes("שבת"));
check("Hebrew names the month", heSat.includes("אוגוסט"));
check("Hebrew has the day number", heSat.includes("29"));
check("English names the weekday", enSat.includes("Saturday"));
check("English names the month", enSat.includes("August"));
check("no leftover placeholders", !heSat.includes("{") && !enSat.includes("{"));
check("January maps to the first month", formatDate(thursday, he).includes("ינואר"));
check("Thursday maps correctly", formatDate(thursday, he).includes("חמישי"));

check("a short date names the weekday and day/month", formatShortDate("2026-08-29", he) === "ש׳ 29/8");
check("in English too", formatShortDate("2026-01-01", en) === "Th 1/1");
check("a broken date falls back to itself", formatShortDate("not-a-date", he) === "not-a-date");
check("time is 24-hour and padded", formatTime(new Date(2026, 0, 1, 7, 5)) === "07:05");
check("a stamp is day/month then time", formatStamp(new Date(2026, 9, 3, 21, 30)) === "3/10 21:30");

// Every day of a week must produce a distinct, non-empty label.
const week = new Set<string>();
for (let i = 0; i < 7; i++) {
  const d = new Date(2026, 7, 23 + i);
  const label = formatDate(d, he);
  check(`day ${i} renders`, label.length > 5);
  week.add(label);
}
check("seven days give seven labels", week.size === 7);

for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
