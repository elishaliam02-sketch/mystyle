// The SQL that puts a signed-up person into the installed app's storage, so
// the device test starts where a real user does after onboarding — the same
// state the web e2e suite seeds. AsyncStorage on Android is the SQLite table
// catalystLocalStorage in the RKStorage database.
import fs from "node:fs";

const LEGAL_VERSION = Number(/version:\s*(\d+)/.exec(fs.readFileSync("src/legal/config.ts", "utf8"))[1]);
const now = new Date().toISOString();
const state = {
  legal: { version: LEGAL_VERSION, acceptedAt: now },
  consent: { cloud: false, ai: false, updatedAt: now },
  profile: { name: "טסט", onboarded: true, startKg: 80, heightCm: 178, updatedAt: "1970-01-01T00:00:00.000Z" },
  habits: [],
  completions: [],
  weighIns: [],
  checkIns: [],
  pantry: "",
  salt: "device-salt",
  nutritionGoal: "cut",
  dietFilter: "all",
};
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const row = (k, v) => `INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (${q(k)}, ${q(v)});`;
process.stdout.write(
  [
    // version 1 is what React Native's storage helper expects; without it the
    // helper would try to create the table again on a database made here.
    "PRAGMA user_version = 1;",
    "CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    row("mystyle.state.v1", JSON.stringify(state)),
    row("mystyle.locale", "he"),
  ].join("\n") + "\n",
);
