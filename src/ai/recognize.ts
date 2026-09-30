/**
 * The phone side of recognising a meal photo: shrink the picture, run the
 * on-device classifier, and say which of the app's own foods each guess is —
 * so a tap logs real nutrition.
 *
 * On a phone the photo is never decoded at full size. The picker hands over
 * the camera's JPEG file untouched, and it is read at 1/8 size straight from
 * its bytes (./jpegdc.ts): a 12-megapixel photo costs about a megabyte of
 * pixels instead of the 48 MB bitmap that the picker's re-compression and the
 * native resizer each built — which is what closed the app on real phones
 * (the test emulator's small photo never showed it).
 *
 * Two engines, the same model (Google AIY food_V1):
 * - native TensorFlow Lite (react-native-fast-tflite) — well under a second.
 * - TensorFlow.js in JavaScript (./foodvision.ts) — for an install built
 *   before the native module was added. Correct, but slow.
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
/** Test hook: behave like an install without the native resizer, so the
 * device test can drive the path older installs take on a real phone. */
let legacy = false;
export function simulateLegacyInstall(on: boolean) {
  legacy = on;
}
export function manipulator(): Manipulator | null {
  if (legacy) return null;
  try {
    return require("expo-image-manipulator") as Manipulator;
  } catch {
    return null;
  }
}

/** The native TensorFlow Lite runtime, when this install has it. */
type Tflite = typeof import("react-native-fast-tflite");
function tflite(): Tflite | null {
  if (legacy) return null;
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

/** Where a reading got to, recorded so a crash can be traced to its step. */
export type ScanStage = "resize" | "model" | "run" | "js" | "small" | "decode";
type OnStage = (stage: ScanStage) => void;

async function classifyNative(uri: string, lib: Tflite, m: Manipulator, onStage: OnStage): Promise<Guess[]> {
  onStage("model");
  await nativeModelFor(lib);
  onStage("resize");
  const square = await squareJpeg(uri, m);
  onStage("run");
  return runNative(lib, jpegToModelInput(square));
}

/** The JavaScript model's weights, loaded the first time a photo is read. */
async function jsModel() {
  data ??= require("./foodModelData") as typeof import("./foodModelData");
  const bytes = base64Bytes(data.WEIGHTS_B64);
  return {
    modelJson: data.MODEL_JSON as never,
    weights: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    labels: data.LABELS,
  };
}

async function classifyJs(uri: string, m: Manipulator): Promise<Guess[]> {
  const b64 = await squareJpeg(uri, m);
  // TensorFlow is loaded the first time a photo is read, never at app start:
  // nothing about it can slow or break opening the app.
  const { classifyJpeg } = require("./foodvision") as typeof import("./foodvision");
  return classifyJpeg(b64, jsModel, 8);
}

/**
 * A photo's JPEG bytes as a small RGBA image for the model, without ever
 * holding the full-size picture: up to 3 MP it is decoded whole (safe at that
 * size, and 1/8 of it would be too few pixels), above that only each 8×8
 * block's average is read. Null when the file is not a JPEG (a PNG screenshot,
 * a HEIC photo), which the caller hands to the native resizer instead.
 */
export function photoPixels(bytes: Uint8Array): { data: Uint8Array; width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const { decodeJpegEighth, jpegSize, FULL_DECODE_MAX_PIXELS } = require("./jpegdc") as typeof import("./jpegdc");
  const size = jpegSize(bytes);
  if (size && size.width * size.height <= FULL_DECODE_MAX_PIXELS) {
    const full = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
    return { data: full.data, width: full.width, height: full.height };
  }
  return decodeJpegEighth(bytes);
}

async function nativeModelFor(lib: Tflite) {
  nativeModel ??= modelFile()
    .then((url) => lib.loadTensorflowModel({ url }, []))
    .catch((e: unknown) => {
      nativeModel = null;
      throw e;
    });
  return nativeModel;
}

async function runNative(lib: Tflite, input: Uint8Array): Promise<Guess[]> {
  const model = await nativeModelFor(lib);
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

/** The least chance an alternative needs to be offered at all. */
export const MIN_ALTERNATIVE = 0.03;

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
  // A 1% "Chorizo" under a 97% shakshuka is noise, not an alternative: past
  // the best guess, only the ones the model gives a real chance are shown.
  const best = Math.max(0, ...out.map((r) => r.score));
  const likely = out.filter((r) => r.score >= MIN_ALTERNATIVE || r.score === best);
  // A dish the app can count comes before one it can only search for.
  likely.sort((a, b) => (a.food ? 0 : 1) - (b.food ? 0 : 1) || b.score - a.score);
  return likely.slice(0, 5);
}

/**
 * Whether the picker hands the photo over as its JPEG bytes: on every phone,
 * so it is read small (photoPixels) and never decoded at full size. The
 * browser decodes and shrinks pictures itself.
 */
export function needsPhotoData(platform: string): boolean {
  return platform !== "web";
}

export async function recognizePhoto(
  uri: string,
  locale: "he" | "en",
  onStage: OnStage = () => {},
  photoBase64?: string | null,
): Promise<Recognition[]> {
  const lib = tflite();
  let guesses: Guess[] | null = null;

  // 1. The photo's own bytes, read small in JavaScript — no full-size bitmap.
  if (photoBase64) {
    // ~24 MB of JPEG is past any phone photo; refuse rather than risk memory.
    if (photoBase64.length > 32 * 1024 * 1024) throw new Error("photo too large");
    onStage("decode");
    const pixels = photoPixels(base64Bytes(photoBase64));
    if (pixels) {
      if (lib) {
        try {
          onStage("model");
          guesses = await runNative(lib, toRgbBytes(pixels.data, pixels.width, pixels.height));
        } catch {
          guesses = null;
        }
      }
      if (!guesses) {
        onStage("small");
        const { classifyPixels } = require("./foodvision") as typeof import("./foodvision");
        guesses = await classifyPixels(pixels.data, pixels.width, pixels.height, jsModel, 8);
      }
    }
  }

  // 2. Not a JPEG (or no bytes, as in the browser): the native resizer.
  const m = manipulator();
  if (!guesses && lib && m) {
    try {
      guesses = await classifyNative(uri, lib, m, onStage);
    } catch {
      guesses = null;
    }
  }
  if (!guesses && m) {
    onStage("js");
    guesses = await classifyJs(uri, m);
  }
  if (!guesses) throw new Error("unreadable photo");
  return toRecognitions(guesses, locale);
}
