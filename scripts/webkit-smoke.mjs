/**
 * The app in Safari's engine, as an iPhone sees it.
 *
 *     node scripts/webkit-smoke.mjs        (needs `npx playwright install webkit`)
 *
 * Every other browser suite here runs Chromium, but the people using the web
 * app are on iPhones, where every browser is WebKit. This opens each screen in
 * WebKit with an iPhone's screen, touch and user agent, fails on any page error
 * or broken screen, and drives the few taps a day is made of.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const { webkit, devices } = await import("playwright");

const DIST = path.resolve("dist");
const PORT = 8131;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(DIST, url);
  if (!path.extname(url) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  fs.readFile(file, (e, d) => {
    if (e) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise((r) => server.listen(PORT, r));

const results = [];
const check = (n, p, d) => results.push([n, p, d]);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const today = iso(now);
const dayAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return iso(d); };
const LEGAL_VERSION = Number(/version:\s*(\d+)/.exec(fs.readFileSync("src/legal/config.ts", "utf8"))[1]);

const seed = {
  legal: { version: LEGAL_VERSION, acceptedAt: now.toISOString() },
  consent: { cloud: false, ai: false, photos: false, updatedAt: now.toISOString() },
  profile: { name: "טסט", onboarded: true, startKg: 85, heightCm: 180, updatedAt: "1970-01-01T00:00:00.000Z" },
  habits: [{ id: "h1", title: "לשתות מים", slot: "morning", createdAt: dayAgo(10), archived: false, updatedAt: now.toISOString() }],
  completions: [], weighIns: [], checkIns: [],
  pantry: "חזה עוף, אורז, ביצים, עגבנייה, מלפפון, יוגורט יווני, בננה, לחם",
  salt: "webkit-salt", nutritionGoal: "cut", dietFilter: "all",
  training: { goal: "recomp", days: 3, minutes: 60, equipment: "gym", planSeed: "w", log: {}, custom: [], weights: {} },
};

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
await ctx.route(/supabase\.co|wikimedia|youtube|ytimg|jsdelivr|openfoodfacts/, (r) => r.abort());
await ctx.addInitScript((s) => {
  try {
    if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1", s);
    localStorage.setItem("mystyle.locale", "he");
    localStorage.setItem("apex.news.seen", "x");
  } catch {}
}, JSON.stringify(seed));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const go = async (route) => {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "load" });
  await page.waitForTimeout(2200);
};
const st = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("mystyle.state.v1")));

try {
  const screens = [
    ["/", "ההרגלים שלך"], ["/kitchen", "המטבח"], ["/workout", "האימון"], ["/water", "מים"],
    ["/checkin", "סיכום היום"], ["/progress", "התקדמות"], ["/profile", "פרופיל"], ["/recipes", "ספר המתכונים"],
    ["/library", "מאגר התרגילים"], ["/coach", null], ["/help", null], ["/calc", null], ["/habit/new", "הרגל חדש"],
    ["/habit/h1", "לשתות מים"], ["/achievements", "הישגים"], ["/rewards", null], ["/recipe/shakshuka", null],
  ];
  for (const [route, heading] of screens) {
    const before = errors.length;
    await go(route);
    const text = await page.locator("body").innerText().catch(() => "");
    check(`${route} opens in Safari's engine`, text.trim().length > 40 && errors.length === before,
      errors.slice(before).join(" | ") || `${text.length} chars`);
    if (heading) check(`${route} shows "${heading}"`, text.includes(heading));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${route} fits the iPhone's width`, wide <= 1, `${wide}px too wide`);
  }

  // the taps a day is made of
  await go("/");
  await page.getByRole("checkbox").first().tap();
  await page.waitForTimeout(700);
  check("a habit ticks with a tap", (await st()).completions.some((c) => c.habitId === "h1" && c.date === today && c.done));

  await go("/water");
  await page.getByLabel("הוסף כוס מים").first().tap();
  await page.waitForTimeout(700);
  check("a glass of water adds with a tap", ((await st()).waterMl?.[today] ?? 0) > 0);

  await go("/kitchen");
  await page.getByPlaceholder(/מה אכלת/).first().fill("אורז");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "אורז", exact: true }).first().tap();
  await page.waitForTimeout(500);
  await page.getByText("רשום ביומן").first().tap();
  await page.waitForTimeout(700);
  check("food logs from the search", ((await st()).intake?.[today] ?? []).some((i) => i.label.startsWith("אורז")));

  await go("/progress");
  await page.getByPlaceholder("קילוגרם").first().fill("84.5");
  await page.getByRole("button", { name: "שמור משקל" }).first().tap();
  await page.waitForTimeout(700);
  check("a weigh-in saves", (await st()).weighIns.some((w) => w.date === today && w.kg === 84.5));

  check("no page errors anywhere", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check("the run finished", false, String(e).slice(0, 300));
}

await browser.close();
server.close();
const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
