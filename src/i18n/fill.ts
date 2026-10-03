/**
 * Substitutes {token}s in a template string. Kept free of any React Native or
 * Expo import so pure logic — the insight layer, the tests — can use it in
 * plain Node without dragging the whole UI runtime in behind it.
 */
import { isolateRanges } from "./bidi";

export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  // A range made by the template ("{min}–{max}") only exists once filled, so
  // it is kept in reading order here (see ./bidi).
  return isolateRanges(
    template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)),
  );
}
