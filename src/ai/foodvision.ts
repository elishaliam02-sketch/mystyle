/**
 * Recognising food in a photograph on the phone itself.
 *
 * The photo scanner used to send the picture to a server model, which needs a
 * key the app does not hold yet — so it read nothing. This runs an open food
 * classifier (Google's AIY food_V1, ~2,000 dishes, Apache-2.0) with
 * TensorFlow.js on the CPU: no key, no account, no network, no quota, and the
 * photo never leaves the phone.
 *
 * A classifier names what the plate most looks like; it does not weigh it. So
 * the screen offers its top guesses to tap, and the calculator — with real
 * nutrition per 100 g — takes it from there.
 */
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import jpeg from "jpeg-js";

export type Guess = { label: string; score: number };

/** The model's input side, in pixels. */
const SIDE = 224;

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

/** The labels the model's outputs stand for, in output order. */
export type ModelSource = {
  /** model.json of a TensorFlow.js graph model. */
  modelJson: { modelTopology: unknown; weightsManifest: { weights: tf.io.WeightsManifestEntry[] }[]; format?: string; signature?: unknown };
  /** All weight shards, concatenated in manifest order. */
  weights: ArrayBuffer;
  labels: string[];
};

let loaded: Promise<{ model: GraphModel; labels: string[] }> | null = null;

async function ready(source: () => Promise<ModelSource>) {
  if (!loaded) {
    loaded = (async () => {
      await tf.setBackend("cpu");
      await tf.ready();
      const src = await source();
      const weightSpecs = src.modelJson.weightsManifest.flatMap((g) => g.weights);
      const model = await loadGraphModel(
        tf.io.fromMemory({
          modelTopology: src.modelJson.modelTopology as tf.io.ModelJSON["modelTopology"],
          weightSpecs,
          weightData: src.weights,
          format: src.modelJson.format,
          signature: src.modelJson.signature as tf.io.ModelArtifacts["signature"],
        }),
      );
      return { model, labels: src.labels };
    })().catch((e) => {
      loaded = null;
      throw e;
    });
  }
  return loaded;
}

/** The dishes a JPEG most looks like, best first. */
export async function classifyJpeg(
  base64: string,
  source: () => Promise<ModelSource>,
  top = 5,
): Promise<Guess[]> {
  const { model, labels } = await ready(source);
  const decoded = jpeg.decode(base64Bytes(base64), { useTArray: true, maxMemoryUsageInMB: 1024 });
  const input = toInput(decoded.data, decoded.width, decoded.height);
  const scores = tf.tidy(() => {
    const x = tf.tensor4d(input, [1, SIDE, SIDE, 3]);
    const y = model.predict(x) as tf.Tensor;
    return y.dataSync().slice();
  });
  return rank(scores, labels, top);
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
