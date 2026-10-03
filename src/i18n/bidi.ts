/**
 * Number ranges inside Hebrew text.
 *
 * "8–12" with an en dash reads backwards in a right-to-left line: the dash is
 * a neutral character, takes the direction of the Hebrew around it, and the
 * two numbers swap — the screen showed "12–8 חזרות" and "טווח בריא: 76–52".
 * Wrapping the range in a left-to-right isolate (LRI … PDI) keeps it in the
 * order it was written, without touching the text around it. English lines
 * are left alone, and a range already isolated is not wrapped twice.
 *
 * Pure: no React Native, so tests and the insight layer can use it.
 */
const LRI = "⁦";
const PDI = "⁩";
const HEBREW = /[֐-׿]/;
const RANGE = /(\d[\d.,:]*)(\s?[–—]\s?)(\d[\d.,:]*)/g;

export function isolateRanges(s: string): string {
  if (!s || !HEBREW.test(s) || !s.includes("–") && !s.includes("—")) return s;
  return s.replace(RANGE, (match: string, a: string, _dash: string, b: string, offset: number, all: string) =>
    all[offset - 1] === LRI ? match : `${LRI}${a}–${b}${PDI}`,
  );
}

/** The same, through every string of a nested object (a dictionary, a recipe). */
export function isolateDeep<T>(value: T): T {
  if (typeof value === "string") return isolateRanges(value) as T;
  if (Array.isArray(value)) return value.map((v) => isolateDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = isolateDeep(v);
    return out as T;
  }
  return value;
}
