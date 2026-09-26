/**
 * The plain-arithmetic half of on-device food recognition (./foodvision.ts):
 * base64, pixels and ranking — no TensorFlow here, so it tests in Node.
 */
export type Guess = { label: string; score: number };

/** The model's input side, in pixels (AIY food_V1 takes 192 × 192). */
export const SIDE = 192;

/** base64 → bytes, without Buffer or atob (neither is certain in Hermes). */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();
export function base64Bytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (LOOKUP[clean.charCodeAt(i)]! << 18) |
      (LOOKUP[clean.charCodeAt(i + 1) || 65]! << 12) |
      ((i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)]! : 0) << 6) |
      (i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)]! : 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}

/**
 * The centre square of an RGBA image, sampled down to SIDE × SIDE and scaled
 * to [0, 1] — what the classifier was trained on. Area-averaged, so a 12 MP
 * photo is not reduced to a handful of aliased pixels.
 */
export function toInput(rgba: Uint8Array, width: number, height: number): Float32Array {
  const crop = Math.min(width, height);
  const x0 = Math.floor((width - crop) / 2);
  const y0 = Math.floor((height - crop) / 2);
  const step = crop / SIDE;
  // A few samples per output pixel is plenty and keeps a big photo fast.
  const taps = Math.max(1, Math.min(3, Math.floor(step)));
  const out = new Float32Array(SIDE * SIDE * 3);
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < taps; dy++) {
        for (let dx = 0; dx < taps; dx++) {
          const sx = Math.min(width - 1, x0 + Math.floor((x + (dx + 0.5) / taps) * step));
          const sy = Math.min(height - 1, y0 + Math.floor((y + (dy + 0.5) / taps) * step));
          const p = (sy * width + sx) * 4;
          r += rgba[p]!;
          g += rgba[p + 1]!;
          b += rgba[p + 2]!;
        }
      }
      const n = taps * taps * 255;
      const o = (y * SIDE + x) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  return out;
}

/** The top entries of a score vector with their labels — the background class
 * ("__background__", index 0 in the AIY label map) never counts as a dish. */
export function rank(scores: ArrayLike<number>, labels: string[], top = 5): Guess[] {
  const idx = Array.from({ length: scores.length }, (_, i) => i).filter(
    (i) => labels[i] && !/^__background__$/i.test(labels[i]!),
  );
  idx.sort((a, b) => scores[b]! - scores[a]!);
  return idx.slice(0, top).map((i) => ({ label: labels[i]!, score: scores[i]! }));
}
