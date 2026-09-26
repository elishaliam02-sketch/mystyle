/**
 * Ships the app's own food photography: one generated picture per library
 * dish and per food, in one consistent style (light table, soft daylight),
 * so no two cards share a picture and none is a stranger's snapshot of
 * something else.
 *
 * docs/photos/generated.json lists each picture's key ("meal:<id>" or
 * "food:<id>") and where to download it. This fetches them, shrinks them
 * (a dish 640 × 480, a food 240 × 240), writes assets/meals and assets/foods,
 * and regenerates the two photo maps — keeping the existing photo for any id
 * not in the list. Runs on CI (.github/workflows/generated-photos.yml),
 * which has the network the sandbox lacks.
 */
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const sharp = createRequire(import.meta.url)("sharp");

const LIST = path.resolve("docs/photos/generated.json");
const SHEET = path.resolve("docs/qa/generated-photos.jpg");
const KINDS = {
  meal: { dir: "assets/meals", map: "src/kitchen/mealPhotoAssets.ts", w: 640, h: 480, name: "BUNDLED_MEAL_PHOTOS" },
  food: { dir: "assets/foods", map: "src/kitchen/foodPhotoAssets.ts", w: 240, h: 240, name: "BUNDLED_FOOD_PHOTOS" },
};

const list = JSON.parse(await fs.readFile(LIST, "utf8"));
const done = { meal: [], food: [] };

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
}

for (const { key, url } of list) {
  const [kind, id] = key.split(":");
  const k = KINDS[kind];
  if (!k || !id) continue;
  const bytes = await get(url);
  if (!bytes) {
    console.log(`FAIL  ${key}`);
    continue;
  }
  const out = await sharp(bytes)
    .resize(k.w, k.h, { fit: "cover", position: "centre" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  await fs.writeFile(path.join(k.dir, `${id}.jpg`), out);
  done[kind].push(id);
  console.log(`  ok  ${key}  ${(out.length / 1024).toFixed(0)} KB`);
}

// Rewrite each map: generated ids get credit null (the app's own pictures);
// every other entry keeps its line exactly as it was.
for (const [kind, k] of Object.entries(KINDS)) {
  if (done[kind].length === 0) continue;
  const src = await fs.readFile(k.map, "utf8");
  const entries = new Map();
  for (const m of src.matchAll(/^ {2}"([^"]+)": (\{ source: require\([^)]*\), credit: [^}]*\}),$/gm)) {
    entries.set(m[1], m[2]);
  }
  for (const id of done[kind]) {
    entries.set(id, `{ source: require(${JSON.stringify(`../../${k.dir}/${id}.jpg`)}), credit: null }`);
  }
  const head = src.slice(0, src.indexOf(`export const ${k.name}`));
  const body = [...entries.keys()].sort().map((id) => `  ${JSON.stringify(id)}: ${entries.get(id)},`);
  await fs.writeFile(k.map, `${head}export const ${k.name}: Record<string, BundledPhoto> = {\n${body.join("\n")}\n};\n`);
}

// A contact sheet, so a wrong picture is caught by looking.
const all = [...done.meal.map((id) => ["meal", id]), ...done.food.map((id) => ["food", id])];
const COLS = 10;
const T = 120;
const tiles = [];
for (let i = 0; i < all.length; i++) {
  const [kind, id] = all[i];
  tiles.push({
    input: await sharp(path.join(KINDS[kind].dir, `${id}.jpg`)).resize(T, T, { fit: "cover" }).toBuffer(),
    left: (i % COLS) * T,
    top: Math.floor(i / COLS) * T,
  });
}
await fs.mkdir(path.dirname(SHEET), { recursive: true });
if (tiles.length) {
  await sharp({ create: { width: COLS * T, height: Math.ceil(all.length / COLS) * T, channels: 3, background: "#222" } })
    .composite(tiles)
    .jpeg({ quality: 70 })
    .toFile(SHEET);
}
console.log(`\n${done.meal.length} dishes, ${done.food.length} foods`);
