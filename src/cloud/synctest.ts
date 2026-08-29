/**
 * Merge and sync tests. The transport is faked, so these run anywhere and
 * prove the two things that matter offline-first: syncing must never lose what
 * the user did on the device, and it must not move the whole account every
 * time it runs.
 */
import type { AppState, CheckIn, Completion, Habit, WeighIn } from "@/store/types";
import { mergeState, outgoingChanges, syncOnce, type Changes, type CloudPort, type Rows } from "./sync";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

const T = {
  early: "2026-08-01T09:00:00.000Z",
  mid: "2026-08-03T09:00:00.000Z",
  late: "2026-08-05T09:00:00.000Z",
};

function habit(id: string, title: string, updated?: string): Habit {
  return { id, title, createdAt: "2026-08-01", archived: false, updatedAt: updated };
}

function tick(habitId: string, date: string, done = true, updatedAt = T.mid): Completion {
  return { habitId, date, done, updatedAt };
}

function weighIn(date: string, kg: number, updatedAt = T.mid): WeighIn {
  return { date, kg, updatedAt };
}

function checkIn(date: string, mood: CheckIn["mood"], note: string, updatedAt = T.mid): CheckIn {
  return { date, mood, note, updatedAt };
}

/**
 * A device stamp that is always later than the last one and never ahead of the
 * wall clock — the same two properties a real device's `now()` has, and both
 * of them matter: the push filter compares these stamps against the time the
 * sync started.
 */
async function deviceStamp(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 2));
  return new Date().toISOString();
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

/**
 * A fake server that behaves like the real one in the way that matters: it
 * stamps every row it receives with its *own* clock and filters pulls on that,
 * never on the timestamp the device wrote. Its clock is a counter, so it is
 * deliberately unrelated to the dates the devices use.
 */
function fakeServer() {
  const rows: Rows = { profile: null, habits: [], completions: [], weighIns: [], checkIns: [] };
  /** synced_at, per row key — the column the trigger maintains in Postgres. */
  const syncedAt = new Map<string, number>();
  let clock = 0;
  let pulls = 0;
  const pushed: Changes[] = [];

  const stamp = (key: string) => syncedAt.set(key, clock);
  const seenAfter = (key: string, since?: string) =>
    since === undefined || (syncedAt.get(key) ?? 0) > Number(since);

  const port: CloudPort = {
    async pull(_userId, since) {
      pulls += 1;
      clock += 1;
      return {
        cursor: String(clock),
        profile: rows.profile,
        habits: rows.habits.filter((h) => seenAfter(`h|${h.id}`, since)),
        completions: rows.completions.filter((c) =>
          seenAfter(`c|${c.habitId}|${c.date}`, since),
        ),
        weighIns: rows.weighIns.filter((w) => seenAfter(`w|${w.date}`, since)),
        checkIns: rows.checkIns.filter((c) => seenAfter(`k|${c.date}`, since)),
      };
    },
    async push(_userId, changes) {
      pushed.push(changes);
      clock += 1;
      if (changes.profile) rows.profile = changes.profile;
      const upsert = <T>(into: T[], from: T[], key: (row: T) => string) => {
        for (const row of from) {
          const at = into.findIndex((r) => key(r) === key(row));
          if (at === -1) into.push(row);
          else into[at] = row;
          stamp(key(row));
        }
      };
      upsert(rows.habits, changes.habits, (h) => `h|${h.id}`);
      upsert(rows.completions, changes.completions, (c) => `c|${c.habitId}|${c.date}`);
      upsert(rows.weighIns, changes.weighIns, (w) => `w|${w.date}`);
      upsert(rows.checkIns, changes.checkIns, (c) => `k|${c.date}`);
    },
  };

  return { port, rows, pushed, pulls: () => pulls };
}

// --- a fresh device pulling an account that already has data
{
  const local = state();
  const remote: Rows = {
    profile: { name: "ליאם", onboarded: true },
    habits: [habit("a", "ללכת", "2026-08-02T10:00:00Z")],
    completions: [tick("a", "2026-08-02")],
    weighIns: [weighIn("2026-08-01", 92)],
    checkIns: [checkIn("2026-08-01", "ok", "בסדר")],
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
    completions: [tick("a", "2026-08-03")],
  });
  const merged = mergeState(local, emptyRemote);
  check("offline work is not wiped by an empty server", merged.habits.length === 1 && merged.completions.length === 1);
}

// --- the same day ticked on two devices must not double
{
  const local = state({ completions: [tick("a", "2026-08-03")] });
  const remote: Rows = { ...emptyRemote, completions: [tick("a", "2026-08-03")] };
  const merged = mergeState(local, remote);
  check("a day ticked on both devices stays one row", merged.completions.length === 1);
}

// --- different days on each device must both survive
{
  const local = state({ completions: [tick("a", "2026-08-03")] });
  const remote: Rows = { ...emptyRemote, completions: [tick("a", "2026-08-02")] };
  const merged = mergeState(local, remote);
  check("days from both devices survive", merged.completions.length === 2);
}

// --- the bug this shape exists to fix: unticking must stick
{
  const local = state({ completions: [tick("a", "2026-08-03", false, T.late)] });
  const remote: Rows = { ...emptyRemote, completions: [tick("a", "2026-08-03", true, T.early)] };
  const merged = mergeState(local, remote);
  check("unticking is not undone by the server's older tick", merged.completions[0].done === false);
}

// --- and unticking on another device reaches this one
{
  const local = state({ completions: [tick("a", "2026-08-03", true, T.early)] });
  const remote: Rows = { ...emptyRemote, completions: [tick("a", "2026-08-03", false, T.late)] };
  const merged = mergeState(local, remote);
  check("an untick from another device arrives here", merged.completions[0].done === false);
}

// --- a re-tick after an untick wins again
{
  const local = state({ completions: [tick("a", "2026-08-03", true, T.late)] });
  const remote: Rows = { ...emptyRemote, completions: [tick("a", "2026-08-03", false, T.mid)] };
  const merged = mergeState(local, remote);
  check("re-ticking after an untick wins", merged.completions[0].done === true);
}

// --- a rename on this device beats an older server copy
{
  const local = state({ habits: [habit("a", "ללכת אחרי צהריים")] });
  const remote: Rows = { ...emptyRemote, habits: [habit("a", "ללכת", T.early)] };
  const merged = mergeState(local, remote);
  check("a local rename wins over an older server row", merged.habits[0].title === "ללכת אחרי צהריים");
}

// --- a newer edit made on another device wins
{
  const local = state({ habits: [habit("a", "ישן", T.early)] });
  const remote: Rows = { ...emptyRemote, habits: [habit("a", "חדש יותר", T.late)] };
  const merged = mergeState(local, remote);
  check("a newer edit from another device wins", merged.habits[0].title === "חדש יותר");
}

// --- a habit removed here must not be resurrected as active
{
  const local = state({ habits: [{ ...habit("a", "ללכת"), archived: true }] });
  const remote: Rows = { ...emptyRemote, habits: [habit("a", "ללכת", T.early)] };
  const merged = mergeState(local, remote);
  check("a habit removed here stays removed", merged.habits[0].archived === true);
}

// --- a weight corrected on the newer device wins
{
  const local = state({ weighIns: [weighIn("2026-08-03", 90, T.late)] });
  const remote: Rows = { ...emptyRemote, weighIns: [weighIn("2026-08-03", 95, T.early)] };
  const merged = mergeState(local, remote);
  check("a corrected weight is not reverted by the server", merged.weighIns[0].kg === 90);
}

// --- an empty server profile must never blank a local name
{
  const local = state({ profile: { name: "ליאם", onboarded: true } });
  const remote: Rows = { ...emptyRemote, profile: { name: "", onboarded: false } };
  const merged = mergeState(local, remote);
  check("a blank server profile does not erase the name", merged.profile.name === "ליאם");
  check("a blank server profile does not undo onboarding", merged.profile.onboarded === true);
}

// --- a goal set on another device after this one's last edit wins
{
  const local = state({ profile: { name: "ליאם", onboarded: true, updatedAt: T.early } });
  const remote: Rows = {
    ...emptyRemote,
    profile: { name: "ליאם", onboarded: true, goalKg: 80, updatedAt: T.late },
  };
  const merged = mergeState(local, remote);
  check("a newer goal from another device arrives", merged.profile.goalKg === 80);
}

// --- what a push actually has to carry
{
  const merged = state({
    profile: { name: "ליאם", onboarded: true, updatedAt: T.early },
    habits: [habit("a", "ללכת", T.early), habit("b", "מים", T.late)],
    completions: [tick("a", "2026-08-01", true, T.early), tick("b", "2026-08-05", true, T.late)],
  });
  const remote: Rows = { ...emptyRemote, habits: [habit("b", "מים", T.late)] };
  const out = outgoingChanges(merged, remote, T.mid);
  check("a push skips rows the device did not touch", out.habits.length === 0 && out.completions.length === 1);
  check("a push skips the row the server just sent", !out.habits.some((h) => h.id === "b"));
  check("a push skips an unchanged profile", out.profile === null);
}

// --- with no cursor everything goes, because the server has none of it
{
  const merged = state({
    profile: { name: "ליאם", onboarded: true },
    habits: [habit("a", "ללכת", T.early)],
    completions: [tick("a", "2026-08-01", true, T.early)],
  });
  const out = outgoingChanges(merged, emptyRemote, undefined);
  check("a first sync sends everything", out.habits.length === 1 && out.completions.length === 1 && out.profile !== null);
}

// --- a full round trip through the fake server
{
  const server = fakeServer();

  let deviceA = state({
    profile: { name: "ליאם", onboarded: true, updatedAt: T.early },
    habits: [habit("a", "ללכת", T.early)],
    completions: [tick("a", "2026-08-03", true, T.early)],
  });
  deviceA = await syncOnce(server.port, "u1", deviceA);
  check("a sync records where to resume from", Boolean(deviceA.lastSyncAt));

  // A second device starts empty and pulls.
  let deviceB = await syncOnce(server.port, "u1", state());
  check("a second device sees the first device's habit", deviceB.habits.length === 1);
  check("a second device sees the name", deviceB.profile.name === "ליאם");

  // Device B ticks another day, then A syncs again.
  deviceB = {
    ...deviceB,
    completions: [...deviceB.completions, tick("a", "2026-08-04", true, await deviceStamp())],
  };
  deviceB = await syncOnce(server.port, "u1", deviceB);
  const deviceAAgain = await syncOnce(server.port, "u1", deviceA);
  check(
    "the first device picks up the second's tick",
    deviceAAgain.completions.filter((c) => c.done).length === 2,
  );

  // Device B unticks that day. This is the round trip the old union lost.
  const untickedAt = await deviceStamp();
  deviceB = {
    ...deviceB,
    completions: deviceB.completions.map((c) =>
      c.date === "2026-08-04" ? { ...c, done: false, updatedAt: untickedAt } : c,
    ),
  };
  await syncOnce(server.port, "u1", deviceB);
  const deviceAThird = await syncOnce(server.port, "u1", deviceAAgain);
  check(
    "an untick survives a full round trip",
    deviceAThird.completions.find((c) => c.date === "2026-08-04")?.done === false,
  );

  // Nothing has changed since; a sync must move no rows at all.
  const before = server.pushed.length;
  await syncOnce(server.port, "u1", deviceAThird);
  check("a sync with nothing to say sends nothing", server.pushed.length === before);
}

// --- a phone that was offline for a week: its rows are stamped in the past,
// --- and the other device must still receive them
{
  const server = fakeServer();
  let deviceA = await syncOnce(server.port, "u1", state({ profile: { name: "ליאם", onboarded: true } }));
  // A is now up to date, holding a cursor from *after* everything below happened.

  const offlinePhone = state({
    habits: [habit("z", "מים", "2026-07-20T09:00:00.000Z")],
    completions: [tick("z", "2026-07-20", true, "2026-07-20T09:00:00.000Z")],
  });
  await syncOnce(server.port, "u1", offlinePhone);

  deviceA = await syncOnce(server.port, "u1", deviceA);
  check(
    "a week of history from an offline phone reaches the other device",
    deviceA.habits.some((h) => h.id === "z") && deviceA.completions.length === 1,
  );
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
