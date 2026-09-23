/**
 * The session store on a phone. A corrupted session signs the person out, and
 * an anonymous account cannot be signed back into — so a crash mid-write must
 * leave the previous session whole.
 */
import { ctl, store } from "./fakeSecureStore";
import { secureStorage as s } from "./secureStorage";

const results: [string, boolean][] = [];
const check = (n: string, p: boolean) => results.push([n, p]);
const big = (c: string) => c.repeat(4000);

(async () => {
  store.set("k.n", "2");
  store.set("k.0", "x".repeat(1800));
  store.set("k.1", "yy");
  check("a value written before slots existed still reads", (await s.getItem("k")) === "x".repeat(1800) + "yy");
  await s.setItem("k", big("a"));
  check("a long value round-trips across chunks", (await s.getItem("k")) === big("a"));
  check("the old-layout chunks are cleaned up", !store.has("k.0") && !store.has("k.1"));
  await s.setItem("k", big("b"));
  check("the next write lands in the other slot", (store.get("k.n") ?? "").startsWith("b:") && (await s.getItem("k")) === big("b"));
  check("and the slot it left is emptied", ![...store.keys()].some((x) => x.startsWith("k.a.")));
  ctl.writes = 0;
  ctl.failAfter = 2;
  try {
    await s.setItem("k", big("c"));
  } catch {
    // the crash being simulated
  }
  ctl.failAfter = Infinity;
  check("a crash mid-write leaves the previous value whole", (await s.getItem("k")) === big("b"));
  await s.setItem("k", "short");
  check("the next write recovers", (await s.getItem("k")) === "short");
  await s.removeItem("k");
  check("remove leaves the key unreadable", (await s.getItem("k")) === null);

  const failed = results.filter(([, ok]) => !ok);
  for (const [n, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
})();
