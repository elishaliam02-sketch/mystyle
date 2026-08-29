/**
 * Substitutes {token}s in a template string. Kept free of any React Native or
 * Expo import so pure logic — the insight layer, the tests — can use it in
 * plain Node without dragging the whole UI runtime in behind it.
 */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
