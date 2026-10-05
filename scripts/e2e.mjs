/**
 * End-to-end interaction tests: drive the real exported app in a browser,
 * press the actual buttons, and assert the stored state really changed.
 * Unit tests prove the engines; this proves the buttons are wired to them.
 */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
// Playwright may be a project dependency (CI installs it) or only present as a
// global (this dev box). Try the project first and fall back, rather than
// hardcoding one machine's layout and failing everywhere else.
const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    return createRequire("/opt/node22/lib/node_modules/x.js")("playwright");
  }
})();

const DIST = path.resolve("dist"); const PORT = 8120;
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ttf":"font/ttf",".woff":"font/woff",".woff2":"font/woff2",".ico":"image/x-icon",".map":"application/json"};
const server = http.createServer((req,res)=>{let url=decodeURIComponent(req.url.split("?")[0]);let file=path.join(DIST,url);if(!path.extname(url)||!fs.existsSync(file)){if(!path.extname(url))file=path.join(DIST,"index.html");}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(DIST,"index.html");const ext=path.extname(file);fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);res.end("nf");return;}res.writeHead(200,{"content-type":MIME[ext]||"application/octet-stream"});res.end(d);});});
await new Promise(r=>server.listen(PORT,r));

const results = []; const check=(n,p,d)=>results.push([n,p,d]);
// A failing selector rejects the top-level await; report what ran, then stop.
process.on("unhandledRejection", (e) => { try { report(e); } catch {} process.exit(1); });
const pad=n=>String(n).padStart(2,"0"); const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const now=new Date(); const today=iso(now); const dayAgo=n=>{const d=new Date(now);d.setDate(d.getDate()-n);return iso(d);};

// The consent gate stands in front of every screen, so a seeded user has to
// have accepted the current documents or the whole suite would only ever
// exercise the gate. Read out of the source rather than hardcoded: bumping
// LEGAL.version must not quietly turn every test below into a gate test.
const LEGAL_VERSION = Number(/version:\s*(\d+)/.exec(fs.readFileSync("src/legal/config.ts","utf8"))[1]);

const seed = {
  legal:{version:LEGAL_VERSION,acceptedAt:now.toISOString()},
  // Both opt-ins off — the state a person is in unless they say otherwise, and
  // the one that proves every screen works with nothing leaving the device.
  consent:{cloud:false,ai:false,updatedAt:now.toISOString()},
  profile:{name:"טסט",onboarded:true,startKg:85,heightCm:180,updatedAt:"1970-01-01T00:00:00.000Z"},
  habits:[{id:"h1",title:"לשתות מים",slot:"morning",createdAt:dayAgo(10),archived:false,updatedAt:now.toISOString()}],
  completions:[],weighIns:[],checkIns:[],
  pantry:"חזה עוף, אורז, ביצים, עגבנייה, מלפפון, יוגורט יווני, בננה, לחם, טונה, חסה, גבינה לבנה, שמן זית, בטטה, ברוקולי, שיבולת שועל, אגוזים",
  salt:"e2e-salt",
  nutritionGoal:"cut", dietFilter:"all",
  training:{goal:"recomp",days:3,minutes:60,equipment:"gym",planSeed:"e2e-4",log:{},custom:[],weights:{},
    // last time this person benched, two days ago — the set table must show it back
    setLog:{[dayAgo(2)]:{"bench-press":[{kg:70,reps:8,done:true},{kg:70,reps:7,done:true},{kg:65,reps:8,done:true}]}}},
};

const browser = await chromium.launch({headless:true});
// The web build ships a Content-Security-Policy (public/index.html). Any refusal
// is a feature the policy broke, or an undeclared host the app started
// contacting. The browser does not put these on page.on("console"), so each
// page's own securitypolicyviolation event reports back here — wired into
// newContext itself, so a context added to this file later is covered too.
const cspViolations=[];
{ const open=browser.newContext.bind(browser);
  browser.newContext=async(opts)=>{ const c=await open(opts);
    await c.exposeBinding("__cspViolation",(_src,v)=>cspViolations.push(String(v).slice(0,200)));
    await c.addInitScript(()=>document.addEventListener("securitypolicyviolation",e=>window.__cspViolation(`${e.violatedDirective} ${e.blockedURI}`)));
    return c; }; }
const ctx = await browser.newContext({viewport:{width:412,height:915}});
// The exercise tiles now hotlink real photos from a public CDN. On a phone that
// loads fine, but on the CI runner the CDN host is unreachable and each request
// hangs instead of failing fast — which would keep "networkidle" from ever
// firing. Abort those requests so the suite stays hermetic: the app is built to
// fall back to the drawn muscle map whenever an image fails, so this exercises
// the exact path a phone with no signal would take.
await ctx.route("**://cdn.jsdelivr.net/**", r=>r.abort());
// Same for the meal photos, which search Wikimedia Commons and then load the
// thumbnail it points at. Aborting both the search and the image is the
// no-signal path the kitchen is built for: every meal card keeps the plate it
// draws from its own ingredients.
await ctx.route("**://commons.wikimedia.org/**", r=>r.abort());
await ctx.route("**://upload.wikimedia.org/**", r=>r.abort());
await ctx.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");}catch{}}, JSON.stringify(seed));
const page = await ctx.newPage();
const crashes=[]; page.on("pageerror",e=>crashes.push(String(e).slice(0,160)));

const go = async (route)=>{ await page.goto(`http://localhost:${PORT}${route}`,{waitUntil:"load"}); await page.waitForTimeout(1600); };
const st = async ()=> JSON.parse(await page.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
const settle = ()=>page.waitForTimeout(700);
// Tab screens stay mounted behind a pushed screen, and several of them reuse a
// placeholder ("קילוגרם", "ס״מ", the custom-exercise box). Matching on the
// visible one is the difference between driving the screen under test and
// silently typing into a hidden copy of it.
const box = (placeholder)=>page.locator(`input[placeholder="${placeholder}"]:visible, textarea[placeholder="${placeholder}"]:visible`).first();

// 1) every tab renders its heading
for (const [route,heading] of [["/","ההרגלים שלך"],["/kitchen","המטבח"],["/workout","האימון"],["/water","מים"],["/checkin","סיכום היום"],["/progress","התקדמות"],["/profile","פרופיל"]]) {
  await go(route);
  check(`route ${route} renders`, await page.getByText(heading).first().isVisible().catch(()=>false), heading);
}

// 2) TODAY — ticking a habit writes a completion
await go("/");
await page.getByRole("checkbox").first().click(); await settle();
{ const s=await st(); check("habit tick is stored as done",
   s.completions.some(c=>c.habitId==="h1"&&c.date===today&&c.done===true), JSON.stringify(s.completions)); }
await page.getByRole("checkbox").first().click(); await settle();
{ const s=await st(); check("unticking stores done:false (not a deleted row)",
   s.completions.some(c=>c.habitId==="h1"&&c.date===today&&c.done===false), JSON.stringify(s.completions)); }

// 3) WATER — its own tab now, + / −
await go("/water");
await page.getByLabel("הוסף כוס מים").click(); await settle();
await page.getByLabel("הוסף כוס מים").click(); await settle();
{ const s=await st(); check("water + twice stores two 250 ml glasses (500 ml)", (s.waterMl?.[today]??0)===500, String(s.waterMl?.[today])); }
await page.getByLabel("הורד כוס מים").click(); await settle();
{ const s=await st(); check("water − takes one glass off (250 ml)", (s.waterMl?.[today]??0)===250, String(s.waterMl?.[today])); }
await page.getByLabel("הורד כוס מים").click(); await settle();
{ const s=await st(); check("water never goes negative", (s.waterMl?.[today]??0)===0, String(s.waterMl?.[today])); }
// at zero the − is a dead control unless it says so: it must be disabled, not
// lit and unresponsive
check("the − turns itself off at zero rather than doing nothing",
  await page.getByLabel("הורד כוס מים").first().isDisabled().catch(()=>false));

// 3b) WATER — the bottle shows a recommended range and a settable goal
check("a recommended water range is shown",
  await page.getByText(/מומלץ .* ליטר ביום/).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"שנה יעד"}).first().click(); await settle();
// the cup size lives in the same editor — the vessel the person drinks from
check("the cup-size options are offered",
  await page.getByText("גודל כוס").first().isVisible().catch(()=>false));
await page.getByRole("button",{name:/500 מ/}).first().click(); await settle();
{ const s=await st(); check("a chosen cup size is stored", s.cupMl===500, String(s.cupMl)); }
{ // a glass drunk at 500 ml stays 500 ml when the glass size changes back
  await page.getByLabel("הוסף כוס מים").click(); await settle();
  await page.getByRole("button",{name:/250 מ/}).first().click(); await settle();
  const s=await st();
  check("changing the glass never rescales what was drunk", (s.waterMl?.[today]??0)===500, String(s.waterMl?.[today]));
  await page.getByLabel("הורד כוס מים").click(); await settle();
  await page.getByLabel("הורד כוס מים").click(); await settle(); }
{ // the goal chips are litres; 3 L sits inside the band for the seeded weight
  await page.getByRole("button",{name:"3 ל׳",exact:true}).first().click(); await settle();
  const s=await st();
  check("choosing a water goal stores it in ml", s.waterGoalMl===3000, String(s.waterGoalMl)); }

// 3c) KITCHEN — a saved list comes back as a list, not an empty box
await go("/kitchen");
check("a saved pantry is shown back, not re-asked for",
  await page.getByText("חזה עוף",{exact:true}).first().isVisible().catch(()=>false));
check("the edit box is not what greets a returning user",
  (await page.getByRole("button",{name:"בנה לי מנות"}).count())===0);
await page.getByRole("button",{name:"שנה את הרשימה"}).first().click(); await settle();
{ const listBox = page.getByPlaceholder(/לדוגמה: ביצים/).first();
  check("editing re-opens with the saved list already in the box",
    (await listBox.inputValue()).includes("חזה עוף"), await listBox.inputValue()); }
await page.getByRole("button",{name:"בנה לי מנות"}).first().click(); await settle();

// 4) KITCHEN — the goal chips visibly re-plate, not just re-sort.
// For a returning user the set-once configuration now lives behind a settings
// row, so that the food they log every day is what greets them; open it first.
const openKitchenSettings = async () => {
  if ((await page.getByText("חיטוב",{exact:true}).count())===0) {
    await page.getByRole("button",{name:/הגדרות/}).first().click(); await settle();
  }
};
await openKitchenSettings();
check("the daily controls come before the set-once configuration",
  await page.getByPlaceholder(/מה אכלת/).first().isVisible().catch(()=>false));
{ const plateText = async () => (await page.getByText(/^שילוב מהמצרכים שלך/).first().textContent().catch(()=>""))??"";
  await page.getByText("חיטוב",{exact:true}).first().click(); await settle();
  const cut = await plateText();
  { const s=await st(); check("the goal chip persists", s.nutritionGoal==="cut", s.nutritionGoal); }
  check("the cut plate says what it did to the portions", cut.includes("לחיטוב"), cut.slice(0,90));
  await page.getByText("מסה",{exact:true}).first().click(); await settle();
  const bulk = await plateText();
  { const s=await st(); check("switching to bulk persists", s.nutritionGoal==="bulk", s.nutritionGoal); }
  check("the bulk plate is a different plate", bulk!==cut && bulk.includes("למסה"), bulk.slice(0,90));
  check("a goal-fit score is shown on the dishes",
    await page.getByText(/% ל/).first().isVisible().catch(()=>false));
  await page.getByText("חיטוב",{exact:true}).first().click(); await settle(); }

// 4b) KITCHEN — the diet filter visibly removes dishes
await openKitchenSettings();
await page.getByText("כשר",{exact:true}).click(); await settle();
{ const s=await st(); check("diet filter persists", s.dietFilter==="kosher", s.dietFilter); }
check("the kosher filter reports what it hid",
  await page.getByText(/מנות בתפריט לא עומדות בסינון/).first().isVisible().catch(()=>false));
await page.getByText("הכל",{exact:true}).click(); await settle();
check("the open filter hides nothing",
  (await page.getByText(/מנות בתפריט לא עומדות בסינון/).count())===0);

// 5) KITCHEN — log a meal, then remove it
await page.getByRole("button",{name:"אכלתי את זה"}).first().click(); await settle();
{ const s=await st(); check("logging a meal fills today's diary", (s.intake?.[today]??[]).length===1,
   JSON.stringify(s.intake?.[today])); }
await page.getByLabel("הסר מהיומן").first().click(); await settle();
{ const s=await st(); check("removing a logged meal empties the diary", (s.intake?.[today]??[]).length===0); }
await page.getByRole("button",{name:"בטל",exact:true}).first().click(); await settle();
{ const s=await st(); check("a removed meal can be brought back with undo", (s.intake?.[today]??[]).length===1); }
await page.getByLabel("הסר מהיומן").first().click(); await settle();

// 5b) KITCHEN — quick-log: search a food, say how much, and it is in the diary
await page.getByPlaceholder(/מה אכלת/).first().fill("אורז"); await settle();
// Exact: a menu dish with rice in its name is also a button, and the menu
// rotates, so a substring match lands on whichever dish today happens to be.
check("search shows a result", await page.getByRole("button",{name:"אורז",exact:true}).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"אורז",exact:true}).first().click(); await settle();
check("tapping a food asks how much", await page.getByText("כמה אכלת?").first().isVisible().catch(()=>false));
{ const before = await page.getByText(/\d+ גרם · \d+ קלוריות/).first().innerText().catch(()=>"");
  // the portion chip, not the menu's "×2" portion further up the kitchen
  await page.getByRole("button",{name:/×2/}).first().click(); await settle();
  const after = await page.getByText(/\d+ גרם · \d+ קלוריות/).first().innerText().catch(()=>"");
  check("two portions double the amount shown", before !== after && /150 גרם/.test(after), `${before} → ${after}`); }
await page.getByText("רשום ביומן").first().click(); await settle();
{ const s=await st(); const items=s.intake?.[today]??[];
  check("quick-log adds the searched food to the diary, with how much",
    items.some(i=>i.label==="אורז · 150 גרם"&&i.kcal===548), JSON.stringify(items)); }
{ const cleared = await page.getByPlaceholder(/מה אכלת/).first().inputValue();
  check("the search box clears after logging", cleared==="", cleared); }
await page.getByPlaceholder(/מה אכלת/).first().fill("קשקושבלבל"); await settle();
check("a nonsense search says so rather than listing everything",
  await page.getByText("לא מצאתי. נסה שם אחר או חלק מהמילה.").first().isVisible().catch(()=>false));
await page.getByPlaceholder(/מה אכלת/).first().fill(""); await settle();
// tidy up so later assertions start clean
for (let i=0;i<3;i++){ const b=page.getByLabel("הסר מהיומן").first();
  if (await b.count()===0) break; await b.click(); await page.waitForTimeout(500); }

// 5c) KITCHEN — yesterday's forgotten dinner: step back a day and log into it
await page.getByRole("button",{name:"יום קודם"}).first().click(); await settle();
check("the diary steps back to yesterday", await page.getByText("נרשם · אתמול").first().isVisible().catch(()=>false));
check("and the quick log says where it will write", await page.getByText("נרשם ליום: אתמול").first().isVisible().catch(()=>false));
await page.getByPlaceholder(/מה אכלת/).first().fill("אורז"); await settle();
await page.getByRole("button",{name:"אורז",exact:true}).first().click(); await settle();
await page.getByText("רשום ביומן").first().click(); await settle();
{ const s=await st();
  check("it lands on yesterday, not today", (s.intake?.[dayAgo(1)]??[]).some(i=>i.label.startsWith("אורז")) && (s.intake?.[today]??[]).length===0,
    JSON.stringify({y:s.intake?.[dayAgo(1)], t:s.intake?.[today]})); }
await page.getByLabel("הסר מהיומן").first().click(); await settle();
{ const s=await st(); check("and comes off yesterday too", (s.intake?.[dayAgo(1)]??[]).length===0); }
check("a week back is as far as it goes", await (async()=>{
  for (let i=0;i<8;i++) { const b=page.getByRole("button",{name:"יום קודם"}).first(); if (await b.isDisabled()) return i===5; await b.click(); await page.waitForTimeout(250); }
  return false; })());
for (let i=0;i<7;i++){ const b=page.getByRole("button",{name:"יום הבא"}).first(); if (await b.isDisabled()) break; await b.click(); await page.waitForTimeout(200); }

// 6) KITCHEN — star a meal
await page.getByLabel("סמן מנה אהובה").first().click(); await settle();
{ const s=await st(); check("starring a meal stores a favourite", (s.favorites??[]).length===1, JSON.stringify(s.favorites)); }
await page.getByLabel("סמן מנה אהובה").first().click(); await settle();
{ const s=await st(); check("unstarring removes it", (s.favorites??[]).length===0); }

// 7) PROGRESS — measurements now live in the progress corner
await go("/progress");
await page.getByPlaceholder(/ס.\u05de/).first().fill("83"); await page.waitForTimeout(200);
await page.getByPlaceholder(/ס.מ/).first().press("Enter"); await settle();
{ const s=await st(); check("a measurement is stored for the waist",
   (s.measurements?.waist??[]).some(r=>r.cm===83&&r.date===today), JSON.stringify(s.measurements)); }

// 7b) PROGRESS — a body-fat estimate appears once sex + waist are known
await page.getByRole("button",{name:"גבר",exact:true}).first().click(); await settle();
check("a body-fat estimate is shown from waist, height and sex",
  // The range sits inside direction marks (src/i18n/bidi.ts) so it reads 15–20, not 20–15.
  await page.getByText(/יעד ל.* \u2066?[0-9]+.[0-9]+\u2069?%/).first().isVisible().catch(()=>false));

// 8) PROGRESS — an absurd value is refused
await page.getByPlaceholder(/ס.\u05de/).first().fill("9999"); await page.waitForTimeout(200);
await page.getByPlaceholder(/ס.מ/).first().press("Enter"); await settle();
{ const s=await st(); check("an out-of-range measurement is refused",
   (s.measurements?.waist??[]).every(r=>r.cm!==9999)); }

// 9) WORKOUT — fill one set at a time, Hevy style
await go("/workout");
const kg1 = page.getByLabel(/ק.ג 1$/).first();
const reps1 = page.getByLabel(/חזרות 1$/).first();
check("the set table is on screen, not a single weight box", await kg1.isVisible().catch(()=>false));
check("last session's set is shown in the previous column",
  await page.getByText("70×8",{exact:true}).first().isVisible().catch(()=>false));
check("last session's second set is shown too",
  await page.getByText("70×7",{exact:true}).first().isVisible().catch(()=>false));
check("the previous weight is offered as the placeholder",
  (await kg1.getAttribute("placeholder"))==="70", await kg1.getAttribute("placeholder"));
check("the previous reps are offered too",
  (await reps1.getAttribute("placeholder"))==="8", await reps1.getAttribute("placeholder"));
check("the coach says what to lift today, from last time",
  await page.getByText(/^🎯 היום: \u2066?70\u2069? ק״ג × 8 · חזרה אחת יותר/).first().isVisible().catch(()=>false));
check("the workout screen has a coach for the week", await page.getByText("המאמן שלך").first().isVisible().catch(()=>false));
await kg1.fill("72.5"); await page.waitForTimeout(250);
await reps1.fill("8"); await settle();
{ const s=await st(); const sets=s.training?.setLog?.[today]?.["bench-press"]??[];
  check("set 1 stores its own weight and reps", sets[0]?.kg===72.5&&sets[0]?.reps===8, JSON.stringify(sets)); }
await page.getByLabel(/ק.ג 2$/).first().fill("75"); await page.waitForTimeout(250);
await page.getByLabel(/חזרות 2$/).first().fill("6"); await settle();
{ const s=await st(); const sets=s.training?.setLog?.[today]?.["bench-press"]??[];
  check("set 2 is a separate row, not an overwrite",
    sets[0]?.kg===72.5&&sets[1]?.kg===75&&sets[1]?.reps===6, JSON.stringify(sets)); }

// 9a1) typing a weight key by key — the bug that made the set table unusable.
// .fill() sets a value in one shot and never reproduced it; a person types.
await kg1.fill(""); await page.waitForTimeout(200);
await kg1.pressSequentially("62.5", { delay: 90 }); await settle();
check("typing 62.5 one key at a time leaves 62.5 in the box",
  (await kg1.inputValue())==="62.5", await kg1.inputValue());
{ const s=await st(); const sets=s.training?.setLog?.[today]?.["bench-press"]??[];
  check("and 62.5 is what gets stored", sets[0]?.kg===62.5, String(sets[0]?.kg)); }
await kg1.fill(""); await page.waitForTimeout(200);
await kg1.pressSequentially("0", { delay: 90 }); await page.waitForTimeout(250);
check("a typed zero is not swallowed", (await kg1.inputValue())==="0", await kg1.inputValue());
await kg1.fill("72.5"); await page.waitForTimeout(250);

// 9a2) an absurd weight is clamped, not stored raw
await kg1.fill("999999"); await page.waitForTimeout(250);
{ const s=await st(); const sets=s.training?.setLog?.[today]?.["bench-press"]??[];
  check("a typo'd weight is capped at a sane ceiling", sets[0]?.kg===1000, String(sets[0]?.kg)); }
await kg1.fill("72.5"); await page.waitForTimeout(250);

// 9b) ticking one set marks the exercise done for the day
await page.getByRole("checkbox",{name:/לחיצת חזה במוט סט 1$/}).first().click(); await settle();
{ const s=await st(); const sets=s.training?.setLog?.[today]?.["bench-press"]??[];
  check("ticking a set stores done on that set", sets[0]?.done===true, JSON.stringify(sets));
  check("a ticked set marks the exercise done for the day",
    (s.training?.log?.[today]??[]).includes("bench-press"), JSON.stringify(s.training?.log?.[today])); }

// 9b1) ticking a set starts the rest clock by itself; skip it to carry on
check("ticking a set starts the rest timer", await page.getByText("דלג",{exact:true}).first().isVisible().catch(()=>false));
await page.getByText("דלג",{exact:true}).first().click(); await settle();

// 9b2) progression against last time is shown once a set is ticked
check("today's volume is shown", await page.getByText(/^נפח: /).first().isVisible().catch(()=>false));
check("the change against last time is shown",
  await page.getByText(/% מהפעם הקודמת/).first().isVisible().catch(()=>false));
check("an estimated one-rep-max is shown",
  await page.getByText(/1RM משוער/).first().isVisible().catch(()=>false));

// 9c) adding and removing a set
{ const before=(await st()).training?.setLog?.[today]?.["bench-press"]?.length??0;
  await page.getByRole("button",{name:"הוסף סט"}).first().click(); await settle();
  const after=(await st()).training?.setLog?.[today]?.["bench-press"]?.length??0;
  check("adding a set grows the table", after===before+1, `${before}→${after}`);
  await page.getByRole("button",{name:"הסר סט"}).first().click(); await settle();
  const back=(await st()).training?.setLog?.[today]?.["bench-press"]?.length??0;
  check("removing a set shrinks it again", back===before, `${after}→${back}`); }

// 9d) the library picker adds an exercise from the 74-move catalogue
await page.getByPlaceholder("חפש תרגיל או קבוצת שריר").first().fill("סקוואט"); await settle();
{ const hit = page.getByRole("button",{name:"סקוואט",exact:true}).first();
  check("the library finds a move by name", await hit.isVisible().catch(()=>false));
  await hit.click(); await settle();
  const s=await st();
  check("a library exercise joins today's session",
    (s.training?.extra?.[today]??[]).includes("squat"), JSON.stringify(s.training?.extra)); }
await page.getByPlaceholder("חפש תרגיל או קבוצת שריר").first().fill("קשקושבלבל"); await settle();
check("a nonsense exercise search says so",
  await page.getByText("לא מצאתי תרגיל כזה.").first().isVisible().catch(()=>false));
await page.getByPlaceholder("חפש תרגיל או קבוצת שריר").first().fill(""); await settle();

// 10) WORKOUT — finish the whole session in one press
await page.getByRole("button",{name:"סמן את כל האימון כבוצע"}).first().click(); await settle();
{ const s=await st(); const done=(s.training?.log?.[today]??[]);
  check("finishing a session ticks every exercise in it", done.length>=6, String(done.length)); }

// 10a) WORKOUT — a live session, Hevy-style: pick a day, start, the clock runs,
// finish saves a summary, and the burn raises today's calorie target.
check("the day picker prompt is shown", await page.getByText("איזה אימון עושים היום? בחר יום").first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"התחל",exact:true}).first().click(); await settle();
{ const s=await st(); const a=s.training?.active;
  check("start stores which day and when", a && typeof a.startedAt==="number" && a.day>0, JSON.stringify(a)); }
check("the live panel shows", await page.getByText("באימון",{exact:true}).first().isVisible().catch(()=>false));
{ const clock=page.getByRole("timer").first();
  const t1=await clock.innerText().catch(()=>""); await page.waitForTimeout(2200);
  const t2=await clock.innerText().catch(()=>"");
  check("the workout clock ticks", /\d+:\d\d/.test(t2) && t1!==t2, `${t1} → ${t2}`); }
check("a finish bar floats in reach", (await page.getByRole("button",{name:"סיים אימון"}).count())>=2);
await page.getByRole("button",{name:"סיים אימון"}).first().click(); await settle();
{ const s=await st(); const h=s.training?.history??[];
  check("finishing clears the running workout", !s.training?.active, JSON.stringify(s.training?.active));
  check("and saves it to history with its duration", h.length===1 && h[0].durationSec>=2, JSON.stringify(h)); }
check("a summary card congratulates", await page.getByText("כל הכבוד! האימון נשמר 🎉").first().isVisible().catch(()=>false));
check("the history card lists it", await page.getByText("היסטוריית אימונים").first().isVisible().catch(()=>false));
// The clock is derived from the stored start, so it survives the app being
// closed and counts real time: open the app on a workout begun 50 minutes ago.
{
  const lctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await lctx.route("**://cdn.jsdelivr.net/**", r=>r.abort());
  await lctx.addInitScript((seed)=>{try{
    if (localStorage.getItem("mystyle.state.v1")) return;
    const s=JSON.parse(seed); s.training.active={day:0,startedAt:Date.now()-50*60_000,date:s.__today};
    localStorage.setItem("mystyle.state.v1",JSON.stringify(s)); localStorage.setItem("mystyle.locale","he");
  }catch{}}, JSON.stringify({...seed, __today: today}));
  const lp = await lctx.newPage();
  await lp.goto(`http://localhost:${PORT}/workout`,{waitUntil:"load"}); await lp.waitForTimeout(1800);
  const shown=(await lp.getByRole("timer").first().innerText().catch(()=>"")).replace(/[\u2066\u2069]/g,"").trim();
  check("reopening the app, the clock shows the real elapsed time", /^50:\d\d$/.test(shown), shown);
  await lp.getByRole("button",{name:"סיים אימון"}).first().click(); await lp.waitForTimeout(700);
  const s=JSON.parse(await lp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  const h=s.training?.history??[];
  check("a 50-minute workout is saved with its burn", h.length===1 && h[0].durationSec>=2990 && h[0].kcal>100, JSON.stringify(h));
  await lp.goto(`http://localhost:${PORT}/`,{waitUntil:"load"}); await lp.waitForTimeout(1600);
  check("today's calorie card adds the workout to the target",
    await lp.getByText(/היום הרווחת \+\d+: אימון \d+/).first().isVisible().catch(()=>false));
  await lctx.close();
}

// 10b) WORKOUT — a cardio plan tuned to the goal is shown, with demo links
check("a cardio card appears",
  await page.getByText("אירובי לפי המטרה").first().isVisible().catch(()=>false));
check("the cardio card states a weekly frequency",
  await page.getByText(/פעמים בשבוע/).first().isVisible().catch(()=>false));

// 10c) WORKOUT — a new plan can be regenerated, and it re-rolls the moves
{ const firstMoves = async () => (await page.getByText(/^יעד /).allInnerTexts().catch(()=>[])).join("|");
  // regenerate button exists
  check("a regenerate-plan button exists",
    await page.getByRole("button",{name:"תוכנית חדשה"}).first().isVisible().catch(()=>false)); }

// 10d) WORKOUT — Hevy-style per-day editing: remove a move, add one to a day
await page.getByLabel("הסר תרגיל").first().click(); await settle();
{ const s=await st(); const edits=Object.values(s.training?.planEdits??{});
  check("removing a move from a day is recorded in the plan",
    edits.some(e=>(e.remove??[]).length>0), JSON.stringify(s.training?.planEdits)); }
// the Hevy-style browse-the-whole-library picker: open it, filter, pick, done
await page.getByRole("button",{name:"הוסף תרגיל ליום זה"}).first().click(); await settle();
check("the add-exercise sheet opens on the whole library",
  await page.getByText("הוסף תרגיל",{exact:true}).first().isVisible().catch(()=>false));
check("it offers muscle filters", (await page.getByRole("button",{name:"חזה"}).count())>0);
check("and shows the catalogue with more than a handful of moves",
  (await page.getByRole("button").filter({hasText:/לחיצת|סקוואט|חתירה|כפיפ/}).count())>3);
// pick a specific move by its visible name, then commit
// .last(): the sheet sits at the end of the page, and a folded day card behind
// it can list the same move in its summary.
const pickRow = page.getByRole("button").filter({hasText:"לחיצת חזה במוט"}).last();
await pickRow.click(); await settle();
check("selecting a move updates the add button to a count",
  (await page.getByRole("button",{name:/הוסף 1/}).count())>0);
await page.getByRole("button",{name:/הוסף 1/}).first().click(); await settle();
{ const s=await st(); const edits=Object.values(s.training?.planEdits??{});
  check("adding a move to a specific day sticks in the plan",
    edits.some(e=>(e.add??[]).includes("bench-press")), JSON.stringify(s.training?.planEdits)); }

// 11) WORKOUT — rest timer counts down
await page.getByText("60",{exact:true}).first().click(); await page.waitForTimeout(1500);
check("rest timer starts counting", await page.getByText("דלג",{exact:true}).first().isVisible().catch(()=>false));
await page.getByText("דלג",{exact:true}).first().click(); await settle();
check("skipping the rest timer returns the presets",
  await page.getByText("120",{exact:true}).first().isVisible().catch(()=>false));

// 12) CHECK-IN — mood + save
await go("/checkin");
await page.getByText("טוב",{exact:true}).first().click(); await page.waitForTimeout(300);
await page.getByRole("button",{name:"שמור"}).first().click(); await settle();
{ const s=await st(); check("a daily recap is saved",
   s.checkIns.some(c=>c.date===today&&c.mood==="good"), JSON.stringify(s.checkIns)); }

// 13) PROGRESS — weigh-in is validated then stored
await go("/progress");
await page.getByPlaceholder("קילוגרם").first().fill("666666"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"שמור משקל"}).first().click(); await settle();
{ const s=await st(); check("an absurd weight is refused", s.weighIns.length===0, String(s.weighIns.length)); }
await page.getByPlaceholder("קילוגרם").first().fill("84.2"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"שמור משקל"}).first().click(); await settle();
{ const s=await st(); check("a sane weight is stored", s.weighIns.some(w=>w.kg===84.2), JSON.stringify(s.weighIns)); }

// 14) ACHIEVEMENTS — opens from the stats tab and closes
await go("/progress");
await page.getByText("ההישגים שלך").first().click(); await settle();
check("achievements open from the stats card",
  await page.getByText("הישגים",{exact:true}).first().isVisible().catch(()=>false));

// 15) PROFILE — a saved name is shown back, and saving does not blank it
await go("/profile");
{ const box = page.getByPlaceholder(/השם שלך|Your name/).first();
  const shown = await box.inputValue().catch(()=>"");
  check("the saved name is in the field on open", shown==="טסט", shown); }
// The button used to be *labelled* "Saved" and produce no visible change at
// all, so there was no way to tell whether a profile had ever been written.
check("the save button asks to save rather than claiming it already did",
  (await page.getByRole("button",{name:"נשמר",exact:true}).count())===0);
await page.getByRole("button",{name:"שמור",exact:true}).first().click(); await settle();
{ const s=await st(); check("saving without editing keeps the name", s.profile.name==="טסט", s.profile.name); }
check("and saving says so on screen",
  await page.getByText("נשמר ✓").first().isVisible().catch(()=>false));

// 15b) RECIPE BOOK — every dish with its method: found, opened, cooked, logged
await go("/kitchen");
check("the kitchen opens the recipe book",
  await page.getByRole("button",{name:"ספר המתכונים"}).first().isVisible().catch(()=>false));
check("each meal card links to its method",
  (await page.getByRole("button",{name:/^הוראות הכנה ·/}).count())>0);
await page.getByRole("button",{name:"ספר המתכונים"}).first().click(); await settle();
check("the book lists over a hundred recipes",
  Number(((await page.evaluate(()=>document.body.innerText)).match(/(\d+) מתכונים/)||[])[1]||0) >= 130);
await page.getByPlaceholder(/חפש מתכון/).fill("טחינה"); await page.waitForTimeout(500);
{ const n=Number(((await page.evaluate(()=>document.body.innerText)).match(/(\d+) מתכונים/g)||[]).map(x=>parseInt(x)).pop()||0);
  check("searching an ingredient narrows the book", n>3 && n<60, String(n)); }
await page.getByPlaceholder(/חפש מתכון/).fill("שקשוקה"); await page.waitForTimeout(500);
await page.getByRole("button",{name:"שקשוקה",exact:true}).first().click(); await settle();
check("a recipe opens with its method",
  await page.getByText("איך מכינים").first().isVisible().catch(()=>false));
check("and the steps say what to do",
  await page.getByText(/שוברים לתוכן 2 ביצים/).first().isVisible().catch(()=>false));
check("and options for other diets",
  await page.getByText("אפשרויות לכל אחד").first().isVisible().catch(()=>false));
await page.getByRole("button",{name:/מנות \+/}).first().click(); await page.waitForTimeout(300);
check("the servings stepper rescales the amounts",
  await page.getByText("הכמויות ל-2 מנות").first().isVisible().catch(()=>false));
check("a timed step offers a timer",
  (await page.getByRole("button",{name:/טיימר \d+ דק׳/}).count())>0);
{ const before=((await st()).intake?.[today]??[]).length;
  await page.getByRole("button",{name:/רשום ביומן/}).first().click(); await settle();
  const s=await st(); const rows=s.intake?.[today]??[];
  check("logging from a recipe writes one serving to the diary",
    rows.length===before+1 && rows[rows.length-1]?.label==="שקשוקה", JSON.stringify(rows.slice(-1)));
  // take it back out, so the diary counts later in this run are unchanged
  await page.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("mystyle.state.v1")); for (const k of Object.keys(s.intake||{})) s.intake[k]=s.intake[k].filter(r=>r.label!=="שקשוקה"); localStorage.setItem("mystyle.state.v1", JSON.stringify(s)); }); }

// 16) KITCHEN — grams vs household units really change the amounts
await go("/kitchen");
{ // read the whole ingredient block of the first card, whatever its shape
  // "מה צריך" heads a row with the card's own grams switch; the ingredient
  // block is that row's parent.
  const readAmounts = async () => (await page.getByText("מה צריך").first()
    .locator("xpath=../..").innerText().catch(()=>"")) ?? "";
  const household = await readAmounts();
  await openKitchenSettings();
  await page.getByText("גרמים",{exact:true}).first().click(); await settle();
  const grams = await readAmounts();
  check("switching to grams changes the amounts shown", grams !== household, `${household.slice(0,60)} → ${grams.slice(0,60)}`);
  check("grams are actually shown in grams", /\d+\s*גרם/.test(grams), grams.slice(0,120));
  await page.getByText("יחידות",{exact:true}).first().click(); await settle();
  check("switching back restores household units", (await readAmounts()) === household);
  // and the same switch sits on every card, where the amounts are read
  await page.getByText("הצג בגרמים").first().click(); await settle();
  check("the card's own switch shows grams", /\d+\s*גרם/.test(await readAmounts()));
  await page.getByText("הצג ביחידות").first().click(); await settle();
  check("and switches back", (await readAmounts()) === household); }

// 17) KITCHEN — the kosher filter removes a named non-kosher dish
await page.getByText("הכל",{exact:true}).click(); await settle();
await page.getByText("מסה",{exact:true}).first().click(); await settle();
{ const seeBurger = async () => (await page.getByText("בורגר עם צהובה").count()) > 0;
  const seeShrimp = async () => (await page.getByText("שרימפס מוקפץ עם ירקות").count()) > 0;
  await page.getByText("כשר",{exact:true}).click(); await settle();
  check("no non-kosher dish is on screen under the kosher filter",
    !(await seeBurger()) && !(await seeShrimp()));
  check("the kosher filter says how many it hid",
    await page.getByText(/מנות בתפריט לא עומדות בסינון/).first().isVisible().catch(()=>false));
  await page.getByText("צמחוני",{exact:true}).click(); await settle();
  { const s=await st(); check("kosher and vegetarian combine", s.dietFilter==="kosher,vegetarian", s.dietFilter); }
  await page.getByText("כשר",{exact:true}).click(); await settle();
  { const s=await st(); check("switching kosher off leaves vegetarian on", s.dietFilter==="vegetarian", s.dietFilter); }
  check("no meat dish under the vegetarian filter",
    (await page.getByText("עוף עם אורז וברוקולי").count())===0);
  await page.getByText("הכל",{exact:true}).click(); await settle();
  await page.getByText("חיטוב",{exact:true}).first().click(); await settle(); }

// 18) KITCHEN — asking for other dishes really changes them
{ // the whole page's text: nothing else on this screen changes when the
  // suggestions are re-rolled, so a difference here is a difference in dishes
  const shown = async () => await page.evaluate(()=>document.body.innerText);
  const before = await shown();
  let changed = false;
  for (let i = 0; i < 6 && !changed; i++) {
    await page.getByRole("button",{name:"החלף מנות"}).first().click(); await settle();
    if ((await shown()) !== before) changed = true;
  }
  check("shuffling eventually serves different dishes", changed);
  { const s=await st(); check("the shuffle is remembered", (s.mealShuffle??0) > 0, String(s.mealShuffle)); } }

// 19) PROGRESS — steps are counted by the phone, not typed in
await go("/progress");
check("no manual step-adding buttons are offered any more",
  (await page.getByRole("button",{name:"+1000"}).count())===0);
check("no blank step box to fill in",
  (await page.getByPlaceholder("כמה צעדים סה״כ היום?").count())===0);
check("the step card explains that counting is automatic",
  await page.getByText(/ספירה אוטומטית|ספירת צעדים אוטומטית|מבקש הרשאה/).first().isVisible().catch(()=>false));
// the daily target is still the person's to set
await page.getByRole("button",{name:"שנה יעד יומי"}).first().click(); await settle();
await box("יעד צעדים ליום").fill("12000"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"שמור",exact:true}).last().click(); await settle();
{ const s=await st(); check("a new step goal is stored", s.stepGoal===12000, String(s.stepGoal)); }

// 20) PROFILE — an unhealthy goal weight cannot be stored, however it is tried
await go("/profile");
{ const goalBox = box("קילוגרם");
  const save = page.getByRole("button",{name:"שמור",exact:true}).first();

  await goalBox.fill("20"); await page.waitForTimeout(200);
  await save.click(); await settle();
  { const s=await st(); check("a 20 kg target is refused", s.profile.goalKg !== 20, String(s.profile.goalKg)); }
  check("the refusal is explained on screen",
    await page.getByText(/נמוך מדי ולא בריא|חייב להיות בין/).first().isVisible().catch(()=>false));

  await goalBox.fill("45"); await page.waitForTimeout(200);
  await save.click(); await settle();
  { const s=await st(); check("45 kg at 180 cm is refused too", s.profile.goalKg !== 45, String(s.profile.goalKg)); }

  // clearing the height must not open a back door
  await box("ס״מ").fill(""); await page.waitForTimeout(200);
  await goalBox.fill("20"); await page.waitForTimeout(200);
  await save.click(); await settle();
  { const s=await st(); check("deleting the height does not let 20 kg through", s.profile.goalKg !== 20, String(s.profile.goalKg)); }

  await box("ס״מ").fill("999"); await page.waitForTimeout(200);
  await save.click(); await settle();
  { const s=await st(); check("an absurd height is refused", s.profile.heightCm !== 999, String(s.profile.heightCm)); }

  await box("ס״מ").fill("180"); await page.waitForTimeout(200);
  await goalBox.fill("78"); await page.waitForTimeout(200);
  await save.click(); await settle();
  { const s=await st(); check("a sane target is accepted", s.profile.goalKg===78, String(s.profile.goalKg));
    check("the height is stored with it", s.profile.heightCm===180, String(s.profile.heightCm)); }
  check("the healthy range is shown to aim at",
    await page.getByText(/טווח בריא לגובה שלך/).first().isVisible().catch(()=>false)); }

// 21) LIBRARY — browse the whole catalogue, filter it, and add from it
await go("/workout");
await page.getByRole("button",{name:"פתח את כל המאגר"}).first().click(); await settle();
check("the library opens", await page.getByText("מאגר התרגילים").first().isVisible().catch(()=>false));
check("the catalogue is Hevy-sized",
  await page.getByText(/1[0-9][0-9] תרגילים|[2-9][0-9][0-9] תרגילים/).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"חזה",exact:false}).first().click(); await settle();
check("a muscle filter narrows the list",
  await page.getByText(/^מוצגים \d+$/).first().isVisible().catch(()=>false));
check("filtering by chest hides a leg move", (await page.getByRole("button",{name:"סקוואט",exact:true}).count())===0);
await page.getByRole("button",{name:"כל השרירים"}).first().click(); await settle();
await box("חפש תרגיל, שריר או ציוד").fill("ביצפס"); await settle();
check("Hebrew gym slang finds the right muscle's moves",
  await page.getByRole("button",{name:"כפיפת מרפק",exact:true}).first().isVisible().catch(()=>false));
check("and the slang search is not just returning everything",
  (await page.getByRole("button",{name:"סקוואט",exact:true}).count())===0);
await box("חפש תרגיל, שריר או ציוד").fill("סמית"); await settle();
{ const hit = page.getByRole("button",{name:"לחיצת חזה בסמית'",exact:true}).first();
  check("a Smith machine move is in the library", await hit.isVisible().catch(()=>false));
  await hit.click(); await settle();
  const s=await st();
  check("a library move joins today's session",
    (s.training?.extra?.[today]??[]).includes("smith-bench"), JSON.stringify(s.training?.extra)); }
await box("חפש תרגיל, שריר או ציוד").fill("קשקושבלבל"); await settle();
check("an empty result offers to add it yourself",
  await page.getByText(/אפשר להוסיף אותו בעצמך/).first().isVisible().catch(()=>false));
await box("לדוגמה: כפיפת בטן צדדית").fill("סחיבת מזוודה"); await settle();
await page.getByRole("button",{name:"הוסף לאימון של היום"}).first().click(); await settle();
{ const s=await st();
  check("a move of your own is saved to the library",
    (s.training?.custom??[]).some(c=>c.he==="סחיבת מזוודה"), JSON.stringify((s.training?.custom??[]).map(c=>c.he)));
  check("and joins today's session",
    (s.training?.extra?.[today]??[]).some(id=>id.startsWith("own-"))); }

check("no uncaught page errors during the whole run", crashes.length===0, crashes.join(" | "));

// 22) COACH — a chat that answers from this person's own numbers
await go("/");
await page.getByRole("button",{name:"שאל את המאמן"}).first().click(); await settle();
check("the coach opens", await page.getByText("המאמן שלך").first().isVisible().catch(()=>false));
check("openers are offered rather than a blank box",
  await page.getByRole("button",{name:"כמה מים שתיתי?"}).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"כמה מים שתיתי?"}).first().click(); await settle();
check("the coach answers with this person's real water numbers",
  await page.getByText(/שתית .* ליטר/).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"מה התוכנית שלי אומרת?"}).first().click(); await settle();
check("the coach answers about the plan using the goal",
  await page.getByText(/תוכנית שלך בנויה/).first().isVisible().catch(()=>false));
{ const t = await page.evaluate(()=>document.body.innerText);
  check("the coach quotes the weekly training frequency", /3 ימים בשבוע/.test(t), t.slice(0,200)); }

// 15) A BRAND-NEW ACCOUNT CAN BUILD A PLAN.
// The complaint was "the user cannot build a plan": the logic was fine, the
// button was buried under six cards of setup. This asserts it is reachable
// without scrolling, in both modes, on a phone-sized viewport.
{
  const fresh = await browser.newContext({ viewport: { width: 393, height: 852 } });
  await fresh.addInitScript((seed)=>{try{
    const s=JSON.parse(seed); delete s.training;
    localStorage.setItem("mystyle.state.v1",JSON.stringify(s));
    localStorage.setItem("mystyle.locale","he");
  }catch{}}, JSON.stringify(seed));
  const p2 = await fresh.newPage();
  const boom=[]; p2.on("pageerror",e=>boom.push(String(e).slice(0,160)));
  await p2.goto(`http://localhost:${PORT}/workout`,{waitUntil:"networkidle"});
  await p2.waitForTimeout(1800);

  const build = p2.getByRole("button",{name:/בנה לי תוכנית/}).first();
  check("a new account is offered a build button", await build.isVisible().catch(()=>false));
  // above the fold: inside the viewport before any scrolling
  const box = await build.boundingBox().catch(()=>null);
  check("and it is on screen without scrolling", !!box && box.y + box.height < 852,
    JSON.stringify(box));

  check("both ways of getting a plan are offered",
    (await p2.getByRole("button",{name:"תבנה לי"}).count())>0 &&
    (await p2.getByRole("button",{name:"אני אבנה"}).count())>0);

  // the level decides what the plan asks of the body: a beginner is not handed
  // deadlifts and pull-ups
  check("the setup asks for your level", await p2.getByText("מה הרמה שלך?").first().isVisible().catch(()=>false));
  await p2.getByText("מתחיל", { exact: true }).first().click(); await p2.waitForTimeout(300);

  await build.click(); await p2.waitForTimeout(1400);
  const st2 = JSON.parse(await p2.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  check("the chosen level is saved with the plan", st2.training?.level === "beginner", String(st2.training?.level));
  check("the plan says it is a beginner plan", /מתחיל · 3 סטים/.test(await p2.locator("body").innerText()));
  check("and hands a beginner no deadlift or pull-ups",
    !/דדליפט במוט|^מתח$/m.test(await p2.locator("body").innerText()));
  check("pressing it actually writes a plan", !!st2.training && st2.training.days>0,
    JSON.stringify(st2.training??null));
  // the plan is real when its set table is on screen, not just a heading
  check("the built plan shows the exercises with their set tables",
    (await p2.getByLabel(/ק.ג 1$/).count())>0);
  check("every move in the plan carries a picture",
    (await p2.getByLabel(/צפה בהדגמה/).count())>0);
  // the picture is a body with the worked muscle lit, not a decorative tile:
  // opening a move must name what it works, in words as well as in the drawing
  await p2.getByRole("button",{name:/הצג הסבר/}).first().click();
  await p2.waitForTimeout(700);
  check("opening a move says which muscle it works",
    await p2.getByText("עובד על").first().isVisible().catch(()=>false));
  check("and names the muscles that help",
    await p2.getByText(/ועוזרים:/).first().isVisible().catch(()=>false));
  check("building a plan raises no page errors", boom.length===0, boom.join(" | "));

  // and the self-built path leaves the days empty for the person to fill
  await p2.getByRole("button",{name:"אני אבנה"}).first().click(); await p2.waitForTimeout(900);
  check("switching to self-build offers a way to add a move to a day",
    (await p2.getByRole("button",{name:"הוסף תרגיל ליום זה"}).count())>0);
  await fresh.close();
}

// 16) THE CONSENT GATE — the one screen nobody may walk past.
// Its own context, seeded without an acceptance: this is what a new install
// and an existing user after a version bump both look like.
{
  const fresh = await browser.newContext({viewport:{width:412,height:915}});
  await fresh.addInitScript(s=>{try{
    localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");
  }catch{}}, JSON.stringify({...seed, legal:undefined, consent:undefined}));
  const gate = await fresh.newPage();
  const gst = async ()=> JSON.parse(await gate.evaluate(()=>localStorage.getItem("mystyle.state.v1")));

  await gate.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"});
  await gate.waitForTimeout(2200);
  check("an unaccepted install lands on the consent gate",
    gate.url().includes("/legal/consent"), gate.url());
  check("the gate offers the privacy policy",
    await gate.getByText("מדיניות הפרטיות המלאה").first().isVisible().catch(()=>false));

  // The optional switches must be off before anyone touches them: a default-on
  // consent is not consent, and this is the assertion that keeps it that way.
  const before = await gst();
  check("nothing is consented to by default",
    !before.consent || (!before.consent.cloud && !before.consent.ai), JSON.stringify(before.consent));

  const cloudSwitch = gate.locator('[role=switch], input[type=checkbox]').first();
  await cloudSwitch.click(); await gate.waitForTimeout(600);
  { const s = await gst(); check("turning cloud backup on is recorded",
    s.consent?.cloud === true && s.consent?.ai === false, JSON.stringify(s.consent)); }

  await gate.getByText("אני מאשר ומתחיל").first().click();
  await gate.waitForTimeout(2200);
  { const s = await gst(); check("accepting records the version that was shown",
    s.legal?.version === LEGAL_VERSION, JSON.stringify(s.legal)); }
  check("accepting lets the app through", !gate.url().includes("/legal/consent"), gate.url());

  await gate.goto(`http://localhost:${PORT}/legal/terms`,{waitUntil:"networkidle"});
  await gate.waitForTimeout(1500);
  check("the terms open and lead with the health disclaimer",
    await gate.getByText("זו לא עצה רפואית").first().isVisible().catch(()=>false));

  await gate.close();
  await fresh.close();
}

// Payments are switched on in one constant (src/billing/launch.ts). Until they
// are, nobody can buy Pro, so the app must hold nothing back behind it — the
// launch-day paywall and limits are asserted only once it is live.
const PAYMENTS_LIVE = /PAYMENTS_LIVE\s*=\s*true/.test(fs.readFileSync("src/billing/launch.ts","utf8"));
if (!PAYMENTS_LIVE) {
  await go("/profile");
  check("before launch, the profile offers no Pro that cannot be bought",
    (await page.getByText("APEX Pro").count())===0);
  const mk = (n) => Array.from({length:n},(_,i)=>({ id:`g${i}`, title:`הרגל ${i+1}`, slot:"morning",
    createdAt:dayAgo(3), archived:false, updatedAt:now.toISOString() }));
  const ctx2 = await browser.newContext({viewport:{width:393,height:852}});
  await ctx2.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");}catch{}},
    JSON.stringify({...seed, habits: mk(12), subscription:{ status:"expired", currentPeriodEnd:"2020-01-01T00:00:00.000Z" }}));
  const pg = await ctx2.newPage(); const errs=[]; pg.on("pageerror",e=>errs.push(String(e).slice(0,160)));
  await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
  check("before launch, twelve habits and a lapsed account meet no wall",
    (await pg.getByLabel("זה נפתח ב-Pro").count())===0);
  check("and every habit is listed", (await pg.getByRole("checkbox").count())===12, String(await pg.getByRole("checkbox").count()));
  await pg.goto(`http://localhost:${PORT}/paywall`,{waitUntil:"networkidle"}); await pg.waitForTimeout(1500);
  check("the paywall, opened directly, says it is not open yet", errs.length===0 && (await pg.locator("body").innerText()).length>0, errs.join(" | "));
  await ctx2.close();
} else {
// 17) THE PAYWALL — it must be reachable, honest, and never crash signed-out.
await go("/profile");
check("the subscription is reachable from the profile",
  await page.getByText("APEX Pro").first().isVisible().catch(()=>false));
await page.getByText("APEX Pro").first().click(); await page.waitForTimeout(1600);
check("tapping it opens the paywall", page.url().includes("/paywall"), page.url());
check("the paywall names both plans",
  (await page.getByText("חודשי").count())>0 && (await page.getByText("שנתי").count())>0);
check("the yearly plan shows what it saves",
  await page.getByText(/חוסך \d+%/).first().isVisible().catch(()=>false));
check("it says the subscription renews by itself",
  await page.getByText(/מתחדש אוטומטית/).first().isVisible().catch(()=>false));
check("and says how to cancel",
  await page.getByText(/לביטול/).first().isVisible().catch(()=>false));
check("what stays free is stated, not hidden",
  await page.getByText(/נשאר חינם/).first().isVisible().catch(()=>false));
check("the paywall raises no page errors", crashes.length===0, crashes.join(" | "));

// 18) THE FREE-TIER LIMITS ACTUALLY BITE — and never break what exists.
// A paywall that promises a limit and does not enforce it has nothing to sell;
// a limit that deletes or disables what someone already made is worse than no
// limit at all. Both halves are asserted here.
{
  const mk = (n) => Array.from({length:n},(_,i)=>({
    id:`g${i}`, title:`הרגל ${i+1}`, slot:"morning", createdAt:dayAgo(3),
    archived:false, updatedAt:now.toISOString(),
  }));
  const seedWith = (habits, extra={}) => JSON.stringify({...seed, habits, ...extra});

  const open = async (state) => {
    const ctx2 = await browser.newContext({viewport:{width:393,height:852}});
    await ctx2.addInitScript(s=>{try{
      localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");
    }catch{}}, state);
    const pg = await ctx2.newPage();
    const errs=[]; pg.on("pageerror",e=>errs.push(String(e).slice(0,160)));
    return { ctx2, pg, errs };
  };

  // Under the limit: nothing is gated, and no trace of the paywall shows.
  { const { ctx2, pg, errs } = await open(seedWith(mk(2)));
    await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
    check("under the limit, a free account sees no gate",
      (await pg.getByLabel("זה נפתח ב-Pro").count())===0);
    check("and its habits are all listed", (await pg.getByRole("checkbox").count())>=2,
      String(await pg.getByRole("checkbox").count()));
    check("no page errors under the limit", errs.length===0, errs.join(" | "));
    await ctx2.close(); }

  // At the limit: the gate appears, and everything already there still works.
  { const { ctx2, pg, errs } = await open(seedWith(mk(3)));
    await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
    check("at the limit the gate is shown, not a dead button",
      (await pg.getByLabel("זה נפתח ב-Pro").count())>0);
    check("the habits already written are still all there",
      (await pg.getByRole("checkbox").count())===3, String(await pg.getByRole("checkbox").count()));
    // The whole point: a limit stops the next one, it does not disable the app.
    await pg.getByRole("checkbox").first().click(); await pg.waitForTimeout(900);
    { const st2 = JSON.parse(await pg.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
      check("and ticking one still works at the limit",
        (st2.completions??[]).some(c=>c.done===true), JSON.stringify(st2.completions)); }
    check("the gate routes somewhere rather than doing nothing", await (async()=>{
      await pg.getByLabel("זה נפתח ב-Pro").first().click(); await pg.waitForTimeout(1500);
      return pg.url().includes("/paywall");
    })(), pg.url());
    check("no page errors at the limit", errs.length===0, errs.join(" | "));
    await ctx2.close(); }

  // Finishing onboarding starts the trial, so nobody meets a wall in their
  // first minute. This is the check that a new install is not born limited.
  { const fresh2 = await browser.newContext({viewport:{width:393,height:852}});
    await fresh2.addInitScript(()=>{try{localStorage.setItem("mystyle.locale","he");}catch{}});
    const pg = await fresh2.newPage();
    await pg.goto(`http://localhost:${PORT}/onboarding`,{waitUntil:"networkidle"});
    await pg.waitForTimeout(1800);
    const before = await pg.evaluate(()=>localStorage.getItem("mystyle.state.v1"));
    check("a fresh install has no subscription yet",
      !before || !JSON.parse(before).subscription, String(before).slice(0,80));
    await fresh2.close(); }
  { const { ctx2, pg, errs } = await open(seedWith(mk(12), {
      subscription:{ status:"trialing", trialEndsAt: new Date(Date.now()+5*86400000).toISOString() } }));
    await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
    check("a trial is not metered — twelve habits, no gate",
      (await pg.getByLabel("זה נפתח ב-Pro").count())===0);
    check("no page errors during a trial", errs.length===0, errs.join(" | "));
    await ctx2.close(); }
  // An expired trial falls back to free, and still keeps everything written.
  { const { ctx2, pg, errs } = await open(seedWith(mk(12), {
      subscription:{ status:"trialing", trialEndsAt: new Date(Date.now()-86400000).toISOString() } }));
    await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
    check("an expired trial is limited again",
      (await pg.getByLabel("זה נפתח ב-Pro").count())>0);
    check("but keeps every habit written during it",
      (await pg.getByRole("checkbox").count())===12, String(await pg.getByRole("checkbox").count()));
    check("no page errors after a trial ends", errs.length===0, errs.join(" | "));
    await ctx2.close(); }

  // A paying account is never counted, however many it has.
  { const { ctx2, pg, errs } = await open(seedWith(mk(12), {
      subscription:{ status:"active", currentPeriodEnd:"2099-01-01T00:00:00.000Z" } }));
    await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
    check("a paying account with twelve habits sees no gate at all",
      (await pg.getByLabel("זה נפתח ב-Pro").count())===0);
    check("no page errors for a paying account", errs.length===0, errs.join(" | "));
    await ctx2.close(); }

  // An expired subscription keeps every habit — it only stops the next one.
  { const { ctx2, pg, errs } = await open(seedWith(mk(12), {
      subscription:{ status:"expired", currentPeriodEnd:"2020-01-01T00:00:00.000Z" } }));
    await pg.goto(`http://localhost:${PORT}/`,{waitUntil:"networkidle"}); await pg.waitForTimeout(2000);
    check("a lapsed account keeps every habit it ever wrote",
      (await pg.getByRole("checkbox").count())===12, String(await pg.getByRole("checkbox").count()));
    check("and is shown the way back rather than a broken screen",
      (await pg.getByLabel("זה נפתח ב-Pro").count())>0);
    check("no page errors for a lapsed account", errs.length===0, errs.join(" | "));
    await ctx2.close(); }
}

}

// 18b) THE PROGRESS JOURNEY — a photo a week, each beside its week's average,
// any two compared with the change between them, and a delete that asks twice.
{
  const px = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80"><rect width="60" height="80" fill="#c86"/></svg>');
  const jctx = await browser.newContext({viewport:{width:393,height:852}});
  const weighIns = [{date:dayAgo(42),kg:90.4},{date:dayAgo(0),kg:87.0}];
  const photos = [{id:"p1",uri:px,date:dayAgo(42),kg:90.4},{id:"p2",uri:px,date:dayAgo(21)},{id:"p3",uri:px,date:dayAgo(0),kg:87.0}];
  await jctx.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");}catch{}},
    JSON.stringify({...seed, weighIns, photos}));
  const jp = await jctx.newPage(); const jerr=[]; jp.on("pageerror",e=>jerr.push(String(e).slice(0,160)));
  await jp.goto(`http://localhost:${PORT}/progress`,{waitUntil:"networkidle"}); await jp.waitForTimeout(2200);
  const body = async ()=> (await jp.locator("body").innerText());
  check("the journey compares before and now", (await body()).includes("לפני") && (await body()).includes("עכשיו"));
  check("and says what changed, from the weekly averages", /ירדת \d+(\.\d)? ק"ג ב־6 שבועות/.test(await body()), (await body()).match(/ירדת[^\n]*/)?.[0]);
  check("the next weekly photo is scheduled", (await body()).includes("התמונה השבועית הבאה בעוד 7 ימים"));
  await jp.getByLabel(new RegExp(dayAgo(21))).first().click(); await jp.waitForTimeout(600);
  check("tapping a photo opens it with its choices", await jp.getByText("השווה כ'לפני'").first().isVisible().catch(()=>false));
  check("a photo from a week with no weigh-in says so", (await body()).includes("אין שקילה מהשבוע הזה"));
  await jp.getByText("מחק תמונה").first().click(); await jp.waitForTimeout(400);
  { const st2 = JSON.parse(await jp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
    check("one tap on delete does not delete", (st2.photos??[]).length===3); }
  await jp.getByText("בטוח? לחץ שוב כדי למחוק").first().click(); await jp.waitForTimeout(600);
  { const st2 = JSON.parse(await jp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
    check("the second tap deletes that photo only", (st2.photos??[]).length===2 && !(st2.photos??[]).some(p=>p.id==="p2")); }
  check("the journey raises no page errors", jerr.length===0, jerr.join(" | "));
  await jctx.close();
}

// 19) THE CALORIE CALCULATOR — the counting that works with no key and no
// network. This is the path most people will actually use, so it is asserted
// end to end: search, add, step, total, and the row that lands in the diary.
{
  const cctx = await browser.newContext({viewport:{width:393,height:852}});
  await cctx.addInitScript(s=>{try{
    localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");
  }catch{}}, JSON.stringify({...seed, intake:{}}));
  const cp = await cctx.newPage();
  const cerr=[]; cp.on("pageerror",e=>cerr.push(String(e).slice(0,160)));
  await cp.goto(`http://localhost:${PORT}/calc`,{waitUntil:"networkidle"});
  await cp.waitForTimeout(1800);

  check("the calculator opens", await cp.getByText("מחשבון קלוריות").first().isVisible().catch(()=>false));
  check("it starts empty and says so",
    await cp.getByText(/הצלחת ריקה/).first().isVisible().catch(()=>false));
  check("and it cannot log an empty plate",
    await cp.getByRole("button",{name:/רשום ליומן/}).first().isDisabled().catch(()=>false));

  await cp.getByPlaceholder(/ארוחה שלמה/).first().fill("ביצים"); await cp.waitForTimeout(700);
  await cp.getByRole("button",{name:"ביצים"}).first().click(); await cp.waitForTimeout(600);
  check("adding a food puts it on the plate",
    await cp.getByText(/100 גרם/).first().isVisible().catch(()=>false));
  check("one portion reads as one, in Hebrew that is a sentence",
    (await cp.getByText("1 מנות").count())===0);

  // The plate's total, as the day card previews it ("+143 על הצלחת").
  const readTotal = async () => Number((await cp.evaluate(()=>document.body.innerText)).match(/\+(\d+) על הצלחת/)?.[1] ?? -1);
  const t1 = await readTotal();
  // eggs: 143 kcal per 100 g (USDA), their own nutrition row
  check("a portion of eggs is its per-100 figure", t1 === 143, String(t1));
  await cp.getByLabel("עוד מנה").first().click(); await cp.waitForTimeout(600);
  const t2 = await readTotal();
  check("one more portion doubles it exactly", t2 === 286, `${t1} -> ${t2}`);
  await cp.getByLabel("פחות מנה").first().click(); await cp.waitForTimeout(600);
  check("and stepping back down returns to where it was", (await readTotal()) === 143);

  await cp.getByRole("button",{name:/הוסף ליומן/}).first().click(); await cp.waitForTimeout(1400);
  check("the day's total on the same screen rises by what was added",
    /קלוריות היום\s*\n\s*143\b/.test(await cp.evaluate(()=>document.body.innerText)));
  check("and it says so", await cp.getByText(/נוסף ליומן: 143/).first().isVisible().catch(()=>false));
  { const s2 = JSON.parse(await cp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
    const rows = Object.values(s2.intake ?? {}).flat();
    check("logging it writes exactly one diary row", rows.length === 1, JSON.stringify(rows));
    check("with the calories the screen showed",
      rows[0]?.kcal === 143, JSON.stringify(rows[0]));
    check("and named after what was on the plate",
      String(rows[0]?.label ?? "").includes("ביצים"), String(rows[0]?.label)); }
  // a food outside the library must still be loggable
  await cp.getByPlaceholder(/ארוחה שלמה/).first().fill("מופלטה"); await cp.waitForTimeout(600);
  check("an unknown food offers a category to add it by",
    (await cp.getByRole("button",{name:/מופלטה · פחמימה/}).count())>0);
  await cp.getByRole("button",{name:/מופלטה · פחמימה/}).first().click(); await cp.waitForTimeout(600);
  check("adding an unknown food puts it on the plate",
    await cp.getByText("מופלטה").first().isVisible().catch(()=>false));
  // and its weight can be typed exactly, not only stepped
  await cp.getByText(/גרם ·/).first().click(); await cp.waitForTimeout(400);
  const gbox = cp.getByLabel("כמות בגרמים").first();
  check("tapping the weight opens an exact-gram editor", (await gbox.count())>0);
  if (await gbox.count()) {
    await gbox.fill("250"); await cp.waitForTimeout(400);
    await cp.mouse.click(20, 700); await cp.waitForTimeout(400);
    const t = Number((await cp.evaluate(()=>document.body.innerText)).match(/\+(\d+) על הצלחת/)?.[1] ?? -1);
    check("a typed weight recomputes the total", t === 325, String(t));
  }
  // a whole meal typed as a sentence is read into rows with their amounts
  await cp.getByPlaceholder(/ארוחה שלמה/).first().fill("2 ביצים ופרוסת לחם"); await cp.waitForTimeout(700);
  check("a typed meal is read as a meal",
    await cp.getByText("זיהיתי את הארוחה").first().isVisible().catch(()=>false));
  await cp.getByRole("button",{name:/הוסף הכל/}).first().click(); await cp.waitForTimeout(600);
  { const t = await readTotal();
    check("adding the read meal adds two eggs and a slice (223)", t === 325 + 223, String(t)); }
  // Enter on the keyboard does the same, and a weight after the food counts
  const box = cp.getByPlaceholder(/ארוחה שלמה/).first();
  await box.fill("חזה עוף 200 גרם"); await cp.waitForTimeout(600);
  await box.press("Enter"); await cp.waitForTimeout(700);
  { const t = await readTotal();
    check("Enter adds the read meal; '200 גרם' after the food is honoured (330)", t === 325 + 223 + 330, String(t)); }

  check("the calculator raises no page errors", cerr.length===0, cerr.join(" | "));
  await cctx.close();
}

// 20) RECENT MEALS — re-log what you ate before, in one tap. The button a
// food diary lives or dies on, verified against the stored diary.
{
  const rctx = await browser.newContext({viewport:{width:393,height:852}});
  const M = (label, kcal, protein) => ({ id: label + Math.random(), label, kcal, protein });
  const withHistory = { ...seed, intake: {
    [dayAgo(1)]: [M("קפה עם חלב", 60, 3), M("ביצים", 160, 12)],
    [dayAgo(2)]: [M("קפה עם חלב", 60, 3)],
    [dayAgo(3)]: [M("קפה עם חלב", 60, 3)],
  } };
  await rctx.addInitScript(s=>{try{
    localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");
  }catch{}}, JSON.stringify(withHistory));
  const rp = await rctx.newPage();
  const rerr=[]; rp.on("pageerror",e=>rerr.push(String(e).slice(0,160)));
  await rp.goto(`http://localhost:${PORT}/calc`,{waitUntil:"networkidle"});
  await rp.waitForTimeout(1800);

  check("recent meals are offered on the calculator",
    await rp.getByText("אכלת לאחרונה").first().isVisible().catch(()=>false));
  check("the most-eaten meal is offered",
    await rp.getByRole("button",{name:"קפה עם חלב"}).first().isVisible().catch(()=>false));
  check("it says how many days it was eaten",
    await rp.getByText(/×3 ימים/).first().isVisible().catch(()=>false));

  await rp.getByRole("button",{name:"קפה עם חלב"}).first().click(); await rp.waitForTimeout(1000);
  { const s2 = JSON.parse(await rp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
    const keys = Object.keys(s2.intake).sort();
    const todayRows = s2.intake[keys[keys.length-1]] || [];
    check("tapping it logs that exact meal today",
      todayRows.some(r=>r.label==="קפה עם חלב" && r.kcal===60), JSON.stringify(todayRows.map(r=>r.label)));
    check("and logs it once, not many times",
      todayRows.filter(r=>r.label==="קפה עם חלב").length === 1, JSON.stringify(todayRows)); }
  check("recent meals raise no page errors", rerr.length===0, rerr.join(" | "));
  await rctx.close();
}

// --- the photos: library dishes wear the photo shipped in the app, whatever the
// switch says; a live Commons search (a food someone typed) happens only when
// allowed, and is credited.
//
// The rest of the suite aborts Commons to stay hermetic, so this block gets its
// own context and answers the search itself. What is being checked is not that
// an image decodes — it is the gate: photos off must make no request at all,
// and a photo whose licence asks for a credit must carry one on screen.
{
  const pctx = await browser.newContext({ viewport:{width:440,height:1000}, colorScheme:"light" });
  const searches = [];
  await pctx.route("**://commons.wikimedia.org/**", async (r)=>{
    const q = new URL(r.request().url()).searchParams.get("gsrsearch") ?? "";
    searches.push(q);
    await r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify({ query:{ pages:[{
      title:`File:${q}.jpg`, index:1, imageinfo:[{
        thumburl:"https://upload.wikimedia.org/stand-in.jpg", mime:"image/jpeg", width:2400, height:1600,
        extmetadata:{ LicenseShortName:{value:"CC BY-SA 4.0"},
          Artist:{value:'<a href="//commons.wikimedia.org/wiki/User:Cook">Rina Cook</a>'} },
      }],
    }] } }) });
  });
  await pctx.route("**://upload.wikimedia.org/**", (r)=>r.fulfill({ status:200, contentType:"image/svg+xml",
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="240"><rect width="512" height="240" fill="#8a4b1e"/></svg>' }));

  const photoSeed = (photos)=>JSON.stringify({ ...seed,
    consent:{ cloud:false, ai:false, photos, updatedAt:"2026-09-01T00:00:00.000Z" },
    pantry:"chicken, rice, broccoli, eggs, tomato, cucumber, olive oil, lentils, onion" });

  const visit = async (photos)=>{
    searches.length = 0;
    const pg = await pctx.newPage();
    await pg.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","en");}catch{}}, photoSeed(photos));
    await pg.goto(`http://localhost:${PORT}/kitchen`,{waitUntil:"load"});
    await pg.waitForTimeout(2600);
    const bundled = await pg.locator('img[src*="meals"]').count();
    const foodShots = await pg.locator('img[src*="foods"]').count();
    const libraryAsked = searches.length;
    // A food typed into "I feel like eating…" has no shipped photo: that one
    // is looked up live, and only with the switch on.
    const field = pg.getByPlaceholder(/tuna, pizza/i).first();
    await field.fill("mufleta");
    await pg.waitForTimeout(2200);
    const body = await pg.locator("body").innerText().catch(()=>"");
    await pg.close();
    return { bundled, foodShots, libraryAsked, asked: searches.length, body };
  };

  const on = await visit(true);
  check("library dishes show the photo shipped in the app", on.bundled > 0, String(on.bundled));
  check("…without asking Commons for them", on.libraryAsked === 0, String(on.libraryAsked));
  check("foods show their own shipped photos too", on.foodShots > 0, String(on.foodShots));
  check("with photos on, a typed food is looked up on Commons", on.asked > 0, String(on.asked));
  check("a CC BY-SA photo is shown with its credit", on.body.includes("Rina Cook · CC BY-SA 4.0"),
    on.body.slice(0,120));

  const off = await visit(false);
  check("with photos off, the shipped photos still show", off.bundled > 0, String(off.bundled));
  check("with photos off, nothing is asked of Commons at all", off.asked === 0, String(off.asked));
  check("and no live photo's credit is on screen", !off.body.includes("Rina Cook"));
  await pctx.close();
}

// --- "I feel like eating…": a food, priced out of ten, with a picture
//
// The scorer has its own unit suite; what this proves is that the card is wired
// to it — that typing a word moves the number on screen, and that the list
// survives the app being closed.
{
  const ectx = await browser.newContext({ viewport:{width:440,height:1000}, colorScheme:"light" });
  await ectx.route("**://commons.wikimedia.org/**", r=>r.abort());
  await ectx.route("**://upload.wikimedia.org/**", r=>r.abort());
  await ectx.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","en");}catch{}},
    JSON.stringify({ ...seed, pantry:"chicken, rice, tomato" }));
  const ep = await ectx.newPage();
  const eerr=[]; ep.on("pageerror",e=>eerr.push(String(e).slice(0,140)));
  await ep.goto(`http://localhost:${PORT}/kitchen`,{waitUntil:"load"});
  await ep.waitForTimeout(2200);

  const field = ep.getByPlaceholder(/tuna, pizza/i).first();
  check("the kitchen asks what you feel like eating", await field.isVisible().catch(()=>false));

  const read = async (word)=>{
    await field.fill("");
    await field.type(word,{delay:15});
    await ep.waitForTimeout(500);
    const m = /(\d+\.\d)\s*\n?\s*(Great|Good|OK|Sometimes|Rarely)/i.exec(await ep.locator("body").innerText());
    return m ? Number(m[1]) : null;
  };

  const tuna = await read("tuna");
  check("a good food scores high and says so", tuna !== null && tuna >= 8, String(tuna));
  const pizza = await read("pizza");
  check("and a worse one scores lower", pizza !== null && pizza < tuna, `${pizza} vs ${tuna}`);
  check("nothing is written off entirely", pizza !== null && pizza > 0, String(pizza));

  await ep.getByRole("button",{name:/add to my list/i}).first().click();
  await ep.waitForTimeout(500);
  // Checked in the stored state rather than by reloading: this suite re-seeds
  // localStorage on every navigation, so a reload here would wipe the very
  // thing being tested and prove nothing either way.
  const stored = JSON.parse(await ep.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  check("what you added is written down, not just drawn",
    (stored.wishlist??[]).some(w=>/pizza/i.test(w.text)), JSON.stringify(stored.wishlist));
  check("and it is listed back with its own score",
    /pizza/i.test(await ep.locator("body").innerText()));
  check("the eat card raises no page errors", eerr.length===0, eerr.join(" | "));
  await ectx.close();
}

// --- The app guide: a question in, the answer and a button to the screen out.
{
  const hctx = await browser.newContext({ viewport:{width:412,height:915}, colorScheme:"light" });
  await hctx.route("**://cdn.jsdelivr.net/**", r=>r.abort());
  await hctx.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");}catch{}},
    JSON.stringify(seed));
  const hp = await hctx.newPage();
  const herr=[]; hp.on("pageerror",e=>herr.push(String(e).slice(0,140)));
  await hp.goto(`http://localhost:${PORT}/help`,{waitUntil:"load"});
  await hp.waitForTimeout(1600);
  const box = hp.getByPlaceholder("איך עושים…?").first();
  check("the guide opens with a question box", await box.isVisible().catch(()=>false));
  await box.fill("איפה רושמים משקל");
  await box.press("Enter");
  await hp.waitForTimeout(500);
  check("it answers where the weigh-in is", /בלשונית "התקדמות"/.test(await hp.locator("body").innerText()));
  await hp.getByText("קח אותי לשם").first().click();
  await hp.waitForTimeout(1200);
  check("and its button opens that screen", /\/progress$/.test(hp.url()), hp.url());
  check("the guide raises no page errors", herr.length===0, herr.join(" | "));
  await hctx.close();
}

// TODAY'S MENU — a day of meals from the kitchen, sized to the target:
// eat, swap, upgrade, and add a recipe from the book.
{
  const mctx = await browser.newContext({ viewport:{width:412,height:915} });
  for (const h of ["**://cdn.jsdelivr.net/**","**://commons.wikimedia.org/**","**://upload.wikimedia.org/**"]) await mctx.route(h, r=>r.abort());
  await mctx.addInitScript(s=>{try{ if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1",s); localStorage.setItem("mystyle.locale","he");}catch{}},
    JSON.stringify({ ...seed, intake:{}, menu:{} }));
  const mp = await mctx.newPage();
  const merr=[]; mp.on("pageerror",e=>merr.push(String(e).slice(0,140)));
  const mst = async ()=> JSON.parse(await mp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  await mp.goto(`http://localhost:${PORT}/kitchen`,{waitUntil:"load"}); await mp.waitForTimeout(2200);
  check("the kitchen opens on today's menu", await mp.getByText("התפריט שלך להיום").first().isVisible().catch(()=>false));
  // From the kitchen — or mostly, when the rotation brought in a dish one
  // thing short, which then says so on its own row.
  check("it says it is built from what is at home", await mp.getByText(/^(נבנה רק ממה שיש לך במטבח — בלי לקנות כלום\.|רוב התפריט ממה שיש לך\.)/).first().isVisible().catch(()=>false));
  check("four meals, each with an I-ate-this button", (await mp.getByRole("button",{name:/^אכלתי · /}).count())===4);
  check("no shopping list anywhere in the kitchen", !(await mp.getByText("רשימת קניות").count()));
  const sub = async ()=> (await mp.getByText(/מתוך [\d,]+ קלוריות · \d+ ג׳ חלבון/).first().innerText().catch(()=>""));
  const total = (t)=> Number((/^([\d,]+)/.exec(t)?.[1] ?? "0").replace(/,/g,""));
  const target = (t)=> Number((/מתוך ([\d,]+)/.exec(t)?.[1] ?? "0").replace(/,/g,""));
  { const t=await sub(); check("the day's menu lands near the target", Math.abs(total(t)-target(t)) <= target(t)*0.15, t); }

  // eat breakfast from the menu
  await mp.getByRole("button",{name:"אכלתי · בוקר"}).first().click(); await mp.waitForTimeout(900);
  { const s=await mst(); const d=Object.keys(s.intake??{})[0]; const items=s.intake?.[d]??[];
    const choice=Object.values(s.menu??{})[0]?.breakfast;
    check("eating a menu meal logs it to the diary", items.length===1 && items[0].kcal>0, JSON.stringify(items));
    check("and the menu remembers which entry it was", choice?.loggedId===items[0]?.id, JSON.stringify(choice));
    check("the breakfast row now reads eaten", await mp.getByText(/^נאכל ✓ · \d+ קל׳$/).first().isVisible().catch(()=>false)); }
  check("the Today total counts it", await mp.getByText(/^נשארו [\d,]+ קלוריות להיום$/).first().isVisible().catch(()=>false));

  // swap dinner for another recipe the kitchen can make
  await mp.getByRole("button",{name:"החלף · ערב"}).first().click(); await mp.waitForTimeout(600);
  check("swap lists other dishes from what is at home", await mp.getByText("מנות אחרות שאפשר להכין ממה שיש לך:").first().isVisible().catch(()=>false));
  const altName = await mp.getByText("מנות אחרות שאפשר להכין ממה שיש לך:").locator("xpath=following-sibling::*[1]").getByRole("button").first().getAttribute("aria-label").catch(()=>null);
  await mp.getByText("מנות אחרות שאפשר להכין ממה שיש לך:").locator("xpath=following-sibling::*[1]").getByRole("button").first().click(); await mp.waitForTimeout(800);
  { const s=await mst(); const dinner=Object.values(s.menu??{})[0]?.dinner;
    check("the swapped dish is saved for dinner", !!dinner?.mealId, JSON.stringify(dinner));
    check("and shows on the menu", !!altName && await mp.getByText(altName).first().isVisible().catch(()=>false), String(altName)); }

  // upgrade lunch with something from the kitchen
  const lunchLine = async ()=> (await mp.getByRole("button",{name:"אכלתי · צהריים"}).first().locator("xpath=ancestor::*[3]").innerText().catch(()=>""));
  await mp.getByRole("button",{name:"שדרג · צהריים"}).first().click(); await mp.waitForTimeout(600);
  check("upgrade offers foods from the kitchen", await mp.getByText("שדרג עם מה שיש לך:").first().isVisible().catch(()=>false));
  await mp.getByText("שדרג עם מה שיש לך:").locator("xpath=following-sibling::*[1]").getByRole("button").first().click(); await mp.waitForTimeout(800);
  { const s=await mst(); const lunch=Object.values(s.menu??{})[0]?.lunch;
    check("an upgrade is saved on the meal", (lunch?.extras??[]).length===1, JSON.stringify(lunch)); }
  check("and shows on the meal line", /· \+ /.test(await lunchLine()), await lunchLine());

  // a recipe from the book onto today's menu
  await mp.goto(`http://localhost:${PORT}/recipe/salmon-quinoa`,{waitUntil:"load"}); await mp.waitForTimeout(1800);
  const addBtn = mp.getByRole("button",{name:"הוסף לתפריט של היום"}).first();
  check("a recipe page offers adding it to today's menu", await addBtn.isVisible().catch(()=>false));
  await addBtn.click(); await mp.waitForTimeout(700);
  check("it says which meal it went into", await mp.getByText(/^נוסף לתפריט — /).first().isVisible().catch(()=>false));
  { const s=await mst(); const day=Object.values(s.menu??{})[0]??{};
    check("the recipe is on today's menu", Object.values(day).some((c)=>c?.mealId==="salmon-quinoa"), JSON.stringify(day)); }

  // the next meal on the Today screen
  await mp.goto(`http://localhost:${PORT}/`,{waitUntil:"load"}); await mp.waitForTimeout(1800);
  check("Today shows the next meal to eat", await mp.getByText("הארוחה הבאה").first().isVisible().catch(()=>false));
  check("the menu raises no page errors", merr.length===0, merr.join(" | "));
  await mctx.close();
}

// 23) RIGHT NOW — the Today card that follows the clock, and acts in one tap.
{
  const nctx = await browser.newContext({ viewport:{width:412,height:915} });
  for (const h of ["**://cdn.jsdelivr.net/**","**://commons.wikimedia.org/**","**://upload.wikimedia.org/**"]) await nctx.route(h, r=>r.abort());
  const tiny = { ...seed, pantry:"ביצים, לחם, עגבנייה, גבינה לבנה, טונה", intake:{}, menu:{}, waterMl:{}, checkIns:[] };
  await nctx.addInitScript(s=>{try{ if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1",s); localStorage.setItem("mystyle.locale","he");}catch{}}, JSON.stringify(tiny));
  // Mid-afternoon with no water drunk: behind the pace.
  await nctx.clock.install({ time: new Date(`${today}T15:00:00`) });
  const np = await nctx.newPage();
  const nerr=[]; np.on("pageerror",e=>nerr.push(String(e).slice(0,140)));
  const nst = async ()=> JSON.parse(await np.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  await np.goto(`http://localhost:${PORT}/`,{waitUntil:"load"}); await np.waitForTimeout(1800);
  check("Today has a right-now card", await np.getByText("עכשיו",{exact:true}).first().isVisible().catch(()=>false));
  check("at 3pm with nothing drunk it says water is behind", await np.getByText(/אתה מאחור במים — \d+ כוסות/).first().isVisible().catch(()=>false));
  await np.getByRole("button",{name:/^\+ כוס/}).first().click(); await np.waitForTimeout(700);
  { const s=await nst(); check("its + a cup logs a cup right there", (s.waterMl?.[today]??0)===250, String(s.waterMl?.[today])); }

  // The menu from five groceries: dishes one thing short say what, and add it.
  await np.goto(`http://localhost:${PORT}/kitchen`,{waitUntil:"load"}); await np.waitForTimeout(2200);
  const need = np.getByText(/^חסר לך: /).first();
  check("a small kitchen's menu names what a dish needs", await need.isVisible().catch(()=>false));
  const needText = (await need.innerText().catch(()=>"")).replace(/^חסר לך: /,"");
  await np.getByRole("button",{name:"הוסף למטבח"}).first().click(); await np.waitForTimeout(800);
  { const s=await nst(); const first=needText.split(",")[0]?.trim();
    check("add to my list puts it on the kitchen list", !!first && s.pantry.includes(first), `${first} / ${s.pantry}`);
    check("and keeps that dish on today's menu", Object.values(Object.values(s.menu??{})[0]??{}).some((c)=>!!c?.mealId), JSON.stringify(s.menu)); }
  check("the right-now card and menu raise no page errors", nerr.length===0, nerr.join(" | "));
  await nctx.close();
}

// 24) THE EVENING RECAP CHANGES TOMORROW — with the AI off, on the device.
{
  const rctx = await browser.newContext({ viewport:{width:412,height:915} });
  for (const h of ["**://cdn.jsdelivr.net/**","**://commons.wikimedia.org/**","**://upload.wikimedia.org/**"]) await rctx.route(h, r=>r.abort());
  const walk = { id:"w1", title:"הליכה 30 דקות", slot:"evening", createdAt:dayAgo(20), archived:false, updatedAt:new Date(Date.parse(dayAgo(20))).toISOString() };
  const rseed = { ...seed, habits:[walk], completions:[{ habitId:"w1", date:dayAgo(2), done:true, updatedAt:now.toISOString() }], checkIns:[] };
  await rctx.addInitScript(s=>{try{ if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1",s); localStorage.setItem("mystyle.locale","he");}catch{}}, JSON.stringify(rseed));
  const rp = await rctx.newPage();
  const rerr=[]; rp.on("pageerror",e=>rerr.push(String(e).slice(0,140)));
  const rst = async ()=> JSON.parse(await rp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  await rp.goto(`http://localhost:${PORT}/checkin`,{waitUntil:"load"}); await rp.waitForTimeout(1600);
  await rp.getByRole("button",{name:"קשה"}).first().click(); await rp.waitForTimeout(300);
  await rp.getByRole("button",{name:/שמור/}).first().click(); await rp.waitForTimeout(900);
  check("a skipped habit gets a suggestion for tomorrow, AI off", await rp.getByText("הצעה למחר").first().isVisible().catch(()=>false));
  check("it is the smaller version, in numbers", await rp.getByText(/להקטין את ״הליכה 30 דקות״ ל: הליכה 15 דקות/).first().isVisible().catch(()=>false));
  check("and says why, from the week", await rp.getByText(/מתוך 7 הימים האחרונים/).first().isVisible().catch(()=>false));
  await rp.getByRole("button",{name:"החל את זה"}).first().click(); await rp.waitForTimeout(700);
  { const s=await rst(); check("accepting changes the habit itself", s.habits[0]?.title==="הליכה 15 דקות", s.habits[0]?.title); }
  await rp.reload({waitUntil:"load"}); await rp.waitForTimeout(1500);
  check("it does not suggest halving it again the same week", !(await rp.getByText("הצעה למחר").count()));
  check("the recap raises no page errors", rerr.length===0, rerr.join(" | "));
  await rctx.close();
}

// 25) A MEAL PHOTO ON THE WEB — read in the browser, model fetched only then.
{
  const vctx = await browser.newContext({ viewport:{width:412,height:915} });
  for (const h of ["**://cdn.jsdelivr.net/**","**://commons.wikimedia.org/**","**://upload.wikimedia.org/**"]) await vctx.route(h, r=>r.abort());
  await vctx.addInitScript(s=>{try{ if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1",s); localStorage.setItem("mystyle.locale","he");}catch{}}, JSON.stringify({ ...seed, intake:{}, menu:{} }));
  const vp = await vctx.newPage();
  const verr=[]; vp.on("pageerror",e=>verr.push(String(e).slice(0,140)));
  const chunks=[]; vp.on("request",r=>{ const u=r.url(); if (/foodModelData|foodvision/.test(u)) chunks.push(u); });
  await vp.goto(`http://localhost:${PORT}/kitchen`,{waitUntil:"load"}); await vp.waitForTimeout(2000);
  check("opening the app does not download the food model", chunks.length===0, chunks.join(" "));
  const chooser = vp.waitForEvent("filechooser",{timeout:8000}).catch(()=>null);
  await vp.getByRole("button",{name:"מהגלריה"}).first().click();
  const fc = await chooser;
  check("the gallery button opens a file picker", !!fc);
  if (fc) {
    await fc.setFiles(path.resolve("assets/meals/chicken-shawarma-plate.jpg"));
    await vp.getByText(/נראה כמו…|בחר את המנה הנכונה|לא הצלחתי לזהות/).first().waitFor({ timeout: 60000 }).catch(()=>{});
    check("a food photo is read in the browser", await vp.getByText(/נראה כמו…|בחר את המנה הנכונה/).first().isVisible().catch(()=>false));
    check("the model was fetched for it, then", chunks.some((u)=>/foodModelData/.test(u)), chunks.join(" "));
  }
  check("the photo scan raises no page errors", verr.length===0, verr.join(" | "));
  await vctx.close();
}

// --- habits: starting from an idea, no twins, and a time of day that can change;
// progress photos that work in the browser too
{
  const hctx = await browser.newContext({ viewport:{width:412,height:915} });
  for (const h of ["**://cdn.jsdelivr.net/**","**://commons.wikimedia.org/**","**://upload.wikimedia.org/**"]) await hctx.route(h, r=>r.abort());
  const pastSession = {id:"w1",date:dayAgo(3),day:0,dayType:"push",startedAt:Date.now()-3*86400000,durationSec:3000,volumeKg:5200,sets:15,exercises:5,prs:1,kcal:310};
  await hctx.addInitScript(s=>{try{ if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1",s); localStorage.setItem("mystyle.locale","he");}catch{}},
    JSON.stringify({ ...seed, training:{ ...seed.training, history:[pastSession] } }));
  const hp = await hctx.newPage();
  const herr=[]; hp.on("pageerror",e=>herr.push(String(e).slice(0,140)));
  const hgo = async (route)=>{ await hp.goto(`http://localhost:${PORT}${route}`,{waitUntil:"load"}); await hp.waitForTimeout(1600); };
  const hst = async ()=> JSON.parse(await hp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));

  // the next setup step is offered on the home screen, and "not now" holds
  await hgo("/");
  check("home offers the next setup step", await hp.getByText("שהאפליקציה תזכיר לך").first().isVisible().catch(()=>false));
  await hp.getByRole("button",{name:"לא עכשיו"}).first().click(); await hp.waitForTimeout(500);
  check("\"not now\" puts it away", !(await hp.getByText("שהאפליקציה תזכיר לך").first().isVisible().catch(()=>false)));
  await hgo("/");
  check("and it stays away after a reload", !(await hp.getByText("שהאפליקציה תזכיר לך").first().isVisible().catch(()=>false)));

  await hgo("/habit/new");
  const idea = hp.getByRole("button",{name:"לצאת להליכה של 10 דקות"}).first();
  check("a new habit offers ideas to start from", await idea.isVisible().catch(()=>false));
  await idea.click(); await hp.waitForTimeout(500);
  check("an idea fills the field",
    (await hp.locator("textarea:visible").first().inputValue().catch(()=>"")) === "לצאת להליכה של 10 דקות");
  await hp.getByRole("button",{name:"הוסף"}).last().click(); await hp.waitForTimeout(900);
  { const s=await hst(); const h=s.habits.find(x=>x.title==="לצאת להליכה של 10 דקות");
    check("an idea also picks its time of day", h?.slot==="evening", JSON.stringify(h)); }

  await hgo("/habit/new");
  await hp.locator("textarea:visible").first().fill("לשתות  מים");
  await hp.waitForTimeout(400);
  check("a habit that already exists is called out", (await hp.locator("body").innerText()).includes("כבר יש לך הרגל בשם הזה"));
  check("and cannot be added twice", await hp.getByRole("button",{name:"הוסף"}).last().isDisabled().catch(()=>false));

  await hgo("/habit/h1");
  await hp.getByRole("radio",{name:"ערב"}).first().click(); await hp.waitForTimeout(500);
  { const s=await hst(); check("a habit's time of day can be changed later", s.habits.find(x=>x.id==="h1")?.slot==="evening"); }
  await hp.getByRole("button",{name:"סמן שעשיתי היום"}).first().click(); await hp.waitForTimeout(500);
  { const s=await hst(); check("a habit can be ticked from its own page",
      s.completions.some(c=>c.habitId==="h1"&&c.date===today&&c.done===true)); }
  check("and the button says it is done", await hp.getByRole("button",{name:/נעשה היום/}).first().isVisible().catch(()=>false));

  // a habit with rest days: today taken off, it waits at the end marked "not today"
  {
    const wd = new Date().getDay();
    const names = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
    await hgo("/habit/new");
    await hp.locator("textarea:visible").first().fill("ריצה קלה");
    await hp.getByRole("checkbox",{name:names[wd],exact:true}).first().click(); await hp.waitForTimeout(300);
    check("taking a day off says how many days are left",
      (await hp.locator("body").innerText()).includes("6 ימים בשבוע"));
    await hp.getByRole("button",{name:"הוסף"}).last().click(); await hp.waitForTimeout(900);
    const s=await hst(); const h=s.habits.find(x=>x.title==="ריצה קלה");
    check("a habit is saved with its days", Array.isArray(h?.days) && h.days.length===6 && !h.days.includes(wd), JSON.stringify(h?.days));
    await hgo("/");
    check("on its rest day it is marked \"not today\"", (await hp.locator("body").innerText()).includes("ריצה קלה · לא היום"));
  }

  // changing the plan keeps every workout already done
  await hgo("/workout");
  await hp.getByRole("button",{name:"שנה תוכנית"}).first().click(); await hp.waitForTimeout(600);
  await hp.getByRole("radio",{name:"60"}).first().click().catch(()=>{});
  await hp.getByRole("button",{name:"בנה לי תוכנית"}).first().click(); await hp.waitForTimeout(800);
  { const s=await hst(); check("re-tuning the plan keeps the workout history",
      (s.training?.history??[]).length===1 && s.training.history[0].id==="w1", JSON.stringify(s.training?.history)); }

  await hgo("/progress");
  const chooser = hp.waitForEvent("filechooser",{timeout:8000}).catch(()=>null);
  await hp.getByRole("button",{name:"הוסף תמונה"}).first().click();
  const fc = await chooser;
  check("a progress photo can be picked in the browser", !!fc);
  if (fc) {
    await fc.setFiles(path.resolve("assets/meals/chicken-shawarma-plate.jpg"));
    await hp.waitForTimeout(2500);
    const s=await hst(); const p=(s.photos??[])[0];
    check("it is kept on the device as a small image",
      !!p && p.uri.startsWith("data:image/jpeg") && p.uri.length < 250000, p ? `${p.uri.slice(0,30)} ${p.uri.length}` : "none");
  }
  check("habits and photos raise no page errors", herr.length===0, herr.join(" | "));
  await hctx.close();
}

// --- reminders in the browser: Web Push, with the push service and the server
// stood in for. What has to hold: the words stay in the browser, the server
// hears ids and times only.
{
  // The full Chromium, not the headless shell: the shell has no working
  // service workers, so push could never be switched on in it.
  const fullBrowser = await chromium.launch({ headless: true, channel: "chromium" });
  const pctx = await fullBrowser.newContext({ viewport:{width:412,height:915} });
  await pctx.exposeBinding("__cspViolation",(_src,v)=>cspViolations.push(String(v).slice(0,200)));
  await pctx.addInitScript(()=>document.addEventListener("securitypolicyviolation",e=>window.__cspViolation(`${e.violatedDirective} ${e.blockedURI}`)));
  await pctx.grantPermissions(["notifications"], { origin: `http://localhost:${PORT}` });
  for (const h of ["**://cdn.jsdelivr.net/**","**://commons.wikimedia.org/**","**://upload.wikimedia.org/**"]) await pctx.route(h, r=>r.abort());
  const calls = [];
  const pub = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
  await pctx.route("**/functions/v1/push", async (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    calls.push({ body, auth: r.request().headers()["authorization"] || "" });
    await r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body.action === "key" ? { publicKey: pub } : { ok: true }) });
  });
  const exp = Math.floor(Date.now()/1000) + 3600;
  await pctx.route("**/auth/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ access_token: "e2e-token", token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "e2e-refresh",
      user: { id: "00000000-0000-4000-8000-0000000000aa", aud: "authenticated", role: "authenticated", is_anonymous: true,
        app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }) }));
  await pctx.addInitScript(() => {
    // headless Chromium has no push service to subscribe to
    const fake = { endpoint: "https://web.push.apple.com/e2e-fake",
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) } }; },
      unsubscribe: async () => true };
    if (window.PushManager) {
      PushManager.prototype.subscribe = async function () { return fake; };
      PushManager.prototype.getSubscription = async function () { return null; };
    }
  });
  await pctx.addInitScript(s=>{try{ if (!localStorage.getItem("mystyle.state.v1")) localStorage.setItem("mystyle.state.v1",s); localStorage.setItem("mystyle.locale","he");}catch{}},
    JSON.stringify({ ...seed, habits:[{ id:"h9", title:"לקרוא 10 דקות", slot:"evening", createdAt:dayAgo(3), archived:false, updatedAt:now.toISOString() }] }));
  const pp = await pctx.newPage();
  const perr=[]; pp.on("pageerror",e=>perr.push(String(e).slice(0,140)));
  // The first open of a right-to-left page reloads once to flip direction;
  // wait for the page to stop navigating before pressing anything.
  let navs = 0; pp.on("framenavigated", f => { if (f === pp.mainFrame()) navs++; });
  await pp.goto(`http://localhost:${PORT}/profile`,{waitUntil:"load"});
  for (let quiet = 0, last = -1, i = 0; quiet < 3 && i < 30; i++) { await pp.waitForTimeout(500); quiet = navs === last ? quiet + 1 : 0; last = navs; }
  await pp.waitForTimeout(800);
  check("the browser offers reminders", await pp.getByRole("button",{name:"הפעל תזכורות"}).first().isVisible().catch(()=>false));
  check("and says what the server will and will not see", (await pp.locator("body").innerText()).includes("לא את המילים"));
  await pp.getByRole("button",{name:"הפעל תזכורות"}).first().click();
  for (let i = 0; i < 30 && !calls.some(c=>c.body.action==="schedule"); i++) await pp.waitForTimeout(500);
  await pp.waitForTimeout(500);
  const st9 = JSON.parse(await pp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  check("reminders turn on in this browser", st9.webPush === true, String(st9.webPush));
  check("the profile's synced switch is left alone", st9.profile.reminders !== true);
  const sub = calls.find(c=>c.body.action==="subscribe");
  check("the browser's push address goes to the server, signed in", !!sub && sub.body.subscription?.endpoint === "https://web.push.apple.com/e2e-fake" && sub.auth === "Bearer e2e-token",
    JSON.stringify(calls.map(c=>c.body.action)));
  const sched = calls.filter(c=>c.body.action==="schedule").at(-1);
  check("the schedule goes up", !!sched && Array.isArray(sched.body.items) && sched.body.items.length > 0, String(JSON.stringify(sched?.body)).slice(0,200) + " calls=" + JSON.stringify(calls.map(c=>c.body.action)));
  check("as ids and times only — no words", !!sched && sched.body.items.every(i => Object.keys(i).sort().join() === "at,id")
    && !JSON.stringify(sched.body).includes("לקרוא"));
  const texts = await pp.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("apex-reminders", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("texts");
    req.onsuccess = () => { const tx = req.result.transaction("texts","readonly"); const all = tx.objectStore("texts").getAll(); const keys = tx.objectStore("texts").getAllKeys();
      tx.oncomplete = () => resolve({ keys: keys.result, values: all.result }); };
    req.onerror = () => resolve(null);
  })).catch(() => null);
  check("the words wait in the browser's own storage", !!texts && texts.values.some(v => (v.body||"").includes("לקרוא 10 דקות")),
    JSON.stringify(texts).slice(0,200));
  check("each one knows where a tap should open", !!texts && texts.values.every(v => typeof v.url === "string" && v.url.startsWith("/")));
  const swOk = await pp.evaluate(async () => !!(await navigator.serviceWorker.getRegistration("/sw.js")));
  check("the service worker is registered", swOk);
  await pp.getByRole("button",{name:"כבה תזכורות"}).first().click().catch(()=>{});
  await pp.waitForTimeout(1500);
  const st10 = JSON.parse(await pp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
  check("turning them off tells the server to forget", st10.webPush !== true && calls.some(c=>c.body.action==="unsubscribe"),
    JSON.stringify(calls.map(c=>c.body.action)));
  check("web reminders raise no page errors", perr.length===0, perr.join(" | "));
  await pctx.close();
  await fullBrowser.close();
}

check("the served page carries the Content-Security-Policy",
  /http-equiv="Content-Security-Policy"/.test(fs.readFileSync(path.join(DIST,"index.html"),"utf8")));
// One refusal is expected and harmless: the "long" library inside TensorFlow
// (loaded only for a meal photo) probes for WebAssembly in a try/catch and
// falls back to JavaScript when the policy says no. The policy stays strict
// rather than allowing wasm for a probe; anything else still fails here.
const realViolations = cspViolations.filter((v)=>!/^script-src wasm-eval/.test(v));
check("the Content-Security-Policy refused nothing the app did", realViolations.length===0, realViolations[0]);
await browser.close(); server.close();
report();

// Printing lives in a function so a thrown selector error still reports every
// check that ran before it — a suite that prints nothing when it falls over
// tells you only that something broke, not what had already passed.
function report(err) {
const failed = results.filter(([,ok])=>!ok);
  for (const [n,ok,d] of results) console.log(`${ok?"PASS":"FAIL"}  ${n}${ok?"":`  ← ${d??""}`}`);
  if (err) console.log(`\nCRASH after ${results.length} checks: ${String(err).slice(0,300)}`);
  console.log(`\n${results.length-failed.length}/${results.length} passed`);
  if (failed.length || err) process.exitCode = 1;
}


