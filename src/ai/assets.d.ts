/** Test photos, inlined as base64 text by the vision test runner. */
declare module "*.b64" {
  const text: string;
  export default text;
}
declare module "*.jpg" {
  /** Tests bundle a photo as base64 text (see run-vision-tests.mjs). */
  const base64: string;
  export default base64;
}
