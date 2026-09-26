/**
 * The phone side of recognising a meal photo: square and shrink the picture,
 * run the on-device classifier, and say which of the app's own foods each
 * guess is — so a tap logs real nutrition.
 *
 * Two engines, the same model (Google AIY food_V1):
 * - native TensorFlow Lite (react-native-fast-tflite) — well under a second.
 *   The picture is cropped and resized to 192 × 192 natively first.
 * - TensorFlow.js in JavaScript (./foodvision.ts) — only for an install built
 *   before the native module was added, which an over-the-air update can
 *   still reach. Correct, but slow: the phone's JavaScript engine has no JIT,
 *   and a single photo takes 20 s or more. The screen says so up front.
 */
import jpeg from "jpeg-js";
import { base64Bytes, dequantize, rank, SIDE, toRgbBytes, type Guess } from "./foodvisionpure";
import { labelToFood } from "./foodlabels";
import { FOOD_LABELS } from "./foodLabelNames";
import TFLITE from "../../assets/model/food/tflite.json";
import type { Food } from "@/kitchen";

/**
 * The image resizer is a native module. An over-the-air update can reach an
 * install built before it was added, so it is looked up, not imported: when
 * it is missing the full photo is decoded instead — slower, never a crash.
 */
type Manipulator = typeof import("expo-image-manipulator");
export function manipulator(): Manipulator | null {
  try {
    return require("expo-image-manipulator") as Manipulator;
  } catch {
    return null;
  }
}

/** The native TensorFlow Lite runtime, when this install has it. */
type Tflite = typeof import("react-native-fast-tflite");
function tflite(): Tflite | null {
  try {
    return require("react-native-fast-tflite") as Tflite;
  } catch {
    return null;
  }
}

/** Whether a photo will be read natively (fast) on this install. */
export function fastRecognition(): boolean {
  return tflite() !== null && manipulator() !== null;
}

export type Recognition = Guess & { food: Food | null; name: string };

type NativeModel = Awaited<ReturnType<Tflite["loadTensorflowModel"]>>;
let nativeModel: Promise<NativeModel> | null = null;
let data: typeof import("./foodModelData") | null = null;

/** The photo's centre square at the model's size, as JPEG base64 — done natively. */
async function squareJpeg(uri: string, m: Manipulator): Promise<string> {
  const small = await m.manipulateAsync(uri, [{ resize: { width: 384 } }], { format: m.SaveFormat.JPEG, compress: 0.92 });
  const side = Math.min(small.width, small.height);
  const sq = await m.manipulateAsync(
    small.uri,
    [
      {
        crop: {
          originX: Math.floor((small.width - side) / 2),
          originY: Math.floor((small.height - side) / 2),
          width: side,
          height: side,
        },
      },
      { resize: { width: SIDE, height: SIDE } },
    ],
    { base64: true, format: m.SaveFormat.JPEG, compress: 0.95 },
  );
  if (!sq.base64) throw new Error("no image data");
  return sq.base64;
}

/** Pixels of a JPEG as the uint8 RGB square the TensorFlow Lite model takes. */
export function jpegToModelInput(b64: string): Uint8Array {
  const img = jpeg.decode(base64Bytes(b64), { useTArray: true, maxMemoryUsageInMB: 512 });
  return toRgbBytes(img.data, img.width, img.height);
}

/**
 * The model file as a `file://` path. In a release build a bundled asset
 * resolves to an Android resource name, not a URL, and the TensorFlow Lite
 * loader reads its source with `new URL(..)` — so the asset is first copied
 * to the cache by expo-asset, which knows every place an asset can live
 * (the APK, an over-the-air update, the dev server).
 */
async function modelFile(): Promise<string> {
  const { Asset } = require("expo-asset") as typeof import("expo-asset");
  const [asset] = await Asset.loadAsync(require("../../assets/model/food/food.tflite"));
  const uri = asset?.localUri ?? asset?.uri;
  if (!uri) throw new Error("model file missing");
  return uri;
}

async function classifyNative(uri: string, lib: Tflite, m: Manipulator): Promise<Guess[]> {
  nativeModel ??= modelFile()
    .then((url) => lib.loadTensorflowModel({ url }, []))
    .catch((e: unknown) => {
      nativeModel = null;
      throw e;
    });
  const [model, square] = await Promise.all([nativeModel, squareJpeg(uri, m)]);
  const input = jpegToModelInput(square);
  const inType = model.inputs[0]?.dataType;
  const buffer =
    inType === "float32"
      ? Float32Array.from(input, (v) => v / 255).buffer
      : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  const [out] = await model.run([buffer as ArrayBuffer]);
  if (!out) throw new Error("no output");
  const scores =
    model.outputs[0]?.dataType === "float32"
      ? new Float32Array(out)
      : dequantize(new Uint8Array(out), TFLITE.output.scale, TFLITE.output.zeroPoint);
  return rank(scores, FOOD_LABELS, 8);
}

async function classifyJs(uri: string, fullBase64: string | null, m: Manipulator | null): Promise<Guess[]> {
  let b64 = fullBase64;
  if (m) b64 = await squareJpeg(uri, m).catch(() => fullBase64);
  if (!b64) throw new Error("no image data");
  // TensorFlow is loaded the first time a photo is read, never at app start:
  // nothing about it can slow or break opening the app.
  const { classifyJpeg } = require("./foodvision") as typeof import("./foodvision");
  return classifyJpeg(
    b64,
    async () => {
      data ??= require("./foodModelData") as typeof import("./foodModelData");
      const bytes = base64Bytes(data.WEIGHTS_B64);
      return {
        modelJson: data.MODEL_JSON as never,
        weights: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        labels: data.LABELS,
      };
    },
    8,
  );
}

/** What recognised labels are in the app's own food list: one row per food, best first. */
export function toRecognitions(guesses: Guess[], locale: "he" | "en"): Recognition[] {
  // Several labels can land on one library food ("Hummus", "Hummus with
  // pine nuts"); the first (best) one stands for it, with the scores summed.
  const out: Recognition[] = [];
  const byKey = new Map<string, Recognition>();
  for (const g of guesses) {
    const food = labelToFood(g.label);
    const key = food ? food.id : g.label.toLowerCase();
    const seen = byKey.get(key);
    if (seen) {
      seen.score += g.score;
      continue;
    }
    const r: Recognition = { ...g, food, name: food ? (locale === "he" ? food.he : food.en) : g.label };
    byKey.set(key, r);
    out.push(r);
  }
  // A dish the app can count comes before one it can only search for.
  out.sort((a, b) => (a.food ? 0 : 1) - (b.food ? 0 : 1) || b.score - a.score);
  return out.slice(0, 5);
}

export async function recognizePhoto(
  uri: string,
  fullBase64: string | null,
  locale: "he" | "en",
): Promise<Recognition[]> {
  const m = manipulator();
  const lib = tflite();
  let guesses: Guess[] | null = null;
  if (lib && m) {
    try {
      guesses = await classifyNative(uri, lib, m);
    } catch {
      guesses = null;
    }
  }
  guesses ??= await classifyJs(uri, fullBase64, m);
  return toRecognitions(guesses, locale);
}
