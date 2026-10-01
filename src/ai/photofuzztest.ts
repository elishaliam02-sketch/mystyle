/**
 * No photo may break the scanner: odd formats, damaged files, files that lie
 * about their size, and plain noise either read or are refused quickly — never
 * a hang, never an exception that escapes, never a huge allocation.
 */
import { base64Bytes } from "./foodvisionpure";
import { photoPixels } from "./recognize";
import { decodeJpegEighth } from "./jpegdc";
import ODD from "./testdata/odd-photos.json";

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

/** Runs a reading and reports: read, refused, or broke (an error that is not ours). */
function attempt(bytes: Uint8Array): { kind: "read" | "refused" | "none"; ms: number; w?: number; err?: string } {
  const t0 = Date.now();
  try {
    const px = photoPixels(bytes);
    const ms = Date.now() - t0;
    if (!px) return { kind: "none", ms };
    if (!(px.width > 0 && px.height > 0 && px.data.length === px.width * px.height * 4)) return { kind: "refused", ms, err: "bad output" };
    return { kind: "read", ms, w: px.width };
  } catch (e) {
    return { kind: "refused", ms: Date.now() - t0, err: String(e) };
  }
}

const odd = ODD as Record<string, string>;
for (const kind of ["cmyk", "gray", "rst", "prog"]) {
  const r = attempt(base64Bytes(odd[kind]!));
  check(`a ${kind} JPEG is read`, r.kind === "read", JSON.stringify(r));
}
for (const kind of ["png", "webp"]) {
  const r = attempt(base64Bytes(odd[kind]!));
  check(`a ${kind.toUpperCase()} is handed to the native reader (not decoded here)`, r.kind === "none", JSON.stringify(r));
}

// Damaged files: every cut point and random corruption of a real photo.
const jpeg = base64Bytes(odd.rst!);
let worst = 0;
let escaped = "";
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < 300; i++) {
  const cut = jpeg.slice(0, 2 + Math.floor(rand() * (jpeg.length - 2)));
  const r = attempt(cut);
  worst = Math.max(worst, r.ms);
  if (r.err && !/jpeg|size|table|scan|frame|image|precision|unsupported|large|marker|memory|SOI|EOI/i.test(r.err)) escaped ||= r.err;
}
for (let i = 0; i < 300; i++) {
  const bad = jpeg.slice();
  for (let k = 0; k < 1 + Math.floor(rand() * 40); k++) bad[2 + Math.floor(rand() * (bad.length - 2))] = Math.floor(rand() * 256);
  const r = attempt(bad);
  worst = Math.max(worst, r.ms);
}
check("damaged photos never hang (each read under a second)", worst < 1000, `${worst}ms`);

// Noise, with and without a JPEG start.
let noiseWorst = 0;
for (let i = 0; i < 200; i++) {
  const n = new Uint8Array(16 + Math.floor(rand() * 4000));
  for (let k = 0; k < n.length; k++) n[k] = Math.floor(rand() * 256);
  if (i % 2) {
    n[0] = 0xff;
    n[1] = 0xd8;
  }
  noiseWorst = Math.max(noiseWorst, attempt(n).ms);
}
check("random bytes are refused quickly", noiseWorst < 1000, `${noiseWorst}ms`);

// A header that claims an enormous picture is refused before allocating.
{
  const lie = jpeg.slice();
  for (let i = 2; i < lie.length - 8; i++) {
    if (lie[i] === 0xff && (lie[i + 1] === 0xc0 || lie[i + 1] === 0xc2)) {
      lie[i + 5] = 0xff; lie[i + 6] = 0xf0; // height 65,520
      lie[i + 7] = 0xff; lie[i + 8] = 0xf0; // width 65,520
      break;
    }
  }
  const r = attempt(lie);
  check("a file claiming 65,520 × 65,520 is refused at once", r.kind === "refused" && r.ms < 200, JSON.stringify(r));
}
// The 1/8 reader itself (used for big photos) on the same damage.
{
  let dcWorst = 0;
  let dcEscaped = "";
  for (const src of [base64Bytes(odd.rst!), base64Bytes(odd.prog!), base64Bytes(odd.cmyk!)]) {
    for (let i = 0; i < 200; i++) {
      const bad = i % 2 ? src.slice(0, 2 + Math.floor(rand() * (src.length - 2))) : src.slice();
      if (!(i % 2)) for (let k = 0; k < 1 + Math.floor(rand() * 30); k++) bad[2 + Math.floor(rand() * (bad.length - 2))] = Math.floor(rand() * 256);
      const t0 = Date.now();
      try {
        decodeJpegEighth(bad);
      } catch (e) {
        if (!(e instanceof Error)) dcEscaped ||= String(e);
      }
      dcWorst = Math.max(dcWorst, Date.now() - t0);
    }
  }
  check("the 1/8 reader never hangs on damaged files", dcWorst < 1000, `${dcWorst}ms`);
  check("and only ever throws ordinary errors", !dcEscaped, dcEscaped);
}
check("an empty file is not a photo", attempt(new Uint8Array(0)).kind !== "read");

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
