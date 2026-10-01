import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
const out = path.resolve("node_modules/.cache/photofuzztest.mjs");
await build({ entryPoints: ["src/ai/photofuzztest.ts"], bundle: true, format: "esm",
  platform: "browser", mainFields: ["react-native", "main"], outfile: out,
  alias: { "@": path.resolve("src") }, loader: { ".tflite": "file" },
  external: ["react-native-fast-tflite", "expo-image-manipulator", "expo-asset", "expo-file-system", "expo-file-system/legacy"], logLevel: "warning" });
await import(pathToFileURL(out).href);
