/**
 * Ships a real photograph of every FOOD inside the app — the ingredients, not
 * the dishes (those are scripts/bundle-meal-photos.mjs).
 *
 * "Your plate" is built from whatever is in the person's fridge, so no single
 * dish photo can be honest about it: salmon, rice and broccoli wearing a photo
 * of chicken with rice and broccoli is exactly the complaint. With a photo per
 * food, the plate shows its own ingredients, the diary and the search show
 * what each thing is, and "can I eat this?" shows the food itself.
 *
 * Photos are square-cropped and small (they are drawn at thumbnail and tile
 * size), public-domain ones are preferred so most need no credit line, and no
 * two foods share a picture. Also lays out a contact sheet in docs/qa so a
 * wrong picture is caught by looking rather than by a user.
 *
 * Needs the open internet, so it runs on CI (.github/workflows/meal-photos.yml),
 * which commits assets/foods/ and src/kitchen/foodPhotoAssets.ts back.
 */
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const sharp = createRequire(import.meta.url)("sharp");

const ASSET_DIR = path.resolve("assets/foods");
const MAP_FILE = path.resolve("src/kitchen/foodPhotoAssets.ts");
const SHEET = path.resolve("docs/qa/food-photos.jpg");
const SHEET_JSON = path.resolve("docs/qa/food-photos.json");
// Drawn at up to ~160 px (a mosaic tile); 240 px square stays sharp on a dense
// screen and keeps the whole set to a few megabytes.
const SIDE = 240;
const FETCH_WIDTH = 330;
const UA = "APEX-app/1.0 (https://github.com/elishaliam02-sketch/mystyle)";

const bundle = path.resolve("node_modules/.cache/foodphotobundle.mjs");
await build({
  entryPoints: ["src/kitchen/index.ts"],
  bundle: true, format: "esm", platform: "node", outfile: bundle,
  alias: { "@": path.resolve("src") }, logLevel: "warning",
  external: ["react-native"],
});
const { FOODS, commonsSearchUrl, pickPhoto } = await import(pathToFileURL(bundle).href);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) return null;
    } catch {}
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

/** The search phrases for one food, best first. */
function queries(food) {
  const out = [];
  for (const q of [food.photo, food.en, `${food.en} food`]) {
    const clean = (q ?? "").trim().toLowerCase();
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/**
 * Pictures that are about something other than the food. Searching Commons
 * for a single word finds the plant, the tree, the field it grows in — or a
 * band called Red Hot Chili Peppers — as readily as the food on a plate, and
 * a thumbnail of an onion flower is not an onion. The first run of this
 * script shipped exactly those; the contact sheet caught them.
 */
const NOT_FOOD = /\b(trees?|orchards?|flowers?|flowering|blossoms?|inflorescences?|plants?|fields?|gardens?|farms?|farming|agriculture|concerts?|musicians?|guitars?|singers?|bands?|houses?|streets?|buildings?|architecture|gravestones?|graves?|cemetery|people|portraits?|landscapes?|paintings?|drawings?|diagrams?|maps?|logos?|utensils?|tools?|vendors?|shops?|restaurants? interior|stalls?)\b/i;

function plain(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function aboutFood(page) {
  const info = page.imageinfo?.[0];
  const said = [
    page.title ?? "",
    plain(info?.extmetadata?.Categories?.value),
    plain(info?.extmetadata?.ObjectName?.value),
  ].join(" ");
  return !NOT_FOOD.test(said);
}

/** Up to four usable pictures from one response, in the picker's own order. */
function candidates(allPages, used) {
  const pages = allPages.filter(aboutFood);
  const seen = new Set(used);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const photo = pickPhoto(pages, seen);
    if (!photo) break;
    out.push(photo);
    seen.add(photo.url);
  }
  return out;
}

const used = new Set();
const entries = [];
await fs.rm(ASSET_DIR, { recursive: true, force: true });
await fs.mkdir(ASSET_DIR, { recursive: true });
await fs.mkdir(path.dirname(SHEET), { recursive: true });

/**
 * Foods Commons never returned a true picture of, after several phrasings
 * (mayonnaise came back as cardboard boxes). They keep their colour dot: no
 * picture beats a wrong one.
 */
const NO_PHOTO = new Set(["mayo", "whiteCheese", "soupPowder"]);

for (const food of FOODS) {
  if (NO_PHOTO.has(food.id)) continue;
  let chosen = null;
  let query = null;
  for (const q of queries(food)) {
    const res = await get(commonsSearchUrl(q, FETCH_WIDTH));
    const body = res ? await res.json().catch(() => null) : null;
    const found = candidates(body?.query?.pages ?? [], used);
    if (found.length) {
      // Search rank still leads; among the top few, one that asks for no
      // credit wins, because a thumbnail has no room for a credit line.
      chosen = found.slice(0, 3).find((p) => p.credit === null) ?? found[0];
      query = q;
      break;
    }
    await sleep(120);
  }
  if (!chosen) {
    console.log(`MISS  ${food.id}`);
    continue;
  }
  const img = await get(chosen.url);
  const bytes = img ? Buffer.from(await img.arrayBuffer()) : null;
  if (!bytes || bytes.length < 1500 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    console.log(`FAIL  ${food.id} — could not download ${chosen.url}`);
    continue;
  }
  let out;
  try {
    out = await sharp(bytes)
      .resize(SIDE, SIDE, { fit: "cover", position: "attention" })
      .jpeg({ quality: 74, mozjpeg: true })
      .toBuffer();
  } catch {
    console.log(`FAIL  ${food.id} — not a readable image`);
    continue;
  }
  used.add(chosen.url);
  await fs.writeFile(path.join(ASSET_DIR, `${food.id}.jpg`), out);
  entries.push({ id: food.id, he: food.he, query, credit: chosen.credit, url: chosen.url });
  console.log(`  ok  ${food.id}  ${(out.length / 1024).toFixed(0)} KB  (${query})`);
  await sleep(120); // polite against a free public API
}

entries.sort((a, b) => a.id.localeCompare(b.id));
const lines = entries.map(
  (e) =>
    `  ${JSON.stringify(e.id)}: { source: require(${JSON.stringify(`../../assets/foods/${e.id}.jpg`)}), credit: ${JSON.stringify(e.credit)} },`,
);
await fs.writeFile(
  MAP_FILE,
  `// Generated by scripts/bundle-food-photos.mjs — do not edit by hand.
// A real photograph of each food, from Wikimedia Commons, shipped inside the
// app: the tiles of "your plate", the diary and the search. Nothing requested.
import type { BundledPhoto } from "./mealPhotoAssets";

export const BUNDLED_FOOD_PHOTOS: Record<string, BundledPhoto> = {
${lines.join("\n")}
};
`,
);

// ------------------------------------------------------------ contact sheet
const COLS = 12;
const TILE = 120;
const LABEL = 18;
const rows = Math.ceil(entries.length / COLS);
const composites = [];
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const x = (i % COLS) * TILE;
  const y = Math.floor(i / COLS) * (TILE + LABEL);
  const tile = await sharp(path.join(ASSET_DIR, `${e.id}.jpg`)).resize(TILE, TILE).toBuffer();
  composites.push({ input: tile, left: x, top: y });
  const label = e.id.length > 16 ? `${e.id.slice(0, 15)}…` : e.id;
  const svg = `<svg width="${TILE}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="4" y="13" font-family="sans-serif" font-size="11" fill="#fff">${label}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left: x, top: y + TILE });
}
await sharp({
  create: { width: COLS * TILE, height: Math.max(1, rows) * (TILE + LABEL), channels: 3, background: "#222" },
})
  .composite(composites)
  .jpeg({ quality: 70 })
  .toFile(SHEET);
await fs.writeFile(SHEET_JSON, `${JSON.stringify(entries, null, 1)}\n`);

console.log(`\n${entries.length}/${FOODS.length} foods bundled`);
if (entries.length < FOODS.length * 0.7) {
  console.error("Too many foods without a photo — refusing to replace the bundle.");
  process.exit(1);
}
