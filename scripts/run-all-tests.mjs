/**
 * Runs every unit suite, discovered rather than listed.
 *
 *     npm test
 *
 * The list used to live in the CI workflow, which meant a new suite was only
 * covered if whoever added it remembered to edit a YAML file in another
 * directory — and twice it was not. Discovery removes the chance: anything
 * matching `scripts/run-*-tests.mjs` runs, and a suite with no npm script of
 * its own is reported rather than skipped silently.
 *
 * This file is itself called `run-all-tests.mjs`, which matches the pattern it
 * searches for — so without a guard it discovers itself, spawns itself, and
 * every copy spawns another. That is not hypothetical: it happened, and there
 * were a thousand processes inside a minute. Hence two independent guards, because
 * one that a rename defeats is not a guard: skip this file by name, and refuse
 * to start at all when already inside a run.
 *
 * The end-to-end suite is deliberately excluded — it needs a browser and a
 * built bundle, so CI runs it as its own step after the web export.
 */
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

if (process.env.APEX_TEST_RUNNER === "1") {
  console.error("run-all-tests.mjs refuses to run inside itself.");
  process.exit(1);
}

const SELF = path.basename(new URL(import.meta.url).pathname);

const scripts = (await readdir("scripts"))
  .filter((file) => file !== SELF)
  .map((file) => /^run-(.+)-tests\.mjs$/.exec(file))
  .filter((match) => match !== null)
  .map((match) => ({ file: `scripts/${match[0]}`, name: match[1] }))
  .filter((suite) => suite.name !== "all")
  .sort((a, b) => a.name.localeCompare(b.name));

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const wired = new Set(
  Object.entries(pkg.scripts ?? {})
    .filter(([key]) => key.startsWith("test:"))
    .map(([, value]) => value.replace("node ", "").trim()),
);

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [file], {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, APEX_TEST_RUNNER: "1" },
    });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
      process.stdout.write(chunk);
    });
    child.on("close", (code) => resolve({ code, out }));
  });

const failures = [];
const unwired = [];
let assertions = 0;

for (const suite of scripts) {
  if (!wired.has(suite.file)) unwired.push(suite.name);
  console.log(`\n── ${suite.name}`);
  const { code, out } = await run(suite.file);
  const tally = /(\d+)\/(\d+) passed/.exec(out);
  if (tally) assertions += Number(tally[2]);
  if (code !== 0) failures.push(suite.name);
}

console.log(`\n${scripts.length} suites · ${assertions} assertions`);
if (unwired.length) {
  console.log(`suites with no npm script (wire them up): ${unwired.join(", ")}`);
}
if (failures.length) {
  console.log(`FAILED: ${failures.join(", ")}`);
  process.exitCode = 1;
}
