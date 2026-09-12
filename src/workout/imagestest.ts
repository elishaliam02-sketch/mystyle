import { EXERCISE_IMAGE, exerciseImage } from "./images";
import { EXERCISES } from "./exercises";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const ids = new Set(EXERCISES.map((e) => e.id));

check("every mapped id is a real exercise",
  Object.keys(EXERCISE_IMAGE).every((id) => ids.has(id)),
  Object.keys(EXERCISE_IMAGE).filter((id) => !ids.has(id)).join(", "));

check("a good share of the library has a real photo",
  Object.keys(EXERCISE_IMAGE).length >= 140, String(Object.keys(EXERCISE_IMAGE).length));

check("every image url is https on the pinned CDN",
  Object.values(EXERCISE_IMAGE).every((u) => u.startsWith("https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/")),
  Object.values(EXERCISE_IMAGE).find((u) => !u.startsWith("https://cdn.jsdelivr.net")) ?? "");

check("every url ends in a jpg", Object.values(EXERCISE_IMAGE).every((u) => u.endsWith(".jpg")));

check("no two exercises point at the identical photo more than a little",
  // some sharing is fine (a variant), but a wholesale collision means a bad map
  new Set(Object.values(EXERCISE_IMAGE)).size >= Object.keys(EXERCISE_IMAGE).length * 0.8,
  `${new Set(Object.values(EXERCISE_IMAGE)).size} distinct of ${Object.keys(EXERCISE_IMAGE).length}`);

check("a known lift resolves to a photo", exerciseImage("bench-press") !== null);
check("an unmapped id resolves to null, not undefined", exerciseImage("no-such-exercise") === null);
check("the cardio moves without an honest photo fall back",
  exerciseImage("swimming") === null || exerciseImage("burpee") === null);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
