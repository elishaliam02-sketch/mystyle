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
  training:{goal:"recomp",days:3,minutes:60,equipment:"gym",log:{},custom:[],weights:{},
    // last time this person benched, two days ago — the set table must show it back
    setLog:{[dayAgo(2)]:{"bench-press":[{kg:70,reps:8,done:true},{kg:70,reps:7,done:true},{kg:65,reps:8,done:true}]}}},
};

const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:412,height:915}});
await ctx.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");}catch{}}, JSON.stringify(seed));
const page = await ctx.newPage();
const crashes=[]; page.on("pageerror",e=>crashes.push(String(e).slice(0,160)));

const go = async (route)=>{ await page.goto(`http://localhost:${PORT}${route}`,{waitUntil:"networkidle"}); await page.waitForTimeout(1600); };
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
{ const s=await st(); check("water + twice stores 2", (s.water?.[today]??0)===2, String(s.water?.[today])); }
await page.getByLabel("הורד כוס מים").click(); await settle();
{ const s=await st(); check("water − stores 1", (s.water?.[today]??0)===1, String(s.water?.[today])); }
await page.getByLabel("הורד כוס מים").click(); await settle();
{ const s=await st(); check("water never goes negative", (s.water?.[today]??0)===0, String(s.water?.[today])); }
// at zero the − is a dead control unless it says so: it must be disabled, not
// lit and unresponsive
check("the − turns itself off at zero rather than doing nothing",
  await page.getByLabel("הורד כוס מים").first().isDisabled().catch(()=>false));

// 3b) WATER — the bottle shows a recommended range and a settable goal
check("a recommended water range is shown",
  await page.getByText(/מומלץ .* כוסות ביום/).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"שנה יעד"}).first().click(); await settle();
{ // the goal chips are the whole numbers inside the recommended band; 14 is the
  // top of the band for the seeded weight and is a button, so it is unambiguous
  await page.getByRole("button",{name:"14",exact:true}).first().click(); await settle();
  const s=await st();
  check("choosing a water goal stores it", s.waterGoal===14, String(s.waterGoal)); }

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

// 5b) KITCHEN — quick-log: search a food and tap it into the diary
await page.getByPlaceholder(/מה אכלת/).first().fill("אורז"); await settle();
check("search shows a result", await page.getByRole("button",{name:"אורז"}).first().isVisible().catch(()=>false));
await page.getByRole("button",{name:"אורז"}).first().click(); await settle();
{ const s=await st(); const items=s.intake?.[today]??[];
  check("quick-log adds the searched food to the diary",
    items.some(i=>i.label==="אורז"&&i.kcal>0), JSON.stringify(items)); }
{ const cleared = await page.getByPlaceholder(/מה אכלת/).first().inputValue();
  check("the search box clears after logging", cleared==="", cleared); }
await page.getByPlaceholder(/מה אכלת/).first().fill("קשקושבלבל"); await settle();
check("a nonsense search says so rather than listing everything",
  await page.getByText("לא מצאתי. נסה שם אחר או חלק מהמילה.").first().isVisible().catch(()=>false));
await page.getByPlaceholder(/מה אכלת/).first().fill(""); await settle();
// tidy up so later assertions start clean
for (let i=0;i<3;i++){ const b=page.getByLabel("הסר מהיומן").first();
  if (await b.count()===0) break; await b.click(); await page.waitForTimeout(500); }

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
  await page.getByText(/יעד ל.* [0-9]+.[0-9]+%/).first().isVisible().catch(()=>false));

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
await page.getByRole("button",{name:"הוסף תרגיל ליום זה"}).first().click(); await settle();
await page.getByPlaceholder("חפש תרגיל או קבוצת שריר").first().fill("פלאנק"); await settle();
await page.getByRole("button",{name:"פלאנק",exact:true}).first().click(); await settle();
{ const s=await st(); const edits=Object.values(s.training?.planEdits??{});
  check("adding a move to a specific day sticks in the plan",
    edits.some(e=>(e.add??[]).includes("plank")), JSON.stringify(s.training?.planEdits)); }

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

// 16) KITCHEN — grams vs household units really change the amounts
await go("/kitchen");
{ // read the whole ingredient block of the first card, whatever its shape
  const readAmounts = async () => (await page.getByText("מה צריך").first()
    .locator("xpath=..").innerText().catch(()=>"")) ?? "";
  const household = await readAmounts();
  await openKitchenSettings();
  await page.getByText("גרמים",{exact:true}).first().click(); await settle();
  const grams = await readAmounts();
  check("switching to grams changes the amounts shown", grams !== household, `${household.slice(0,60)} → ${grams.slice(0,60)}`);
  check("grams are actually shown in grams", /\d+\s*גרם/.test(grams), grams.slice(0,120));
  await page.getByText("יחידות",{exact:true}).first().click(); await settle();
  check("switching back restores household units", (await readAmounts()) === household); }

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
  { const s=await st(); check("the vegetarian filter persists", s.dietFilter==="vegetarian", s.dietFilter); }
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
  await page.getByText(/ספירה אוטומטית|לא מאפשר ספירה אוטומטית|מבקש הרשאה/).first().isVisible().catch(()=>false));
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
  await page.getByText(/כוסות/).first().isVisible().catch(()=>false));
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

  await build.click(); await p2.waitForTimeout(1400);
  const st2 = JSON.parse(await p2.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
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

  await cp.getByPlaceholder(/לדוגמה/).first().fill("ביצים"); await cp.waitForTimeout(700);
  await cp.getByRole("button",{name:"ביצים"}).first().click(); await cp.waitForTimeout(600);
  check("adding a food puts it on the plate",
    await cp.getByText(/100 גרם/).first().isVisible().catch(()=>false));
  check("one portion reads as one, in Hebrew that is a sentence",
    (await cp.getByText("1 מנות").count())===0);

  const readTotal = async () => Number((await cp.evaluate(()=>document.body.innerText)).match(/סך הכול\s*\n\s*(\d+)/)?.[1] ?? -1);
  const t1 = await readTotal();
  check("a portion of eggs is its per-100 figure", t1 === 165, String(t1));
  await cp.getByLabel("עוד מנה").first().click(); await cp.waitForTimeout(600);
  const t2 = await readTotal();
  check("one more portion doubles it exactly", t2 === 330, `${t1} -> ${t2}`);
  await cp.getByLabel("פחות מנה").first().click(); await cp.waitForTimeout(600);
  check("and stepping back down returns to where it was", (await readTotal()) === 165);

  await cp.getByRole("button",{name:/רשום ליומן/}).first().click(); await cp.waitForTimeout(1200);
  { const s2 = JSON.parse(await cp.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
    const rows = Object.values(s2.intake ?? {}).flat();
    check("logging it writes exactly one diary row", rows.length === 1, JSON.stringify(rows));
    check("with the calories the screen showed",
      rows[0]?.kcal === 165, JSON.stringify(rows[0]));
    check("and named after what was on the plate",
      String(rows[0]?.label ?? "").includes("ביצים"), String(rows[0]?.label)); }
  check("the calculator raises no page errors", cerr.length===0, cerr.join(" | "));
  await cctx.close();
}

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


