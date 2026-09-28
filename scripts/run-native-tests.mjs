// Every install since the first build (3 September) takes over-the-air
// updates, so an update may only import at load time the native modules those
// builds carry. A newer one imported at the top of any file crashes the whole
// update on launch on older phones, which then fall back to their old version
// and look like they never update. Newer modules are loaded where used, with a
// fallback (src/native/optional.ts, src/ai/recognize.ts).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Native modules in the first installable build (package.json at 811871d).
const IN_EVERY_BUILD = new Set([
  "@react-native-async-storage/async-storage", "expo-constants", "expo-font", "expo-linear-gradient",
  "expo-linking", "expo-localization", "expo-notifications", "expo-router", "expo-secure-store",
  "expo-splash-screen", "expo-status-bar", "expo-system-ui", "expo-updates", "react-native",
  "react-native-gesture-handler", "react-native-reanimated", "react-native-safe-area-context",
  "react-native-screens", "react-native-svg", "react-native-url-polyfill", "react-native-worklets",
  // part of expo itself in every build
  "expo-asset", "expo-modules-core", "expo",
]);
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const native = Object.keys(pkg.dependencies).filter(
  (d) => /^(expo-|react-native|@react-native)/.test(d) && d !== "react-native-web" && !IN_EVERY_BUILD.has(d),
);

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "testing" && e.name !== "node_modules") yield* files(p);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/test\.ts$/.test(e.name) && !e.name.endsWith(".d.ts")) yield p;
  }
}

const bad = [];
for (const root of ["app", "src"]) {
  for await (const f of files(root)) {
    const src = await readFile(f, "utf8");
    for (const m of src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"([^"]+)";?/gm)) {
      const mod = m[1];
      const hit = native.find((n) => mod === n || mod.startsWith(`${n}/`));
      if (hit) bad.push(`${f}: ${mod}`);
    }
  }
}
const ok = bad.length === 0;
console.log(`${ok ? "PASS" : "FAIL"}  no file imports at load time a native module older installs lack (${native.join(", ")})`);
for (const b of bad) console.log(`   ${b}`);
console.log(`\n${ok ? 1 : 0}/1 passed`);
if (!ok) process.exitCode = 1;
