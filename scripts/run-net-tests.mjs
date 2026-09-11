import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
const out = path.resolve("node_modules/.cache/nettest.mjs");
await build({ entryPoints: ["src/net/nettest.ts"], bundle: true, format: "esm",
  platform: "node", outfile: out, alias: { "@": path.resolve("src") },
  // The hook half of the module imports React Native; the suite only touches
  // the pure probe, so the runtime is stubbed rather than bundled.
  plugins: [{
    name: "stub-react-native",
    setup(b) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: "react-native", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: `export const Platform = { OS: "ios" };
                   export const Linking = { openSettings: async () => {}, sendIntent: async () => {} };
                   export const AppState = { addEventListener: () => ({ remove() {} }) };`,
        loader: "js",
      }));
    },
  }],
  logLevel: "warning" });
await import(pathToFileURL(out).href);
