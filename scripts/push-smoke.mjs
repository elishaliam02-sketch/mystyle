/**
 * A real reminder, end to end, against production: a real Chrome subscribes
 * on the live site, the live push function is handed one reminder due in
 * twenty seconds, pg_cron's next run sends it through Google's push service,
 * and the browser's service worker has to show it. Then everything it made
 * is removed — the subscription, the queue, the throwaway anonymous account.
 *
 *     node scripts/push-smoke.mjs        (CI: .github/workflows/push-smoke.yml)
 *
 * The unit tests prove the encryption against the RFC; this proves a push
 * service accepts what the server sends.
 */
import { chromium } from "playwright";

const SITE = "https://mystyle.expo.app";
const SB = "https://vesdfboxetdwymsulpsc.supabase.co";
const KEY = "sb_publishable_QJJEFeAVnwdJDwdVpOHjFA_un6l0Of_";
const step = (m) => console.log(`· ${m}`);

let token = null;
let browser = null;
let ok = false;

async function call(body) {
  const res = await fetch(`${SB}/functions/v1/push`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

try {
  const signup = await fetch(`${SB}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const session = await signup.json();
  token = session.access_token;
  if (!token) throw new Error(`anonymous sign-in refused: ${signup.status} ${JSON.stringify(session).slice(0, 200)}`);
  step("anonymous test account made");

  browser = await chromium.launch({ channel: "chrome", headless: false });
  const ctx = await browser.newContext();
  await ctx.grantPermissions(["notifications"], { origin: SITE });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/legal/privacy`, { waitUntil: "load" });
  const sub = await page.evaluate(async (sb) => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const k = await (await fetch(`${sb}/functions/v1/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "key" }),
    })).json();
    const b64 = k.publicKey.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((k.publicKey.length + 3) % 4);
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    return s.toJSON();
  }, SB);
  step(`subscribed at ${new URL(sub.endpoint).host}`);

  const subscribed = await call({ action: "subscribe", subscription: sub });
  if (subscribed.status !== 200) throw new Error(`subscribe: ${subscribed.status} ${subscribed.body}`);
  const today = new Date().toISOString().slice(0, 10);
  const scheduled = await call({ action: "schedule", items: [{ id: `smoke@${today}`, at: new Date(Date.now() + 20_000).toISOString() }] });
  if (scheduled.status !== 200) throw new Error(`schedule: ${scheduled.status} ${scheduled.body}`);
  step("one reminder queued, due in 20 s");

  const started = Date.now();
  while (Date.now() - started < 200_000) {
    await page.waitForTimeout(5000);
    const shown = await page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}|${n.tag}`),
    );
    if (shown.length) {
      step(`shown after ${Math.round((Date.now() - started) / 1000)} s: ${shown.join(", ")}`);
      ok = shown.some((s) => s.includes(`smoke@${today}`));
      break;
    }
  }
  if (!ok) console.log("✗ no notification arrived");
} catch (e) {
  console.log(`✗ ${String(e).slice(0, 400)}`);
} finally {
  if (token) {
    await call({ action: "unsubscribe" }).catch(() => {});
    const del = await fetch(`${SB}/rest/v1/rpc/delete_my_account`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    }).catch(() => null);
    step(`test account removed: ${del?.status}`);
  }
  await browser?.close();
}

console.log(ok ? "\n✓ a real push reached a real browser" : "\n✗ the push did not arrive");
process.exitCode = ok ? 0 : 1;
