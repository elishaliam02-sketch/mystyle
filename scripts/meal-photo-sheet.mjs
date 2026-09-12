/**
 * A contact sheet of the real photograph every meal resolves to.
 *
 * The search phrases in `src/kitchen/data.ts` are the one part of the photo
 * feature no test can judge: a phrase can be perfectly well formed and still
 * return a photo of the wrong thing, and the only way to know is to look. This
 * runs the app's own picker against the real Commons API, downloads what it
 * chooses, and lays the lot out as one image plus a JSON record of which file,
 * licence and photographer each dish ended up with.
 *
 * It needs the open internet, which the development sandbox does not have — so
 * it is built to run on a CI runner (`.github/workflows/meal-photos.yml`) and
 * commit its output back. Re-run it after changing any `photo:` phrase.
 *
 * Output: docs/qa/meal-photos.jpg and docs/qa/meal-photos.json
 */
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("docs/qa");
const WIDTH = 320; // thumbnail width to ask Commons for
const PARALLEL = 4; // polite against a free public API
// Wikimedia asks every client to identify itself; an anonymous script gets 403.
const UA = "MyStyle-PhotoQA/1.0 (https://github.com/elishaliam02-sketch/mystyle)";

// The app's own kitchen, bundled the way the test runners bundle it.
const bundle = path.resolve("node_modules/.cache/photosheet.mjs");
await build({
  entryPoints: ["src/kitchen/index.ts"],
  bundle: true, format: "esm", platform: "node", outfile: bundle,
  alias: { "@": path.resolve("src") }, logLevel: "warning",
});
const kitchen = await import(pathToFileURL(bundle).href);
const { MEALS, commonsSearchUrl, photoQueries, pickPhoto } = kitchen;

async function searchOnce(query) {
  const res = await fetch(commonsSearchUrl(query, WIDTH), { headers: { "User-Agent": UA } });
  if (!res.ok) return { pages: [], error: `HTTP ${res.status}` };
  const body = await res.json();
  return { pages: body?.query?.pages ?? [], error: null };
}

/** The same ladder the app walks: the dish's phrase, then its lead ingredient. */
async function photoFor(meal) {
  const queries = photoQueries(meal);
  for (const query of queries) {
    try {
      const { pages, error } = await searchOnce(query);
      if (error) return { query, photo: null, error };
      const photo = pickPhoto(pages);
      if (photo) return { query, photo, error: null, hits: pages.length };
    } catch (e) {
      return { query, photo: null, error: String(e).slice(0, 120) };
    }
  }
  return { query: queries[queries.length - 1] ?? "", photo: null, error: null };
}

/** Run the lot, a few at a time, in order. */
async function resolveAll() {
  const out = new Array(MEALS.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= MEALS.length) return;
      const meal = MEALS[i];
      const found = await photoFor(meal);
      out[i] = {
        id: meal.id,
        title: meal.en.title,
        phrase: meal.photo,
        searched: found.query,
        url: found.photo?.url ?? null,
        credit: found.photo?.credit ?? null,
        error: found.error,
      };
      process.stdout.write(`${found.photo ? "  ok" : "MISS"}  ${meal.en.title} — ${found.query}\n`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return out;
}

const rows = await resolveAll();

// Fetch the chosen thumbnails as data URIs, so the sheet is one self-contained
// file and Chromium never has to reach the network to render it.
async function inline(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

for (const row of rows) {
  row.data = row.url ? await inline(row.url) : null;
}

const found = rows.filter((r) => r.data).length;
console.log(`\n${found}/${rows.length} meals resolved to a photograph`);

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(
  path.join(OUT_DIR, "meal-photos.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      resolved: found,
      total: rows.length,
      meals: rows.map(({ data, ...rest }) => rest),
    },
    null,
    2,
  ) + "\n",
);

// The sheet itself: four to a row, the photo as the card and the dish under it,
// so a wrong picture is obvious at a glance rather than needing a click.
const cards = rows
  .map((r) => `
    <figure class="${r.data ? "" : "miss"}">
      ${r.data ? `<img src="${r.data}" alt="">` : `<div class="none">no photo found</div>`}
      <figcaption>
        <b>${escape(r.title)}</b>
        <span>${escape(r.searched)}</span>
        <em>${escape(r.credit ?? (r.data ? "public domain / CC0" : (r.error ?? "—")))}</em>
      </figcaption>
    </figure>`)
  .join("");

function escape(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
}

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 20px; background: #14101C; color: #F4F1FA;
         font: 13px/1.35 -apple-system, system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { margin: 0 0 18px; color: #A79EC0; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(4, 240px); gap: 14px; }
  figure { margin: 0; background: #1F1830; border-radius: 12px; overflow: hidden; }
  figure.miss { background: #2A1520; }
  img, .none { display: block; width: 240px; height: 150px; object-fit: cover; }
  .none { display: grid; place-items: center; color: #C98; font-size: 12px; background: #34202C; }
  figcaption { padding: 8px 10px 10px; }
  figcaption b { display: block; font-size: 13px; }
  figcaption span { display: block; color: #A79EC0; font-size: 11px; margin-top: 2px; }
  figcaption em { display: block; color: #7E7597; font-size: 10px; font-style: normal; margin-top: 4px; }
</style>
<h1>Meal photographs — what each dish resolves to on Wikimedia Commons</h1>
<p class="sub">${found} of ${rows.length} dishes found a photograph. Under each: the phrase that
was searched, then the credit the app prints on the card.</p>
<div class="grid">${cards}</div>`;

const htmlPath = path.join(OUT_DIR, "meal-photos.html");
await fs.writeFile(htmlPath, html);

// Playwright may be a project dependency (CI installs it) or only present as a
// global, the same as in the e2e suite — try the project first and fall back.
const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    const { createRequire } = await import("node:module");
    return createRequire("/opt/node22/lib/node_modules/x.js")("playwright");
  }
})();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1060, height: 900 } });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.screenshot({
  path: path.join(OUT_DIR, "meal-photos.jpg"),
  type: "jpeg",
  quality: 78,
  fullPage: true,
});
await browser.close();
// The HTML was only scaffolding for the screenshot; the sheet and the JSON are
// the record worth keeping.
await fs.rm(htmlPath, { force: true });

console.log(`wrote ${path.join(OUT_DIR, "meal-photos.jpg")}`);
if (found === 0) process.exitCode = 1;
