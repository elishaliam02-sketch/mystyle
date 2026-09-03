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
const pad=n=>String(n).padStart(2,"0"); const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const now=new Date(); const today=iso(now); const dayAgo=n=>{const d=new Date(now);d.setDate(d.getDate()-n);return iso(d);};

const seed = {
  profile:{name:"טסט",onboarded:true,startKg:85,updatedAt:"1970-01-01T00:00:00.000Z"},
  habits:[{id:"h1",title:"לשתות מים",slot:"morning",createdAt:dayAgo(10),archived:false,updatedAt:now.toISOString()}],
  completions:[],weighIns:[],checkIns:[],
  pantry:"חזה עוף, אורז, ביצים, עגבנייה, יוגורט יווני, בננה",
  nutritionGoal:"cut", dietFilter:"all",
  training:{goal:"recomp",days:3,minutes:60,equipment:"gym",log:{},custom:[],weights:{}},
};

const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:412,height:915}});
await ctx.addInitScript(s=>{try{localStorage.setItem("mystyle.state.v1",s);localStorage.setItem("mystyle.locale","he");}catch{}}, JSON.stringify(seed));
const page = await ctx.newPage();
const crashes=[]; page.on("pageerror",e=>crashes.push(String(e).slice(0,160)));

const go = async (route)=>{ await page.goto(`http://localhost:${PORT}${route}`,{waitUntil:"networkidle"}); await page.waitForTimeout(1600); };
const st = async ()=> JSON.parse(await page.evaluate(()=>localStorage.getItem("mystyle.state.v1")));
const settle = ()=>page.waitForTimeout(700);

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

// 4) KITCHEN — diet filter persists
await page.getByText("כשר",{exact:true}).click(); await settle();
{ const s=await st(); check("diet filter persists", s.dietFilter==="kosher", s.dietFilter); }
await page.getByText("הכל",{exact:true}).click(); await settle();

// 5) KITCHEN — log a meal, then remove it
await page.getByRole("button",{name:"אכלתי את זה"}).first().click(); await settle();
{ const s=await st(); check("logging a meal fills today's diary", (s.intake?.[today]??[]).length===1,
   JSON.stringify(s.intake?.[today])); }
await page.getByLabel("הסר מהיומן").first().click(); await settle();
{ const s=await st(); check("removing a logged meal empties the diary", (s.intake?.[today]??[]).length===0); }

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

// 9) WORKOUT — log a weight on an exercise
await go("/workout");
const ex = page.getByText("לחיצת חזה במוט",{exact:true}).first();
await ex.click(); await settle();
await page.getByPlaceholder(/משקל/).first().fill("72.5"); await page.waitForTimeout(200);
await page.getByRole("button",{name:"רשום"}).first().click(); await settle();
{ const s=await st(); check("a lifted weight is stored for the exercise",
   (s.training?.weights?.["bench-press"]??[]).some(l=>l.kg===72.5), JSON.stringify(s.training?.weights)); }

// 10) WORKOUT — finish the whole session in one press
await page.getByRole("button",{name:"סמן את כל האימון כבוצע"}).first().click(); await settle();
{ const s=await st(); const done=(s.training?.log?.[today]??[]);
  check("finishing a session ticks all six of its exercises", done.length===6, String(done.length)); }

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

check("no uncaught page errors during the whole run", crashes.length===0, crashes.join(" | "));

await browser.close(); server.close();
const failed = results.filter(([,ok])=>!ok);
for (const [n,ok,d] of results) console.log(`${ok?"PASS":"FAIL"}  ${n}${ok?"":`  ← ${d??""}`}`);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
