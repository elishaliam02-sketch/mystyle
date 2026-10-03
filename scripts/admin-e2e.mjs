/**
 * The owner console, driven in a real browser.
 *
 *     node scripts/admin-e2e.mjs
 *
 * admin/index.html is served as-is, under its own Content-Security-Policy. The
 * pinned supabase-js file is answered from node_modules (the integrity hash on
 * the tag still has to match it), and the Supabase project is answered by a
 * fake: sign-in returns a session, and the `admin` function answers from a
 * generated cohort run through the very module the real function uses
 * (supabase/functions/_shared/adminMetrics.ts). So what is checked here is the
 * page — every view, at a desktop and a phone width — against real numbers.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const { chromium } = await import("playwright").catch(async () => {
  const { createRequire } = await import("node:module");
  const g = createRequire(import.meta.url)("child_process").execSync("npm root -g").toString().trim();
  return import(pathToFileURL(path.join(g, "playwright", "index.mjs")).href);
});

const out = path.resolve("node_modules/.cache/adminmetrics.mjs");
await build({ entryPoints: ["supabase/functions/_shared/adminMetrics.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "warning" });
const M = await import(pathToFileURL(out).href);

const results = [];
const check = (n, ok, d) => results.push([n, !!ok, d]);

// ---------------------------------------------------------------- a cohort
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const NOW = Date.now();
const iso = (daysAgo) => new Date(NOW - daysAgo * 86_400_000).toISOString();
const day = (daysAgo) => iso(daysAgo).slice(0, 10);
const raw = { users: [], subs: [], weighIns: [], checkIns: [], habits: [], completions: [], profiles: [], backups: [] };
for (let i = 0; i < 80; i++) {
  const id = `${String(i).padStart(8, "0")}-0000-4000-8000-${String(i).padStart(12, "0")}`;
  const age = Math.floor(rnd() * 60);
  const anonymous = i % 7 === 3;
  raw.users.push({ id, email: anonymous ? null : `user${i}@example.com`, createdAt: iso(age), lastSignInAt: iso(Math.floor(rnd() * age)), anonymous });
  const engaged = rnd();
  const habits = 1 + Math.floor(rnd() * 3);
  for (let h = 0; h < habits; h++) raw.habits.push({ userId: id, archived: false });
  for (let d = 0; d <= age; d++) {
    if (rnd() < engaged * (d < age * 0.5 ? 1 : 0.4)) {
      raw.completions.push({ userId: id, date: day(d), done: true });
      if (rnd() < 0.3) raw.checkIns.push({ userId: id, date: day(d), mood: ["good", "ok", "hard"][Math.floor(rnd() * 3)] });
    }
  }
  if (age > 10) {
    const start = 70 + Math.floor(rnd() * 40);
    const rate = i === 5 ? -2 : (rnd() - 0.7) * 1.4;
    for (let w = 0; w * 7 <= age; w++) raw.weighIns.push({ userId: id, date: day(age - w * 7), kg: Math.round((start + rate * w) * 10) / 10 });
  }
  raw.profiles.push({ id, goalKg: 68 });
  if (i % 5 === 0) raw.subs.push({ userId: id, status: "active", planId: i % 10 === 0 ? "yearly" : "monthly", currentPeriodEnd: iso(-20), trialEndsAt: null, stripe: true });
  else if (i % 9 === 0) raw.subs.push({ userId: id, status: "trialing", planId: "monthly", currentPeriodEnd: null, trialEndsAt: iso(-2), stripe: true });
}
const summaries = M.summarize(raw, NOW);
const dash = M.dashboard(summaries, M.activityRows(raw), raw.checkIns, NOW);
const attention = new Set(dash.attention.map((a) => a.id));
const calls = [];
// The function as deployed before the console grew: three actions, old shapes.
function oldAnswer(body) {
  switch (body.action) {
    case "overview": return { totalUsers: summaries.length, paying: dash.subs.paying + dash.subs.trialing, progressing: 0, subStatus: dash.subs.status, trajectory: dash.trajectory };
    case "audit": return answer(body);
    case "users": {
      const page = Number(body.page) || 1;
      return { page, perPage: 50, count: 0, users: summaries.slice((page - 1) * 50, page * 50).map((u) => ({
        id: u.id, email: u.email, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt,
        subscription: u.status === "none" ? { status: "none" } : { status: u.status, planId: u.planId, currentPeriodEnd: u.currentPeriodEnd, trialEndsAt: u.trialEndsAt },
        weighIns: u.weighIns, lastWeighInDaysAgo: u.daysSinceWeighIn, perWeek: u.perWeek, trajectory: u.trajectory })) };
    }
    default: return null;
  }
}
function answer(body) {
  calls.push(body);
  switch (body.action) {
    case "dashboard": return dash;
    case "audit": return { count: 2, events: [
      { id: 2, at: iso(0.01), kind: "admin.view_user", actor_id: "x", target_id: summaries[0].id, meta: {} },
      { id: 1, at: iso(0.02), kind: "admin.login", actor_id: "x", target_id: null, meta: { action: "dashboard" } }] };
    case "users": return M.queryUsers(summaries, body, NOW, attention);
    case "export": {
      const rows = M.queryUsers(summaries, { ...body, page: 1, perPage: 10_000 }, NOW, attention).rows;
      return { filename: "apex-users.csv", csv: M.usersCsv(rows), count: rows.length };
    }
    case "user": {
      const s = summaries.find((u) => u.id === body.id);
      return {
        summary: s,
        weighIns: raw.weighIns.filter((w) => w.userId === body.id).map(({ date, kg }) => ({ date, kg })),
        activity: [...new Set(M.activityRows(raw).filter((r) => r.userId === body.id).map((r) => r.date))].sort(),
        moods: raw.checkIns.filter((m) => m.userId === body.id).map(({ date, mood }) => ({ date, mood })),
        habits: { active: s.habits, archived: 0 },
        events: [],
      };
    }
    case "comp": return { ok: true, until: iso(-body.days) };
    default: return { error: "unknown-action" };
  }
}

// ---------------------------------------------------------------- the page
const PORT = 8131;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync("admin/index.html"));
});
await new Promise((r) => server.listen(PORT, r));
const UMD = fs.readFileSync("node_modules/@supabase/supabase-js/dist/umd/supabase.js");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "admin-id", aal: "aal2", exp: Math.floor(NOW / 1000) + 3600, role: "authenticated" })}.sig`;
const user = { id: "admin-id", email: "owner@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: iso(100) };
const cors = { "access-control-allow-origin": `http://localhost:${PORT}`, "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" };

const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
async function session(width, height, old = false) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const csp = [];
  await ctx.exposeBinding("__csp", (_s, v) => csp.push(v));
  await ctx.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => window.__csp(`${e.violatedDirective} ${e.blockedURI}`)));
  await ctx.route("https://cdn.jsdelivr.net/**", (r) => r.fulfill({ status: 200, contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: UMD }));
  await ctx.route("https://vesdfboxetdwymsulpsc.supabase.co/**", async (r) => {
    const req = r.request();
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    const url = req.url();
    if (url.includes("/auth/v1/token")) return r.fulfill({ status: 200, headers: cors, contentType: "application/json",
      body: JSON.stringify({ access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(NOW / 1000) + 3600, refresh_token: "r", user }) });
    if (url.includes("/auth/v1/")) return r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(user) });
    if (url.includes("/functions/v1/admin")) {
      const body = JSON.parse(req.postData() || "{}");
      const res = old ? oldAnswer(body) : answer(body);
      if (res === null) return r.fulfill({ status: 400, headers: cors, contentType: "application/json", body: JSON.stringify({ error: "unknown-action" }) });
      return r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(res) });
    }
    return r.fulfill({ status: 404, headers: cors, body: "{}" });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://localhost:${PORT}/`);
  await page.fill("#email", "owner@example.com");
  await page.fill("#password", "pw");
  await page.click("#signin");
  await page.waitForSelector("#kpis .kpi", { timeout: 15000 });
  return { ctx, page, errors, csp };
}

try {
  // Desktop
  {
    const { ctx, page, errors, csp } = await session(1280, 900);
    check("signing in shows the console", await page.isVisible("#dash"));
    check("eight headline numbers", (await page.locator("#kpis .kpi").count()) === 8);
    const kpiText = await page.locator("#kpis").innerText();
    check("the user count is the cohort's", kpiText.includes(String(dash.totals.users)), kpiText.slice(0, 80));
    check("revenue is shown in shekels", kpiText.includes("₪"));
    check("30 days of sign-ups are drawn", (await page.locator("#chSignups rect").count()) === 30);
    check("30 days of actives are drawn", (await page.locator("#chActive rect").count()) === 30);
    check("the attention list names the most urgent eight", (await page.locator("#attention button.row").count()) === Math.min(8, dash.attention.length) && dash.attention.length > 0, String(dash.attention.length));
    check("a too-fast loss is on top of the list", (await page.locator("#attention button.row").first().innerText()).includes("מהר מדי"));
    check("retention rows for day 1, 7 and 30", (await page.locator("#retention .row").count()) === 3);
    check("eight weekly cohorts", (await page.locator("#cohorts tbody tr").count()) === 8);
    await page.screenshot({ path: "node_modules/.cache/admin-overview.png", fullPage: true }).catch(() => {});

    if (dash.attention.length > 8) {
      await page.click("#attentionAll");
      await page.waitForSelector("#usersBody tr");
      await page.waitForFunction((n) => document.querySelector("#usersMeta").textContent.startsWith(String(n)), new Set(dash.attention.map((a) => a.id)).size, { timeout: 5000 }).catch(() => {});
      check("show all opens the users list filtered to them", (await page.innerText("#usersMeta")).startsWith(String(new Set(dash.attention.map((a) => a.id)).size)), await page.innerText("#usersMeta"));
      await page.getByRole("button", { name: "כולם" }).click();
    }

    // Users
    await page.click("#tabbtn-users");
    await page.waitForSelector("#usersBody tr");
    // The list may still be the filtered one from "show all" until "all" lands.
    await page.waitForFunction((n) => document.querySelector("#usersMeta").textContent.startsWith(String(n)), summaries.length, { timeout: 5000 }).catch(() => {});
    check("the users tab lists a page of people", (await page.locator("#usersBody tr").count()) === 50);
    check("and says how many there are", (await page.innerText("#usersMeta")).includes("80"));
    await page.click("#next");
    await page.waitForFunction(() => document.querySelector("#pageInfo").textContent.startsWith("עמוד 2"));
    check("the second page has the rest", (await page.locator("#usersBody tr").count()) === 30);
    await page.fill("#q", "user12@");
    await page.waitForFunction(() => document.querySelectorAll("#usersBody tr").length === 1, null, { timeout: 5000 }).catch(() => {});
    check("search narrows to the one person", (await page.locator("#usersBody tr").count()) === 1 && (await page.locator("#usersBody").innerText()).includes("user12@example.com"));
    await page.fill("#q", "");
    await page.getByRole("button", { name: "משלמים" }).click();
    await page.waitForFunction((n) => document.querySelector("#usersMeta").textContent.startsWith(String(n)), dash.subs.paying, { timeout: 5000 }).catch(() => {});
    check("the paying filter shows the paying", (await page.innerText("#usersMeta")).startsWith(String(dash.subs.paying)), await page.innerText("#usersMeta"));
    check("the filter remembers it is on", (await page.getByRole("button", { name: "משלמים" }).getAttribute("aria-pressed")) === "true");
    const dl = page.waitForEvent("download", { timeout: 5000 });
    await page.click("#export");
    const file = await dl.catch(() => null);
    const csv = file ? fs.readFileSync(await file.path(), "utf8") : "";
    check("export downloads a CSV of the filtered people", csv.split("\n").length === dash.subs.paying + 1 && csv.includes("email"), `${csv.split("\n").length} lines`);
    check("the CSV starts with a BOM so Excel reads Hebrew", csv.charCodeAt(0) === 0xfeff);

    // One person
    await page.getByRole("button", { name: "כולם" }).click();
    await page.waitForSelector("#usersBody tr");
    await page.locator("#usersBody tr").first().click();
    await page.waitForSelector("#dBody .facts");
    check("a row opens the person", await page.isVisible("#drawer"));
    check("their facts are listed", (await page.locator("#dBody .fact").count()) === 12);
    check("their activity is drawn as a heatmap", (await page.locator("#dBody .heat span").count()) >= 84);
    await page.click("#dClose");
    check("closing hides it", await page.isHidden("#drawer"));
    const target = summaries.filter((s) => s.weighIns >= 2 && s.status === "none")[0];
    await page.fill("#q", target.email ?? target.id.slice(0, 8));
    await page.waitForFunction(() => document.querySelectorAll("#usersBody tr").length === 1, null, { timeout: 5000 }).catch(() => {});
    await page.locator("#usersBody tr").first().click();
    await page.waitForSelector("#dBody .facts");
    check("a weigh-in history is drawn as a line", (await page.locator("#dBody polyline").count()) === 1);
    await page.getByRole("button", { name: "תן גישה חינם" }).click();
    await page.waitForTimeout(400);
    const comp = calls.find((c) => c.action === "comp");
    check("granting free access asks the server, for that person and 30 days", comp && comp.id === target.id && comp.days === 30, JSON.stringify(comp));
    await page.keyboard.press("Escape");
    check("Escape closes the person", await page.isHidden("#drawer"));

    // Audit
    await page.click("#tabbtn-audit");
    await page.waitForSelector("#audit .row");
    check("the audit trail is listed in Hebrew", (await page.innerText("#audit")).includes("צפייה במשתמש"));
    check("the console raised no page errors (desktop)", errors.length === 0, errors.join(" | "));
    check("the CSP refused nothing (desktop)", csp.length === 0, csp[0]);
    await page.screenshot({ path: "node_modules/.cache/admin-desktop.png", fullPage: true }).catch(() => {});
    await ctx.close();
  }
  // Phone
  {
    const { ctx, page, errors, csp } = await session(390, 844);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("a phone: nothing runs off the side of the overview", over <= 0, String(over));
    await page.click("#tabbtn-users");
    await page.waitForSelector("#usersBody tr");
    check("a phone: the table header is hidden", await page.isHidden("table.users thead"));
    const display = await page.locator("#usersBody tr").first().evaluate((n) => getComputedStyle(n).display);
    check("a phone: each person is a card", display === "grid", display);
    const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("a phone: nothing runs off the side of the list", over2 <= 0, String(over2));
    await page.locator("#usersBody tr").first().click();
    await page.waitForSelector("#dBody .facts");
    const w = await page.locator("#drawer").evaluate((n) => n.getBoundingClientRect().width);
    check("a phone: the person fills the screen", w >= 389, String(w));
    check("the console raised no page errors (phone)", errors.length === 0, errors.join(" | "));
    check("the CSP refused nothing (phone)", csp.length === 0, csp[0]);
    await page.screenshot({ path: "node_modules/.cache/admin-phone.png", fullPage: true }).catch(() => {});
    await ctx.close();
  }
  // The function not yet redeployed: the console still works, from the old answers.
  {
    const { ctx, page, errors, csp } = await session(1280, 900, true);
    check("old server: the console still opens", (await page.locator("#kpis .kpi").count()) === 8);
    check("old server: it says some numbers wait for the update", await page.isVisible("#legacyNote"));
    check("old server: the user count is right", (await page.locator("#kpis").innerText()).includes(String(summaries.length)));
    check("old server: sign-ups are still drawn", (await page.locator("#chSignups rect").count()) === 30);
    check("old server: no error banner", await page.isHidden("#banner"));
    await page.click("#tabbtn-users");
    await page.waitForSelector("#usersBody tr");
    check("old server: every user is listed across pages", (await page.innerText("#usersMeta")).includes(String(summaries.length)), await page.innerText("#usersMeta"));
    await page.fill("#q", "user12@");
    await page.waitForFunction(() => document.querySelectorAll("#usersBody tr").length === 1, null, { timeout: 5000 }).catch(() => {});
    check("old server: search works", (await page.locator("#usersBody tr").count()) === 1);
    await page.locator("#usersBody tr").first().click();
    await page.waitForSelector("#dBody .facts");
    check("old server: a person opens, saying what is still to come", (await page.innerText("#dBody")).includes("יופיעו כשהשרת יתעדכן"));
    await page.getByRole("button", { name: "תן גישה חינם" }).click();
    await page.waitForTimeout(300);
    check("old server: free access says it is not available yet", (await page.innerText("#dBody")).includes("השרת עוד לא תומך"));
    check("old server: no page errors", errors.length === 0, errors.join(" | "));
    check("old server: the CSP refused nothing", csp.length === 0, csp[0]);
    await ctx.close();
  }
} catch (e) {
  check("the run finished", false, String(e).slice(0, 300));
}
await browser.close();
server.close();
const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
