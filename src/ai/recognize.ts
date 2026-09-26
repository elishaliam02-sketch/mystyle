/**
 * The phone side of recognising a meal photo: shrink the picture, run the
 * on-device classifier (./foodvision.ts), and say which of the app's own foods
 * each guess is — so a tap opens the calculator with real nutrition.
 */
import { base64Bytes, type Guess } from "./foodvisionpure";
import { labelToFood } from "./foodlabels";
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

export type Recognition = Guess & { food: Food | null; name: string };

let data: typeof import("./foodModelData") | null = null;

export async function recognizePhoto(
  uri: string,
  fullBase64: string | null,
  locale: "he" | "en",
): Promise<Recognition[]> {
  let b64 = fullBase64;
  const m = manipulator();
  if (m) {
    const small = await m.manipulateAsync(uri, [{ resize: { width: 320 } }], {
      base64: true,
      compress: 0.85,
      format: m.SaveFormat.JPEG,
    });
    b64 = small.base64 ?? b64;
  }
  if (!b64) throw new Error("no image data");
  // TensorFlow is loaded the first time a photo is read, never at app start:
  // nothing about it can slow or break opening the app.
  const { classifyJpeg } = require("./foodvision") as typeof import("./foodvision");
  const guesses = await classifyJpeg(b64, async () => {
    data ??= require("./foodModelData") as typeof import("./foodModelData");
    const bytes = base64Bytes(data.WEIGHTS_B64);
    return {
      modelJson: data.MODEL_JSON as never,
      weights: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      labels: data.LABELS,
    };
  }, 8);
  // Several labels can land on one library food ("Hummus", "Hummus with
  // pine nuts"); the best-scoring one stands for it.
  const seen = new Set<string>();
  const out: Recognition[] = [];
  for (const g of guesses) {
    const food = labelToFood(g.label);
    const key = food ? food.id : g.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...g, food, name: food ? (locale === "he" ? food.he : food.en) : g.label });
    if (out.length >= 5) break;
  }
  return out;
}
