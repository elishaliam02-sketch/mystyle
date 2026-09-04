/**
 * End-to-end interaction tests: drive the real exported app in a browser,
 * press the actual buttons, and assert the stored state really changed.
 * Unit tests prove the engines; this proves the buttons are wired to them.
 */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/x.js");
const { chromium } = require("playwright");

const DIST = path.resolve("dist"); const PORT = 8120;
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ttf":"font/ttf",".woff":"font/woff",".woff2":"font/woff2",".ico":"image/x-icon",".map":"application/json"};
const server = http.createServer((req,res)=>{let url=decodeURIComponent(req.url.split("?")[0]);let file=path.join(DIST,url);if(!path.extname(url)||!fs.existsSync(file)){if(!path.extname(url))file=path.join(DIST,"index.html");}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(DIST,"index.html");const ext=path.extname(file);fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);res.end("nf");return;}res.writeHead(200,{"content-type":MIME[ext]||"application/octet-stream"});res.end(d);});});
await new Promise(r=>server.listen(PORT,r));

const results = []; const check=(n,p,d)=>results.push([n,p,d]);
// A failing selector rejects the top-level await; report what ran, then stop.
process.on("unhandledRejection", (e) => { try { report(e); } catch {} process.exit(1); });
const pad=n=>String(n).padStart(2,"0"); const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const now=new Date(); const today=iso(now); const dayAgo=n=>{const d=new Date(now);d.setDate(d.getDate()-n);return iso(d);};

const seed = {
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
for (const [route,heading] of [["/","היום שלך במבט אחד"],["/kitchen","המטבח"],["/workout","האימון"],["/body","מדידות גוף"],["/checkin","סיכום היום"],["/progress","התקדמות"],["/profile","פרופיל"]]) {
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

// 3) KITCHEN — water + / −
await go("/kitchen");
await page.getByLabel("הוסף כוס מים").click(); await settle();
await page.getByLabel("הוסף כוס מים").click(); await settle();
{ const s=await st(); check("water + twice stores 2", (s.water?.[today]??0)===2, String(s.water?.[today])); }
await page.getByLabel("הורד כוס מים").click(); await settle();
{ const s=await st(); check("water − stores 1", (s.water?.[today]??0)===1, String(s.water?.[today])); }
await page.getByLabel("הורד כוס מים").click(); await page.waitForTimeout(400);
await page.getByLabel("הורד כוס מים").click(); await settle();
{ const s=await st(); check("water never goes negative", (s.water?.[today]??0)===0, String(s.water?.[today])); }

// 3b) KITCHEN — a saved list comes back as a list, not an empty box
check("a saved pantry is shown back, not re-asked for",
  await page.getByText("חזה עוף",{exact:true}).first().isVisible().catch(()=>false));
check("the edit box is not what greets a returning user",
  (await page.getByRole("button",{name:"בנה לי מנות"}).count())===0);
await page.getByRole("button",{name:"שנה את הרשימה"}).first().click(); await settle();
{ const listBox = page.getByPlaceholder(/לדוגמה: ביצים/).first();
  check("editing re-opens with the saved list already in the box",
    (await listBox.inputValue()).includes("חזה עוף"), await listBox.inputValue()); }
await page.getByRole("button",{name:"בנה לי מנות"}).first().click(); await settle();

// 4) KITCHEN — the goal chips visibly re-plate, not just re-sort
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

// 7) BODY — add a measurement
await go("/body");
await page.getByPlaceholder(/ס.\u05de/).first().fill("83"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"הוסף"}).first().click(); await settle();
{ const s=await st(); check("a measurement is stored for the waist",
   (s.measurements?.waist??[]).some(r=>r.cm===83&&r.date===today), JSON.stringify(s.measurements)); }

// 8) BODY — an absurd value is refused
await page.getByPlaceholder(/ס.\u05de/).first().fill("9999"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"הוסף"}).first().click(); await settle();
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
await page.getByRole("button",{name:"נשמר",exact:true}).first().click(); await settle();
{ const s=await st(); check("saving without editing keeps the name", s.profile.name==="טסט", s.profile.name); }

// 16) KITCHEN — grams vs household units really change the amounts
await go("/kitchen");
{ // read the whole ingredient block of the first card, whatever its shape
  const readAmounts = async () => (await page.getByText("מה צריך").first()
    .locator("xpath=..").innerText().catch(()=>"")) ?? "";
  const household = await readAmounts();
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

// 19) PROGRESS — steps
await go("/progress");
await page.getByRole("button",{name:"+1000"}).first().click(); await settle();
{ const s=await st(); check("a step nudge is stored", (s.steps?.[today]??0)===1000, String(s.steps?.[today])); }
await page.getByRole("button",{name:"+2000"}).first().click(); await settle();
{ const s=await st(); check("step nudges add up", (s.steps?.[today]??0)===3000, String(s.steps?.[today])); }
await box("כמה צעדים סה״כ היום?").fill("9500"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"שמור",exact:true}).first().click(); await settle();
{ const s=await st(); check("an exact count replaces the running total", (s.steps?.[today]??0)===9500, String(s.steps?.[today])); }
check("hitting the goal is shown", await page.getByText(/ימים ברצף/).first().isVisible().catch(()=>false));
await box("כמה צעדים סה״כ היום?").fill("999999"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"שמור",exact:true}).first().click(); await settle();
{ const s=await st(); check("an absurd step count is refused", (s.steps?.[today]??0)===9500, String(s.steps?.[today])); }
await page.getByRole("button",{name:"שנה יעד יומי"}).first().click(); await settle();
await box("יעד צעדים ליום").fill("12000"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"שמור",exact:true}).last().click(); await settle();
{ const s=await st(); check("a new step goal is stored", s.stepGoal===12000, String(s.stepGoal)); }

// 20) PROFILE — an unhealthy goal weight cannot be stored, however it is tried
await go("/profile");
{ const goalBox = box("קילוגרם");
  const save = page.getByRole("button",{name:"נשמר",exact:true}).first();

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


