import { cleanSchedule, cleanSubscription, isPushHost, MAX_ITEMS } from "../../supabase/functions/_shared/pushPlan";

const results: [string, boolean, string?][] = [];
const check = (name: string, pass: boolean, detail?: string) => results.push([name, pass, detail]);

const now = Date.parse("2026-10-03T10:00:00Z");
const at = (min: number) => new Date(now + min * 60_000).toISOString();

{
  const s = cleanSchedule([{ id: "water@2026-10-03", at: at(300) }, { id: "recap@2026-10-03", at: at(690) }], now)!;
  check("a good schedule is kept, in time order", s.length === 2 && s[0]!.reminder === "water@2026-10-03");
  check("only ids and times are kept — no words",
    JSON.stringify(cleanSchedule([{ id: "water@2026-10-03", at: at(5), title: "secret", body: "x" }], now)) ===
      JSON.stringify([{ reminder: "water@2026-10-03", at: at(5) }]));
  check("a malformed id is dropped", cleanSchedule([{ id: "DROP TABLE", at: at(5) }, { id: "x@y", at: at(5) }], now)!.length === 0);
  check("a duplicate is dropped", cleanSchedule([{ id: "a@2026-10-03", at: at(5) }, { id: "a@2026-10-03", at: at(9) }], now)!.length === 1);
  check("a time long past is dropped", cleanSchedule([{ id: "a@2026-10-03", at: at(-60) }], now)!.length === 0);
  check("a moment late is still sent", cleanSchedule([{ id: "a@2026-10-03", at: at(-2) }], now)!.length === 1);
  check("beyond three weeks is dropped", cleanSchedule([{ id: "a@2026-10-30", at: at(60 * 24 * 30) }], now)!.length === 0);
  check("a nonsense time is dropped", cleanSchedule([{ id: "a@2026-10-03", at: "soon" }], now)!.length === 0);
  const many = Array.from({ length: 100 }, (_, i) => ({ id: `r${i}@2026-10-03`, at: at(10 + i) }));
  check("the list is capped", cleanSchedule(many, now)!.length === MAX_ITEMS);
  check("not a list is refused", cleanSchedule({ id: "a" }, now) === null && cleanSchedule(new Array(600).fill(0), now) === null);
}

{
  const keys = { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) };
  check("an Apple subscription is accepted", !!cleanSubscription({ endpoint: "https://web.push.apple.com/QGuQ", keys }));
  check("a Chrome one too", !!cleanSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }));
  check("Firefox too", isPushHost("updates.push.services.mozilla.com"));
  check("an arbitrary host is refused", !cleanSubscription({ endpoint: "https://evil.example/x", keys }));
  check("a private address is refused", !cleanSubscription({ endpoint: "https://127.0.0.1/x", keys }));
  check("plain http is refused", !cleanSubscription({ endpoint: "http://web.push.apple.com/x", keys }));
  check("a look-alike host is refused", !isPushHost("web.push.apple.com.evil.example") && !isPushHost("fcm.googleapis.com.evil"));
  check("bad keys are refused", !cleanSubscription({ endpoint: "https://web.push.apple.com/x", keys: { p256dh: "x", auth: "y" } }));
}

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
