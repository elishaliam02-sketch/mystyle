import { buildExport, exportFilename, serializeExport } from "./export";
import { LEGAL } from "./config";
import { EMPTY_STATE, type AppState } from "@/store/types";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const state: AppState = {
  ...EMPTY_STATE,
  profile: { name: "Dan", onboarded: true, startKg: 88, updatedAt: "2026-01-01T00:00:00.000Z" },
  habits: [{ id: "h1", title: "Run 10 km", createdAt: "2026-09-01", archived: false, updatedAt: "2026-09-01T00:00:00.000Z" }],
  completions: [{ habitId: "h1", date: "2026-09-01", done: true, updatedAt: "2026-09-01T00:00:00.000Z" }],
  pantry: "chicken, rice",
  water: { "2026-09-01": 6 },
  consent: { cloud: true, ai: false, photos: true, updatedAt: "2026-09-01T00:00:00.000Z" },
  legal: { version: LEGAL.version, acceptedAt: "2026-09-01T00:00:00.000Z" },
};

// the copy is complete — a partial one is worse than none, because the person
// cannot tell what was left out
{
  const out = buildExport(state, { email: "dan@example.com", now: "2026-09-09T10:00:00.000Z" });
  const keys = Object.keys(state).sort().join(",");
  check("every stored field is in the export", Object.keys(out.data).sort().join(",") === keys, keys);
  check("the habits come with it", out.data.habits.length === 1);
  check("so do the ticks", out.data.completions.length === 1);
  check("and the device-only fields", out.data.pantry === "chicken, rice" && !!out.data.water);
  check("consent choices are part of the record", out.data.consent?.cloud === true);
}

// the header says what the file is, without needing this codebase to read it
{
  const out = buildExport(state, { email: "dan@example.com", now: "2026-09-09T10:00:00.000Z" });
  check("the export names the app", out.meta.app === LEGAL.appName);
  check("it carries the time it was taken", out.meta.exportedAt === "2026-09-09T10:00:00.000Z");
  check("it records the documents version in force", out.meta.legalVersion === LEGAL.version);
  check("it names the account", out.meta.account === "dan@example.com");
  check("it explains what photos are", out.meta.note.toLowerCase().includes("photos"));
}

// a local-only install exports too, with no account attached
{
  const out = buildExport(EMPTY_STATE);
  check("a local-only export has no account", out.meta.account === null);
  check("an empty state still produces a valid file", typeof serializeExport(out) === "string");
}

// the file survives a round trip, which is the whole point of portability
{
  const out = buildExport(state, { now: "2026-09-09T10:00:00.000Z" });
  const text = serializeExport(out);
  const back = JSON.parse(text);
  check("the export is valid JSON", back.data.habits[0].title === "Run 10 km");
  check("it is written for a human to read", text.includes("\n  "), text.slice(0, 40));
}

// a filename someone can find again
{
  const name = exportFilename(new Date(Date.UTC(2026, 8, 9, 12)));
  check("the filename carries the date", name.includes("2026-09-09"), name);
  check("the filename is a .json", name.endsWith(".json"), name);
  check("the filename has no spaces or slashes", !/[\s/\\]/.test(name), name);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
