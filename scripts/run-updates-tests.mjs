// The automatic updater (src/updates) against stand-ins for expo-updates,
// React Native and storage: each scenario loads a fresh copy of the module.
import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";

const out = path.resolve("node_modules/.cache/updates-under-test.cjs");
const stub = (name, expr) => ({
  name,
  setup(b) {
    b.onResolve({ filter: new RegExp(`^${name.replace(/[/.-]/g, "\\$&")}$`) }, () => ({ path: name, namespace: "stub" }));
    b.onLoad({ filter: new RegExp(`^${name.replace(/[/.-]/g, "\\$&")}$`), namespace: "stub" }, () => ({
      contents: expr,
      resolveDir: path.resolve("src/updates/testing"),
      loader: "ts",
    }));
  },
});
await build({
  entryPoints: ["src/updates/index.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: out,
  alias: { "@": path.resolve("src") },
  external: ["react"],
  logLevel: "warning",
  plugins: [
    stub("expo-updates", `import { Updates } from "./mocks"; export = Updates;`),
    stub("react-native", `import { ReactNative } from "./mocks"; export = ReactNative;`),
    stub("expo-constants", `export default { expoConfig: { version: "0.1.0" } };`),
    stub("@react-native-async-storage/async-storage", `import { AsyncStorage } from "./mocks"; export default AsyncStorage;`),
  ],
});
const require = createRequire(import.meta.url);
globalThis.__loadUpdates = () => {
  delete require.cache[out];
  return require(out);
};

const testOut = path.resolve("node_modules/.cache/updatestest.cjs");
await build({ entryPoints: ["src/updates/updatestest.ts"], bundle: true, format: "cjs", platform: "node", outfile: testOut, logLevel: "warning" });
require(testOut);
