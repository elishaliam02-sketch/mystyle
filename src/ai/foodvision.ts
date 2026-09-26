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

async function ready(source: () => Promise<ModelSource>) {
  if (!loaded) {
    loaded = (async () => {
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

