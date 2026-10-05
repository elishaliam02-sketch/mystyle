import { BACKUP_AFTER_DAYS, daysUsed, nextSetup, SNOOZE_DAYS, type SetupInput } from "./setup";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const now = new Date("2026-10-05T09:00:00Z");
const base: SetupInput = { web: true, webSupport: "ok", nativeReminders: false, remindersOn: false, cloudOn: false, daysUsed: 0, snoozed: {}, now };

check("an iPhone tab is shown how to install first", nextSetup({ ...base, webSupport: "install" }) === "install");
check("an installed web app is offered reminders", nextSetup(base) === "reminders");
check("the phone app is offered reminders when it can schedule", nextSetup({ ...base, web: false, nativeReminders: true }) === "reminders");
check("nothing about reminders where they cannot work", nextSetup({ ...base, webSupport: "no" }) === null);
check("reminders on, nothing to offer yet", nextSetup({ ...base, remindersOn: true }) === null);
check("backup waits until there is something to lose", nextSetup({ ...base, remindersOn: true, daysUsed: BACKUP_AFTER_DAYS - 1 }) === null);
check("then it is offered", nextSetup({ ...base, remindersOn: true, daysUsed: BACKUP_AFTER_DAYS }) === "backup");
check("backup on, nothing left", nextSetup({ ...base, remindersOn: true, cloudOn: true, daysUsed: 30 }) === null);
const snoozed = { reminders: new Date(now.getTime() - 86_400_000).toISOString() };
check("\"not now\" moves to the next step", nextSetup({ ...base, daysUsed: 5, snoozed }) === "backup");
check("and returns after two weeks",
  nextSetup({ ...base, snoozed: { reminders: new Date(now.getTime() - (SNOOZE_DAYS + 1) * 86_400_000).toISOString() } }) === "reminders");
check("a garbled snooze does not hide anything", nextSetup({ ...base, snoozed: { reminders: "soon" } }) === "reminders");
check("one step at a time: install before backup", nextSetup({ ...base, webSupport: "install", daysUsed: 10 }) === "install");

check("days used counts distinct days of anything", daysUsed({
  completions: [{ date: "2026-10-01", done: true }, { date: "2026-10-01", done: true }, { date: "2026-10-02", done: false }],
  intake: { "2026-10-02": [{}], "2026-10-03": [] },
  waterMl: { "2026-10-04": 250, "2026-10-05": 0 },
  weighIns: [{ date: "2026-10-01" }],
  checkIns: [{ date: "2026-10-05" }],
}) === 4);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
