import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
// Resolved and bundled the way Metro builds the phone app: the "react-native"
// field first, then "main" — never the browser or module builds — so the
// photo scanner is tested against the same TensorFlow.js the phone loads.
const out = path.resolve("node_modules/.cache/visiontest.mjs");
await build({ entryPoints: ["src/ai/visiontest.ts"], bundle: true, format: "esm",
  platform: "browser", mainFields: ["react-native", "main"], outfile: out,
  alias: { "@": path.resolve("src") }, loader: { ".b64": "text", ".tflite": "file" },
  external: ["react-native-fast-tflite", "expo-image-manipulator", "expo-asset"], logLevel: "warning" });
await import(pathToFileURL(out).href);
