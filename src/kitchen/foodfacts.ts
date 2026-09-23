/**
 * Looking up a food the library does not know, in Open Food Facts.
 *
 * The library holds ~130 foods with real per-100 g figures; a person eats more
 * than that — a brand of hummus, a protein bar, a particular yogurt. Open Food
 * Facts (https://world.openfoodfacts.org) is a free, open database of packaged
 * foods, with many Israeli products and Hebrew names, readable without an API
 * key. Its data is published under the Open Database License, which is why the
 * screen names it wherever a figure came from it.
 *
 * What leaves the phone: only the words the person typed into the food search,
 * and only when they press the button that says it searches Open Food Facts —
 * that press is the consent, per search. Nothing about the person is sent. The
 * privacy policy names the service and its host (`npm run test:legal` checks).
 *
 * The parser is pure and is where the care is: an open database is edited by
 * volunteers, so a product can have no calories, calories only in kJ, or a
 * number no food could have. Every row is converted, clamped, and dropped if it
 * cannot be trusted — a lookup that returns nothing is better than one that
 * writes 9,000 kcal into someone's diary.
 */
import { adhocFood, type Food } from "./data";
import type { Per100 } from "./nutrition";

export const FOOD_FACTS_HOSTS = ["world.openfoodfacts.org"] as const;

const SEARCH = `https://${FOOD_FACTS_HOSTS[0]}/cgi/search.pl`;

/** One product found. */
export type FactHit = {
  code: string;
  name: string;
  brand: string;
  per100: Per100;
};

const MAX_HITS = 8;
const KJ_PER_KCAL = 4.184;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const clampMacro = (n: number | null) => round1(Math.min(100, Math.max(0, n ?? 0)));

/**
 * Reads a search reply into trustworthy hits. `locale` picks the Hebrew name
 * when the product has one. Pure: no network.
 */
export function parseFoodFacts(data: unknown, locale: "he" | "en"): FactHit[] {
  if (!data || typeof data !== "object") return [];
  const products = (data as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];

  const out: FactHit[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const row = p as Record<string, unknown>;
    const nutr = (row.nutriments ?? {}) as Record<string, unknown>;

    // Calories: the kcal field when present, otherwise the energy field, which
    // Open Food Facts stores in kJ.
    let kcal = num(nutr["energy-kcal_100g"]);
    if (kcal === null) {
      const kj = num(nutr["energy_100g"]);
      kcal = kj === null ? null : kj / KJ_PER_KCAL;
    }
    // No calories, or an impossible density, is not a reading.
    if (kcal === null || kcal < 0 || kcal > 900) continue;

    const heName = typeof row.product_name_he === "string" ? row.product_name_he.trim() : "";
    const anyName = typeof row.product_name === "string" ? row.product_name.trim() : "";
    const name = (locale === "he" && heName ? heName : anyName || heName).slice(0, 60);
    if (!name) continue;

    const brand =
      typeof row.brands === "string" ? row.brands.split(",")[0]!.trim().slice(0, 40) : "";
    const code = typeof row.code === "string" && row.code ? row.code : `${name}|${brand}`;

    const key = `${name.toLowerCase()}|${brand.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      code,
      name,
      brand,
      per100: {
        kcal: Math.round(kcal),
        protein: clampMacro(num(nutr["proteins_100g"])),
        carbs: clampMacro(num(nutr["carbohydrates_100g"])),
        fat: clampMacro(num(nutr["fat_100g"])),
      },
    });
    if (out.length >= MAX_HITS) break;
  }
  return out;
}

/** A found product, as a food the calculator can put on a plate. */
export function foodFromFact(hit: FactHit): Food {
  const label = hit.brand ? `${hit.name} · ${hit.brand}` : hit.name;
  return {
    ...adhocFood(label.slice(0, 60)),
    id: `off:${hit.code}`,
    n: hit.per100,
    src: "off",
  };
}

/**
 * Asks Open Food Facts. Returns null when the service cannot be reached or
 * answers with something unusable — the screen then falls back to adding the
 * food by category, so a failed lookup never blocks logging a meal.
 */
export async function searchFoodFacts(
  query: string,
  locale: "he" | "en",
  timeoutMs = 9000,
): Promise<FactHit[] | null> {
  const q = query.trim().slice(0, 60);
  if (!q) return [];
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: "code,product_name,product_name_he,brands,nutriments",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SEARCH}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) return null;
    return parseFoodFacts(await res.json(), locale);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
