/**
 * Reading a meal photo's analysis back safely.
 *
 * A model's answer is text from the internet: it can be malformed, wrapped in
 * a code fence, missing fields, or carry numbers that would poison the food
 * diary (a million calories, a negative gram count, a name a mile long). None
 * of that may reach the store, so everything the model says is parsed and
 * clamped here first, and anything that cannot be trusted is refused outright.
 *
 * Pure: no network, no clock. The photo flow is only as good as this file, so
 * this is the part that is tested hardest.
 */

/** One recognised item on the plate. */
export type MealItem = {
  label: string;
  grams: number;
  kcal: number;
  protein: number;
};

export type MealAnalysis = {
  items: MealItem[];
  /** Totals across the plate, recomputed here rather than trusted. */
  kcal: number;
  protein: number;
  /** How sure the model said it was, 0..1, clamped. */
  confidence: number;
};

/** A plate cannot sanely exceed these; anything past them is a bad read. */
export const MAX_ITEM_KCAL = 5_000;
export const MAX_ITEM_PROTEIN = 500;
export const MAX_ITEM_GRAMS = 5_000;
export const MAX_ITEMS = 12;
export const MAX_LABEL = 60;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

/**
 * Pulls the JSON object out of a model reply, tolerating a ```json fence or a
 * sentence either side of it. Returns null when there is nothing parseable.
 */
export function extractJson(raw: string): unknown {
  if (typeof raw !== "string") return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validates a meal analysis. Returns null when the reply is unusable — the
 * screen then says it could not read the photo rather than logging nonsense.
 */
export function parseMealAnalysis(raw: string): MealAnalysis | null {
  const obj = extractJson(raw);
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;

  const rawItems = Array.isArray(o.items) ? o.items : null;
  if (!rawItems || rawItems.length === 0) return null;

  const items: MealItem[] = [];
  for (const entry of rawItems.slice(0, MAX_ITEMS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const label = typeof e.label === "string" ? e.label.trim().slice(0, MAX_LABEL) : "";
    const kcal = num(e.kcal);
    const protein = num(e.protein);
    const grams = num(e.grams);
    // A nameless item, or one with no calories at all, is not a reading.
    if (!label || kcal === null) continue;
    items.push({
      label,
      grams: clamp(grams ?? 0, MAX_ITEM_GRAMS),
      kcal: clamp(kcal, MAX_ITEM_KCAL),
      protein: clamp(protein ?? 0, MAX_ITEM_PROTEIN),
    });
  }
  if (items.length === 0) return null;

  // Totals are recomputed from the items, never taken from the model — that way
  // the number on screen always matches the list the person can see and edit.
  const kcal = items.reduce((n, i) => n + i.kcal, 0);
  const protein = items.reduce((n, i) => n + i.protein, 0);
  if (kcal <= 0) return null;

  const c = num(o.confidence);
  const confidence = c === null ? 0.5 : Math.max(0, Math.min(1, c > 1 ? c / 100 : c));

  return { items, kcal, protein, confidence };
}

/** A single label for the diary line, from the items the model found. */
export function mealLabel(analysis: MealAnalysis, fallback: string): string {
  const names = analysis.items.map((i) => i.label).filter(Boolean);
  if (names.length === 0) return fallback;
  const joined = names.slice(0, 3).join(", ");
  return joined.slice(0, MAX_LABEL);
}

/** What the model is asked for. Kept here so the prompt and the parser agree. */
export function mealPhotoPrompt(locale: string): string {
  const lang = locale === "he" ? "Hebrew" : "English";
  return [
    `You are looking at a photograph of a meal.`,
    `Identify each distinct food on the plate and estimate its portion.`,
    `Estimate conservatively: if you cannot tell whether something was fried or how much oil or sauce is on it, assume a normal home-cooked amount.`,
    ``,
    `Reply with ONLY this JSON object and nothing else:`,
    `{"items":[{"label":"food name","grams":0,"kcal":0,"protein":0}],"confidence":0.0}`,
    ``,
    `- "label" must be written in ${lang}, 1-3 words.`,
    `- "grams" is the estimated edible weight of that item.`,
    `- "kcal" and "protein" are for that item's portion, not per 100g.`,
    `- "confidence" is 0 to 1: how sure you are overall.`,
    `- If the picture is not food at all, reply {"items":[],"confidence":0}.`,
  ].join("\n");
}
