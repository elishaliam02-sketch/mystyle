/**
 * The photo scanner, run the way the phone runs it.
 *
 * ./visionsetup.ts gives this process React Native's globals, and the runner
 * resolves packages the way Metro does (the "react-native" field, then
 * "main") — so TensorFlow.js sees what it sees on a phone. Under those
 * conditions it used to fail on every photo ("Cannot read properties of
 * undefined (reading 'isTypedArray')"), because it registers a platform only
 * for a browser or for Node. This suite is what would have caught that.
 */
import "./visionsetup";
import { classifyJpeg } from "./foodvision";
import * as data from "./foodModelData";
import { base64Bytes, dequantize, SIDE, toRgbBytes } from "./foodvisionpure";
import { jpegToModelInput, toRecognitions } from "./recognize";
import { FOOD_LABELS } from "./foodLabelNames";
import SHAKSHUKA from "./testdata/shakshuka192.b64";
import OMELETTE from "./testdata/omelette192.b64";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const source = async () => {
  const bytes = base64Bytes(data.WEIGHTS_B64);
  return {
    modelJson: data.MODEL_JSON as never,
    weights: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    labels: data.LABELS,
  };
};

(async () => {
  check("the environment looks like React Native (no document, no process.versions)",
    typeof (globalThis as { document?: unknown }).document === "undefined" &&
      typeof (globalThis as { process: { versions?: unknown } }).process.versions === "undefined");

  // 1. The JavaScript engine (older installs) recognises real dishes.
  try {
    const s = await classifyJpeg(SHAKSHUKA, source, 3);
    check("a shakshuka photo is read as shakshouka", s[0]?.label === "Shakshouka", JSON.stringify(s));
    const o = await classifyJpeg(OMELETTE, source, 3);
    check("an omelette photo is read as an omelette", o[0]?.label === "Omelette", JSON.stringify(o));
  } catch (e) {
    check("the classifier runs under React Native's globals", false, String(e));
  }

  // 2. What the native (TensorFlow Lite) engine is fed.
  const input = jpegToModelInput(SHAKSHUKA);
  check("the native input is 192 × 192 RGB bytes", input.length === SIDE * SIDE * 3 && input instanceof Uint8Array, String(input.length));
  const mean = input.reduce((a, b) => a + b, 0) / input.length;
  check("and holds the picture, not a blank", mean > 40 && mean < 220, String(mean));
  const white = toRgbBytes(new Uint8Array(4 * 4 * 4).fill(255), 4, 4);
  check("white stays 255 in bytes", white[0] === 255 && white[white.length - 1] === 255);
  const p = dequantize([0, 128, 255], 1 / 256, 0);
  check("quantised scores come back as probabilities", Math.abs(p[1]! - 0.5) < 1e-6 && p[2]! < 1, String(Array.from(p)));
  check("the label list is the model's 2,024 outputs", FOOD_LABELS.length === 2024 && FOOD_LABELS[0] === "__background__");

  // 3. What the person sees: Hebrew names of the app's own foods, look-alikes merged.
  const seen = toRecognitions(
    [
      { label: "Shakshouka", score: 0.55 },
      { label: "Huevos rancheros", score: 0.37 },
      { label: "Ceviche", score: 0.05 },
    ],
    "he",
  );
  check("look-alikes of one dish are merged into it", seen[0]?.food?.id === "shakshukaDish" && Math.abs(seen[0].score - 0.92) < 1e-6, JSON.stringify(seen));
  check("and it is named in Hebrew", seen[0]?.name === "שקשוקה", seen[0]?.name);
  const salad = toRecognitions([{ label: "Ceviche", score: 0.3 }, { label: "Fattoush", score: 0.22 }], "he");
  check("a dish the app can count comes before one it can only search", salad[0]?.food?.id === "israeliSalad", JSON.stringify(salad));

  const noisy = toRecognitions(
    [
      { label: "Shakshouka", score: 0.97 },
      { label: "Chorizo", score: 0.01 },
      { label: "Piperade", score: 0.008 },
      { label: "Hummus", score: 0.004 },
    ],
    "he",
  );
  check("1% alternatives under a sure guess are not offered", noisy.length === 1 && noisy[0]?.food?.id === "shakshukaDish", JSON.stringify(noisy));
  const unsure = toRecognitions([{ label: "Chorizo", score: 0.02 }, { label: "Paella", score: 0.015 }], "he");
  check("an unsure photo still gets its best guess", unsure.length === 1 && unsure[0]?.label === "Chorizo", JSON.stringify(unsure));

  const failed = results.filter(([, ok]) => !ok);
  for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
})();
