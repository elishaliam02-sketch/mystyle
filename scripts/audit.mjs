/**
 * The dependency audit CI runs: `npm audit` on what ships (--omit=dev), failing
 * on any high or critical advisory — except the few listed below.
 *
 * An entry here is a decision, not a mute button. Each one names the
 * advisory, why it cannot reach a user of this app, and a date after which the
 * build fails again so the decision is made afresh. Nothing is ever excused by
 * package name: a new advisory in the same package still fails.
 *
 *     node scripts/audit.mjs
 */
import { execSync } from "node:child_process";

const EXCUSED = {
  "GHSA-86w9-cpqp-85rv": {
    until: "2026-12-31",
    why:
      "node-forge <=1.4.0 (RSA PKCS#1 v1.5 signature check). No fixed release exists yet. It arrives " +
      "through Expo's CLI and @expo/code-signing-certificates — build tooling. The app bundle carries " +
      "only its licence line, and update code signing is not configured in app.json.",
  },
};

let report;
try {
  report = JSON.parse(execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch (e) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  report = JSON.parse(e.stdout || "{}");
}
if (!report.vulnerabilities) {
  console.error("npm audit returned no report — failing rather than passing blind.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const advisories = new Map();
for (const v of Object.values(report.vulnerabilities)) {
  for (const via of v.via) {
    if (typeof via !== "object") continue;
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = (via.url ?? "").split("/").pop();
    advisories.set(id, { ...via, id });
  }
}

let failed = 0;
for (const a of advisories.values()) {
  const ok = EXCUSED[a.id];
  if (ok && today <= ok.until) {
    console.log(`EXCUSED  ${a.id} ${a.name} — ${a.title} (until ${ok.until})`);
  } else {
    failed++;
    console.log(`FAIL     ${a.id} ${a.name} (${a.severity}) — ${a.title}${ok ? ` — the excuse lapsed on ${ok.until}` : ""}`);
  }
}
for (const [id, ok] of Object.entries(EXCUSED)) {
  if (!advisories.has(id)) console.log(`NOTE     ${id} is no longer reported — remove it from scripts/audit.mjs (was until ${ok.until})`);
}
console.log(`\n${advisories.size} high/critical advisories, ${failed} failing`);
if (failed) process.exitCode = 1;
