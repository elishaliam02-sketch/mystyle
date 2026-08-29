/**
 * Merge tests. The transport is faked, so these run anywhere and prove the one
 * thing that matters offline-first: syncing must never lose what the user did
 * on the device.
 */
import type { AppState, Habit } from "@/store/types";
import { mergeState, syncOnce, type CloudPort, type Rows } from "./sync";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

function habit(id: string, title: string, updated?: string): Habit {
  return { id, title, createdAt: "2026-08-01", archived: false, updatedAt: updated };
}

const emptyRemote: Rows = {
  profile: null, habits: [], completions: [], weighIns: [], checkIns: [],
};

function state(patch: Partial<AppState> = {}): AppState {
  return {
    profile: { name: "", onboarded: false },
    habits: [], completions: [], weighIns: [], checkIns: [],
    ...patch,
  };
}

// --- a fresh device pulling an account that already has data
{
  const local = state();
  const remote: Rows = {
    profile: { name: "ליאם", onboarded: true },
    habits: [habit("a", "ללכת", "2026-08-02T10:00:00Z")],
    completions: [{ habitId: "a", date: "2026-08-02" }],
    weighIns: [{ date: "2026-08-01", kg: 92 }],
    checkIns: [{ date: "2026-08-01", mood: "ok", note: "בסדר" }],
  };
  const merged = mergeState(local, remote);
  check("fresh device receives the account's habits", merged.habits.length === 1);
  check("fresh device receives the name", merged.profile.name === "ליאם");
  check("fresh device is not sent back through onboarding", merged.profile.onboarded === true);
  check("fresh device receives history", merged.checkIns.length === 1 && merged.weighIns.length === 1);
}

// --- a device that worked offline pushing into an empty account
{
  const local = state({
    profile: { name: "ליאם", onboarded: true },
    habits: [habit("a", "ללכת")],
    completions: [{ habitId: "a", date: "2026-08-03" }],
  });
  const merged = mergeState(local, emptyRemote);
  check("offline work is not wiped by an empty server", merged.habits.length === 1 && merged.completions.length === 1);
}

// --- the same day ticked on two devices must not double
{
  const local = state({ completions: [{ habitId: "a", date: "2026-08-03" }] });
  const remote: Rows = { ...emptyRemote, completions: [{ habitId: "a", date: "2026-08-03" }] };
  const merged = mergeState(local, remote);
  check("a day ticked on both devices stays one row", merged.completions.length === 1);
}

// --- different days on each device must both survive
{
  const local = state({ completions: [{ habitId: "a", date: "2026-08-03" }] });
  const remote: Rows = { ...emptyRemote, completions: [{ habitId: "a", date: "2026-08-02" }] };
  const merged = mergeState(local, remote);
  check("days from both devices survive", merged.completions.length === 2);
}

// --- a rename on this device beats an older server copy
{
  const local = state({ habits: [habit("a", "ללכת אחרי צהריים")] });
  const remote: Rows = { ...emptyRemote, habits: [habit("a", "ללכת", "2026-08-01T09:00:00Z")] };
  const merged = mergeState(local, remote);
  check("a local rename wins over an older server row", merged.habits[0].title === "ללכת אחרי צהריים");
}

// --- a newer edit made on another device wins
{
  const local = state({ habits: [habit("a", "ישן", "2026-08-01T09:00:00Z")] });
  const remote: Rows = { ...emptyRemote, habits: [habit("a", "חדש יותר", "2026-08-05T09:00:00Z")] };
  const merged = mergeState(local, remote);
  check("a newer edit from another device wins", merged.habits[0].title === "חדש יותר");
}

// --- a habit removed here must not be resurrected as active
{
  const local = state({ habits: [{ ...habit("a", "ללכת"), archived: true }] });
  const remote: Rows = { ...emptyRemote, habits: [habit("a", "ללכת", "2026-08-01T09:00:00Z")] };
  const merged = mergeState(local, remote);
  check("a habit removed here stays removed", merged.habits[0].archived === true);
}

// --- an empty server profile must never blank a local name
{
  const local = state({ profile: { name: "ליאם", onboarded: true } });
  const remote: Rows = { ...emptyRemote, profile: { name: "", onboarded: false } };
  const merged = mergeState(local, remote);
  check("a blank server profile does not erase the name", merged.profile.name === "ליאם");
  check("a blank server profile does not undo onboarding", merged.profile.onboarded === true);
}

// --- a full round trip through a fake server
{
  const server: Rows = { ...emptyRemote };
  const port: CloudPort = {
    pull: async () => server,
    push: async (_id, s) => {
      server.profile = s.profile;
      server.habits = s.habits;
      server.completions = s.completions;
      server.weighIns = s.weighIns;
      server.checkIns = s.checkIns;
    },
  };

  const deviceA = state({
    profile: { name: "ליאם", onboarded: true },
    habits: [habit("a", "ללכת")],
    completions: [{ habitId: "a", date: "2026-08-03" }],
  });
  await syncOnce(port, "u1", deviceA);

  // A second device starts empty and pulls.
  const deviceB = await syncOnce(port, "u1", state());
  check("a second device sees the first device's habit", deviceB.habits.length === 1);
  check("a second device sees the name", deviceB.profile.name === "ליאם");

  // Device B ticks another day, then A syncs again.
  deviceB.completions.push({ habitId: "a", date: "2026-08-04" });
  await syncOnce(port, "u1", deviceB);
  const deviceAAgain = await syncOnce(port, "u1", deviceA);
  check("the first device picks up the second's tick", deviceAAgain.completions.length === 2);
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
