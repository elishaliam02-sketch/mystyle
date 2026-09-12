import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
const out = path.resolve("node_modules/.cache/phototest.mjs");
await build({
  entryPoints: ["src/kitchen/phototest.ts"],
  bundle: true, format: "esm", platform: "node", outfile: out,
  alias: { "@": path.resolve("src") }, logLevel: "warning",
});
await import(pathToFileURL(out).href);
