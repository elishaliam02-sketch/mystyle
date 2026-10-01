/**
 * Every <Image> that shows a photo from the phone (a meal photo, a progress
 * photo) must decode it at the size it is shown: resizeMethod="resize".
 * Without it Android may load a 12–200 MP camera file whole, and drawing that
 * bitmap closes the app ("Canvas: trying to draw too large bitmap") — one of
 * the ways a meal photo crashed the app on real phones.
 * Remote pictures (with headers, from the web) are sized by their URL instead.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const bad = [];
let seen = 0;
for (const f of [...(await files("app")), ...(await files("src"))]) {
  const src = await readFile(f, "utf8");
  for (const m of src.matchAll(/<Image\b[\s\S]*?\/>/g)) {
    const tag = m[0];
    if (!/source=\{\{\s*uri:/.test(tag) || /headers/.test(tag)) continue;
    seen++;
    if (!/resizeMethod="resize"/.test(tag)) bad.push(`${f}: ${tag.slice(0, 80).replace(/\s+/g, " ")}`);
  }
}
const ok = seen > 0 && bad.length === 0;
console.log(`${ok ? "PASS" : "FAIL"}  every phone photo on screen is decoded at display size (${seen} found)`);
for (const b of bad) console.log("   ← " + b);
console.log(`\n${ok ? 1 : 0}/1 passed`);
if (!ok) process.exitCode = 1;
