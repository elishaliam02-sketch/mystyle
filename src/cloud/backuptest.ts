/**
 * Tests for the full-state backup logic — the part that decides whether to
 * upload the device's data or restore the account's. The scenarios that matter
 * are the ones where data could be lost: a reinstall, a second device, two
 * devices edited apart.
 */
import { applyBackup, backupBundle, backupSignature, decideBackup, isEmptyBackup } from "./backup";
import { EMPTY_STATE, type AppState } from "@/store/types";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

const state = (over: Partial<AppState> = {}): AppState => ({ ...EMPTY_STATE, ...over });

// --- what goes in the bundle
{
  const s = state({
    training: { goal: "cut", days: 3, log: {}, custom: [] },
    water: { "2026-03-01": 5 },
    stepGoal: 9000,
    profile: { name: "Liam", onboarded: true },
  });
  const b = backupBundle(s);
  check("the training plan is backed up", !!b.training);
  check("water is backed up", !!b.water);
  check("the step goal is backed up", b.stepGoal === 9000);
  check("the profile is NOT in the blob (the granular sync owns it)", !("profile" in b));
  check("habits are NOT in the blob", !("habits" in b));
  check("an unset field is left out", !("intake" in b));
}

// --- first backup ever
{
  const local = backupBundle(state({ water: { "2026-03-01": 3 } }));
  const d = decideBackup({ local, localChangedAt: "2026-03-01T10:00:00Z", remote: null });
  check("with no server copy, the device uploads", d.action === "upload");
}

// --- a fresh phone restores the account
{
  const remoteBundle = backupBundle(state({ water: { "2026-03-01": 8 }, stepGoal: 12000 }));
  const d = decideBackup({
    local: {},
    localChangedAt: "1970-01-01T00:00:00.000Z",
    remote: { bundle: remoteBundle, at: "2026-03-02T09:00:00Z" },
  });
  check("an empty new device restores the server's backup", d.action === "restore");
  if (d.action === "restore") {
    const restored = applyBackup(state(), d.bundle);
    check("restoring brings the workouts and goals back", restored.stepGoal === 12000);
    check("restoring brings the water log back", (restored.water?.["2026-03-01"] ?? 0) === 8);
  }
}

// --- a device that has already seen this backup and not changed does nothing
{
  const bundle = backupBundle(state({ water: { "2026-03-01": 5 } }));
  const d = decideBackup({
    local: bundle,
    localChangedAt: "2026-03-01T10:00:00Z",
    remote: { bundle, at: "2026-03-01T10:00:00Z" },
    lastSeenAt: "2026-03-01T10:00:00Z",
  });
  check("no change and matching server → nothing to do", d.action === "none");
}

// --- local edits after the last sync are uploaded, not lost
{
  const remoteBundle = backupBundle(state({ water: { "2026-03-01": 5 } }));
  const localBundle = backupBundle(state({ water: { "2026-03-01": 9 } }));
  const d = decideBackup({
    local: localBundle,
    localChangedAt: "2026-03-02T12:00:00Z",
    remote: { bundle: remoteBundle, at: "2026-03-01T10:00:00Z" },
    lastSeenAt: "2026-03-01T10:00:00Z",
  });
  check("a local change newer than the server is uploaded", d.action === "upload");
  if (d.action === "upload") check("the upload carries the newer water", (d.bundle.water?.["2026-03-01"] ?? 0) === 9);
}

// --- a reinstall with fresh edits keeps the edits over an older server copy
{
  // local changed just now; server is older; device has never seen this server stamp
  const remoteBundle = backupBundle(state({ stepGoal: 8000 }));
  const localBundle = backupBundle(state({ stepGoal: 15000 }));
  const d = decideBackup({
    local: localBundle,
    localChangedAt: "2026-05-01T00:00:00Z",
    remote: { bundle: remoteBundle, at: "2026-04-01T00:00:00Z" },
  });
  check("fresh local edits beat an older server backup", d.action === "upload" && (d as { bundle: { stepGoal?: number } }).bundle.stepGoal === 15000);
}

// --- another device's newer backup is adopted
{
  const remoteBundle = backupBundle(state({ stepGoal: 11000 }));
  const localBundle = backupBundle(state({ stepGoal: 8000 }));
  const d = decideBackup({
    local: localBundle,
    localChangedAt: "2026-04-01T00:00:00Z",
    remote: { bundle: remoteBundle, at: "2026-04-05T00:00:00Z" },
    lastSeenAt: "2026-04-01T00:00:00Z",
  });
  check("a newer backup from another device is restored", d.action === "restore");
}

// --- applyBackup only touches the backed-up keys
{
  const before = state({ profile: { name: "Keep", onboarded: true }, habits: [{ id: "h", title: "x", createdAt: "", archived: false }] });
  const after = applyBackup(before, backupBundle(state({ stepGoal: 9000 })));
  check("restoring does not wipe the profile", after.profile.name === "Keep");
  check("restoring does not wipe habits", after.habits.length === 1);
  check("restoring sets the backed-up field", after.stepGoal === 9000);
}

// --- signature detects change
{
  check("the same bundle has the same signature",
    backupSignature({ stepGoal: 8 }) === backupSignature({ stepGoal: 8 }));
  check("a changed bundle has a different signature",
    backupSignature({ stepGoal: 8 }) !== backupSignature({ stepGoal: 9 }));
}

// --- a fresh install is recognised so it restores rather than overwrites
{
  check("a blank state is an empty backup", isEmptyBackup(backupBundle(state())));
  check("salt and a default goal alone are still empty",
    isEmptyBackup(backupBundle(state({ salt: "x", stepGoal: 8000, nutritionGoal: "cut" }))));
  check("a logged workout makes it non-empty",
    !isEmptyBackup(backupBundle(state({ training: { goal: "cut", days: 3, log: {}, custom: [] } }))));
  check("logged water makes it non-empty",
    !isEmptyBackup(backupBundle(state({ water: { "2026-03-01": 1 } }))));
  check("a pantry list makes it non-empty",
    !isEmptyBackup(backupBundle(state({ pantry: "chicken, rice" }))));
  check("an empty pantry string stays empty", isEmptyBackup(backupBundle(state({ pantry: "   " }))));
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
