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
import { version_cpu } from "@tensorflow/tfjs-backend-cpu";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import jpeg from "jpeg-js";
import { base64Bytes, rank, SIDE, toInput, type Guess } from "./foodvisionpure";

export { base64Bytes, type Guess };


/** The labels the model's outputs stand for, in output order. */
export type ModelSource = {
  /** model.json of a TensorFlow.js graph model. */
  modelJson: { modelTopology: unknown; weightsManifest: { weights: tf.io.WeightsManifestEntry[] }[]; format?: string; signature?: unknown };
  /** All weight shards, concatenated in manifest order. */
  weights: ArrayBuffer;
  labels: string[];
};

let loaded: Promise<{ model: GraphModel; labels: string[] }> | null = null;

const isTyped = (a: unknown): a is Float32Array | Int32Array | Uint8Array | Uint8ClampedArray =>
  a instanceof Float32Array || a instanceof Int32Array || a instanceof Uint8Array || a instanceof Uint8ClampedArray;

function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++]!;
    let c: number;
    if (b < 0x80) c = b;
    else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++]! & 63);
    else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++]! & 63) << 6) | (bytes[i++]! & 63);
    else c = ((b & 7) << 18) | ((bytes[i++]! & 63) << 12) | ((bytes[i++]! & 63) << 6) | (bytes[i++]! & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}

/**
 * TensorFlow.js registers a "platform" only in a browser (a `document`) or in
 * Node (`process.versions`). React Native has neither, so on the phone there
 * was none and every tensor it built was mistyped ("got string tensor") —
 * which is why the scanner read nothing on a real device while the browser
 * and Node tests passed. This gives it the few services it needs.
 */
export function ensurePlatform() {
  const e = tf.env() as unknown as { platform?: unknown; setPlatform: (n: string, p: unknown) => void };
  if (e.platform) return;
  e.setPlatform("react-native", {
    fetch: (path: string, init?: RequestInit) => fetch(path, init),
    now: () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()),
    encode: (text: string) => utf8Encode(text),
    decode: (bytes: Uint8Array) => utf8Decode(bytes),
    isTypedArray: isTyped,
  });
}

async function ready(source: () => Promise<ModelSource>) {
  if (!loaded) {
    loaded = (async () => {
      ensurePlatform();
      // Named, so no bundler drops the import that registers the CPU kernels.
      if (!version_cpu) throw new Error("no cpu backend");
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

