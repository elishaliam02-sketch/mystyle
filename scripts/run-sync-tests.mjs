// Bundles the merge tests (TypeScript, "@/" alias) and runs them in Node.
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";

const out = path.resolve("node_modules/.cache/synctest.mjs");
await build({
  entryPoints: ["src/cloud/synctest.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": path.resolve("src") },
  logLevel: "warning",
});
await import(pathToFileURL(out).href);
