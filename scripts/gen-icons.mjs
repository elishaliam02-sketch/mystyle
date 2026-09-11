/**
 * Renders every launcher asset from the one mark definition.
 *
 *     node scripts/gen-icons.mjs
 *
 * The icon on a home screen and the logo inside the app drifted apart once
 * already — the palette changed and the PNGs kept the old red "A", because a
 * PNG has no way of knowing. So the icons are generated: the geometry comes
 * from `src/theme/mark.ts` and the colours from `src/theme/tokens.ts`, the
 * same two files the app draws from, and this script is re-run whenever either
 * changes.
 *
 * Chromium does the rasterising (it is already here for the end-to-end suite),
 * so there is no image toolchain to install and nothing to keep in a binary
 * format that cannot be reviewed in a diff.
 */
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    return createRequire("/opt/node22/lib/node_modules/x.js")("playwright");
  }
})();

// Import the real modules rather than copying their values here.
const bundle = path.resolve("node_modules/.cache/mark.mjs");
await build({
  entryPoints: ["scripts/mark-entry.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  alias: { "@": path.resolve("src") },
  logLevel: "warning",
});
const { MARK, COLORS } = await import(pathToFileURL(bundle).href + `?t=${Date.now()}`);

/** One SVG string, with the knobs each asset needs. */
function svg({ size, background, peakFrom, peakTo, step, scale = 1 }) {
  const inset = (100 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${background ? `<rect width="100" height="100" fill="${background}"/>` : ""}
  <defs>
    <linearGradient id="p" gradientUnits="userSpaceOnUse" x1="16" y1="18" x2="84" y2="58">
      <stop offset="0" stop-color="${peakFrom}"/>
      <stop offset="1" stop-color="${peakTo}"/>
    </linearGradient>
  </defs>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <path d="${MARK.peak}" fill="none" stroke="url(#p)" stroke-width="${MARK.peakWidth}"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${MARK.step}" fill="none" stroke="${step}" stroke-width="${MARK.stepWidth}"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const dark = COLORS.dark;
const light = COLORS.light;

const ASSETS = [
  {
    file: "assets/icon.png",
    size: 1024,
    transparent: false,
    // The store icon: the mark on the app's own violet-black, at the scale a
    // rounded mask will not clip.
    svg: { background: dark.band, peakFrom: light.heroFrom, peakTo: dark.accent, step: dark.lime, scale: 0.72 },
  },
  {
    file: "assets/splash-icon.png",
    size: 1024,
    transparent: true,
    // Transparent: app.json paints the splash background, and a baked-in one
    // would show as a square against it.
    svg: { background: null, peakFrom: light.heroFrom, peakTo: dark.accent, step: dark.lime, scale: 0.9 },
  },
  {
    file: "assets/favicon.png",
    size: 96,
    transparent: false,
    svg: { background: dark.band, peakFrom: light.heroFrom, peakTo: dark.accent, step: dark.lime, scale: 0.78 },
  },
  {
    file: "assets/android-icon-foreground.png",
    size: 1024,
    transparent: true,
    // Android crops the foreground hard: two thirds of the canvas is the only
    // part guaranteed to survive every mask shape on every launcher.
    svg: { background: null, peakFrom: light.heroFrom, peakTo: dark.accent, step: dark.lime, scale: 0.62 },
  },
  {
    file: "assets/android-icon-background.png",
    size: 1024,
    transparent: false,
    svg: { background: dark.band, peakFrom: dark.band, peakTo: dark.band, step: dark.band, scale: 0.62 },
  },
  {
    file: "assets/android-icon-monochrome.png",
    size: 1024,
    transparent: true,
    // Themed icons are tinted by the system from a single-colour silhouette,
    // so both strokes go solid white and the gradient is dropped.
    svg: { background: null, peakFrom: "#FFFFFF", peakTo: "#FFFFFF", step: "#FFFFFF", scale: 0.62 },
  },
];

const browser = await chromium.launch();
const dir = await mkdtemp(path.join(tmpdir(), "apex-icons-"));

for (const asset of ASSETS) {
  const markup = svg({ size: asset.size, ...asset.svg });
  const file = path.join(dir, `${path.basename(asset.file)}.svg.html`);
  await writeFile(
    file,
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}</style>${markup}`,
  );
  const page = await browser.newPage({
    viewport: { width: asset.size, height: asset.size },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.screenshot({
    path: path.resolve(asset.file),
    omitBackground: asset.transparent,
  });
  await page.close();
  console.log(`wrote ${asset.file} (${asset.size}px)`);
}

await browser.close();
