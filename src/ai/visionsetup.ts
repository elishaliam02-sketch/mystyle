/**
 * React Native's globals, set before anything else loads, for ./visiontest.ts:
 * `window` is the global object, `process` carries only `env` (no
 * `versions`), there is no `document`, and `navigator.product` is
 * "ReactNative". TensorFlow.js decides what it is running on from exactly
 * these — which is how the photo scanner broke on phones while passing every
 * test in Node and in the browser.
 */
const g = globalThis as Record<string, unknown>;
g.window = g;
g.self = g;
Object.defineProperty(g, "process", { value: { env: { NODE_ENV: "production" } }, configurable: true, writable: true });
Object.defineProperty(g, "navigator", { value: { product: "ReactNative" }, configurable: true, writable: true });
export {};
