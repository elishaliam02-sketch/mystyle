/**
 * Tests for the full-state backup logic — the part that decides whether to
 * upload the device's data or restore the account's. The scenarios that matter
 * are the ones where data could be lost: a reinstall, a second device, two
 * devices edited apart.
 */
import { applyBackup, backupBundle, backupSignature, combineBoth, decideBackup, isEmptyBackup } from "./backup";
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

// --- the device-only profile facts travel with the backup
{
  const phone = state({ profile: { name: "A", onboarded: true, heightCm: 168, sex: "female", birthYear: 1990 } });
  const blob = backupBundle(phone);
  check("height, sex and birth year are in the backup", blob.profileExtras?.heightCm === 168 && blob.profileExtras?.sex === "female" && blob.profileExtras?.birthYear === 1990);
  const fresh = applyBackup(state({ profile: { name: "A", onboarded: true } }), blob);
  check("a new phone gets them back", fresh.profile.heightCm === 168 && fresh.profile.sex === "female" && fresh.profile.birthYear === 1990);
  const typed = applyBackup(state({ profile: { name: "A", onboarded: true, heightCm: 170 } }), blob);
  check("what this phone already has is not overwritten", typed.profile.heightCm === 170 && typed.profile.sex === "female");
  const junk = applyBackup(state({ profile: { name: "A", onboarded: true } }), { profileExtras: { heightCm: 9999, sex: "x", birthYear: 1066 } } as never);
  check("nonsense in a backup is refused", junk.profile.heightCm === undefined && junk.profile.sex === undefined && junk.profile.birthYear === undefined);
  check("no facts, no extras", backupBundle(state()).profileExtras === undefined);
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

// --- a malformed blob from the server restores only what has the right shape
{
  const local = state({ water: { "2026-01-01": 3 }, waterGoal: 8, favorites: ["tuna"] });
  const bad = {
    water: "lots",
    waterGoal: "eight",
    favorites: [1, 2],
    training: null,
    pantry: "eggs, rice",
    stepGoal: 9000,
  } as unknown as Parameters<typeof applyBackup>[1];
  const out = applyBackup(local, bad);
  check("a wrong-typed value keeps the device's own", out.water?.["2026-01-01"] === 3 && out.waterGoal === 8, JSON.stringify(out.water));
  check("an array of the wrong things is refused", out.favorites?.[0] === "tuna");
  check("null is not restored over an object", out.training === local.training);
  check("the well-formed keys in the same blob still restore", out.pantry === "eggs, rice" && out.stepGoal === 9000);
  check("a blob that is not an object restores nothing", applyBackup(local, "x" as unknown as Parameters<typeof applyBackup>[1]) === local);
  const proto = JSON.parse('{"__proto__": {"polluted": true}, "salt": "s1"}');
  const p2 = applyBackup(local, proto);
  check("__proto__ in a blob is ignored", !("polluted" in ({} as object)) && p2.salt === "s1");
}

// --- two devices: restoring keeps what only this one has
{
  const item = (id: string) => ({ id, label: id, kcal: 100, protein: 5 });
  const rec = (id: string, at: number) => ({ id, date: "2026-03-0" + id.slice(-1), day: 0, dayType: "push", startedAt: at,
    durationSec: 1800, volumeKg: 1000, sets: 9, exercises: 3, prs: 0, kcal: 150 });
  const local = state({
    intake: { "2026-03-02": [item("phone-lunch")], "2026-03-01": [item("phone-old")] },
    waterMl: { "2026-03-02": 1500 },
    steps: { "2026-03-02": 7000 },
    measurements: { waist: [{ date: "2026-03-02", cm: 88 }] },
    training: {
      goal: "cut", days: 3, log: { "2026-03-02": ["squat"] }, custom: [{ id: "own-a" } as never],
      history: [rec("w2", 2)] as never, weights: { squat: [{ date: "2026-03-02", kg: 80 }] },
      active: { startedAt: 99, day: 1 } as never,
    },
  });
  const remote = backupBundle(state({
    intake: { "2026-03-01": [item("web-breakfast")] },
    waterMl: { "2026-03-01": 2000 },
    steps: { "2026-03-01": 9000 },
    measurements: { waist: [{ date: "2026-03-01", cm: 89 }], arm: [{ date: "2026-03-01", cm: 35 }] },
    training: {
      goal: "bulk", days: 4, log: { "2026-03-01": ["bench-press"] }, custom: [{ id: "own-b" } as never],
      history: [rec("w1", 1)] as never, weights: { squat: [{ date: "2026-03-01", kg: 75 }] },
    },
  }));
  const out = applyBackup(local, remote);
  check("a day only this device logged survives a restore", out.intake?.["2026-03-02"]?.[0]?.id === "phone-lunch");
  check("a day both have takes the backup's version", out.intake?.["2026-03-01"]?.[0]?.id === "web-breakfast");
  check("water from both devices is kept", out.waterMl?.["2026-03-01"] === 2000 && out.waterMl?.["2026-03-02"] === 1500);
  check("steps from both devices are kept", out.steps?.["2026-03-01"] === 9000 && out.steps?.["2026-03-02"] === 7000);
  check("measurements merge by date and part",
    out.measurements?.waist?.length === 2 && out.measurements?.waist?.[0]?.date === "2026-03-01" && out.measurements?.arm?.length === 1);
  check("the plan's settings come from the backup", out.training?.goal === "bulk" && out.training?.days === 4);
  check("workout days from both are kept", !!out.training?.log["2026-03-01"] && !!out.training?.log["2026-03-02"]);
  check("sessions from both are kept, oldest first",
    out.training?.history?.map((r) => r.id).join() === "w1,w2", out.training?.history?.map((r) => r.id).join());
  check("lifted weights from both are kept", out.training?.weights?.squat?.length === 2);
  check("own exercises from both are kept", out.training?.custom.length === 2);
  check("a workout running on this phone is not ended by a restore", (out.training?.active as { startedAt?: number })?.startedAt === 99);
  const again = applyBackup(out, remote);
  check("restoring the same backup twice changes nothing more", JSON.stringify(again) === JSON.stringify(out));
}

// --- both devices changed: the newer one uploads with the other's days folded in
{
  const item = (id: string) => ({ id, label: id, kcal: 100, protein: 5 });
  const here = state({
    intake: { "2026-03-02": [item("here-today")], "2026-03-01": [item("here-edit")] },
    training: { goal: "cut", days: 3, log: {}, custom: [], active: { startedAt: 5 } as never },
    stepGoal: 10000,
  });
  const there = backupBundle(state({
    intake: { "2026-03-01": [item("there-old")], "2026-02-28": [item("there-only")] },
    training: { goal: "bulk", days: 5, log: { "2026-02-28": ["row"] }, custom: [], active: { startedAt: 1 } as never },
    stepGoal: 6000,
  }));
  const out = combineBoth(here, there);
  check("this device's version of a shared day wins", out.intake?.["2026-03-01"]?.[0]?.id === "here-edit");
  check("this device's own day is kept", out.intake?.["2026-03-02"]?.[0]?.id === "here-today");
  check("the other device's day is added, not overwritten", out.intake?.["2026-02-28"]?.[0]?.id === "there-only");
  check("this device's settings win", out.stepGoal === 10000 && out.training?.goal === "cut" && out.training?.days === 3);
  check("the other device's workout days are added", !!out.training?.log["2026-02-28"]);
  check("the running workout is this device's", (out.training?.active as { startedAt?: number })?.startedAt === 5);
  const idle = combineBoth(state({ training: { goal: "cut", days: 3, log: {}, custom: [] } }), there);
  check("another device's running workout does not appear here", idle.training?.active === undefined);
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
