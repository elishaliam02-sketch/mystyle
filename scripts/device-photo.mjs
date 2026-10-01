// A phone-camera-sized photo for the device test: the shakshuka picture blown
// up to 12 megapixels (4000 × 3000). The emulator test used to scan a 640 × 480
// picture, which never showed what a real camera photo costs in memory.
import fs from "node:fs";
import jpeg from "jpeg-js";

// `node scripts/device-photo.mjs out.jpg` — the shakshuka at 12 MP.
// `node scripts/device-photo.mjs out.jpg nonfood` — a 48 MP landscape that is
// not food at all (sky over a field), for "any photo must not crash it".
const nonfood = process.argv[3] === "nonfood";
const src = nonfood
  ? (() => {
      const w = 64, h = 48, data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4, sky = y < h * 0.6;
        data[o] = sky ? 90 + y * 2 : 60 + x; data[o + 1] = sky ? 150 + y : 120 + (x % 7) * 3; data[o + 2] = sky ? 235 - y : 50; data[o + 3] = 255;
      }
      return { width: w, height: h, data };
    })()
  : jpeg.decode(fs.readFileSync("assets/meals/shakshuka.jpg"), { useTArray: true });
const W = nonfood ? 8000 : 4000;
const H = nonfood ? 6000 : 3000;
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const sy = Math.min(src.height - 1, Math.floor((y * src.height) / H));
  for (let x = 0; x < W; x++) {
    const sx = Math.min(src.width - 1, Math.floor((x * src.width) / W));
    const s = (sy * src.width + sx) * 4;
    const o = (y * W + x) * 4;
    // A little per-pixel grain, as a real sensor has, so the file is
    // camera-sized rather than a flat upscale that compresses to nothing.
    const n = ((x * 7919 + y * 104729) % 13) - 6;
    out[o] = Math.max(0, Math.min(255, src.data[s] + n));
    out[o + 1] = Math.max(0, Math.min(255, src.data[s + 1] + n));
    out[o + 2] = Math.max(0, Math.min(255, src.data[s + 2] + n));
    out[o + 3] = 255;
  }
}
const file = process.argv[2] ?? "shakshuka-12mp.jpg";
fs.writeFileSync(file, jpeg.encode({ data: out, width: W, height: H }, 90).data);
console.log(`${file}: ${W}x${H}, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
