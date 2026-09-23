import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
const out = path.resolve("node_modules/.cache/securestoragetest.mjs");
const empty = path.resolve("node_modules/.cache/empty-module.mjs");
await import("node:fs").then((fs) => fs.writeFileSync(empty, "export const Platform = { OS: 'ios' }; export default {};"));
await build({ entryPoints: ["src/cloud/securestoragetest.ts"], bundle: true, format: "esm",
  platform: "node", outfile: out, logLevel: "warning",
  alias: { "@": path.resolve("src"), "expo-secure-store": path.resolve("src/cloud/fakeSecureStore.ts"),
    "react-native": empty, "@react-native-async-storage/async-storage": empty } });
await import(pathToFileURL(out).href);
