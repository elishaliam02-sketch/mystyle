import type { SupportContent } from "./types";

/**
 * Personalised tips: the user's habit sentence goes to Claude, whole, and the
 * answer comes back in the exact SupportContent shape the screens already
 * render — so AI content and library content are interchangeable.
 *
 * On the published web preview this runs through the viewer's `sample`
 * capability (window.claude). In the native app there is no window.claude, so
 * everything here resolves null and the static library stays — phase 3
 * replaces this transport with our own server without touching the screens.
 */

type SampleFn = ((input: unknown, options?: unknown) => Promise<unknown>) & {
  json?: <T>(input: unknown, options?: unknown) => Promise<T>;
};

async function resolveSample(): Promise<SampleFn | null> {
  const claude = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } })
    .claude;
  if (!claude?.use) return null;
  try {
    const sample = (await claude.use("sample")) as SampleFn | null;
    return sample && typeof sample.json === "function" ? sample : null;
  } catch {
    return null;
  }
}

let cachedSample: Promise<SampleFn | null> | null = null;

/** Resolved once per page load; null everywhere the capability cannot run. */
export function sampleAvailable(): Promise<SampleFn | null> {
  if (!cachedSample) cachedSample = resolveSample();
  return cachedSample;
}

function buildPrompt(title: string, slot: string | undefined, locale: string): string {
  const lang = locale === "he" ? "Hebrew" : "English";
  return [
    `You are the tips engine inside "MyStyle", a daily-routine app that helps people lose weight by building small habits.`,
    `A user wrote this habit for themselves, in their own words: "${title.trim()}"`,
    slot ? `They plan to do it around: ${slot}.` : `They did not fix a time of day.`,
    ``,
    `Read the whole sentence and understand what this specific person is actually trying to do — respond to their exact wording, not to a generic category.`,
    ``,
    `Reply with ONLY a JSON object in this shape:`,
    `{`,
    `  "label": "short topic name, 2-3 words",`,
    `  "why": "one concrete sentence on why this exact habit helps — no clichés",`,
    `  "tips": ["5 practical tips tailored to this exact habit. Each must be doable today, concrete, second person. No moralizing, no generic advice that fits any habit."],`,
    `  "anchors": ["4 short 'after I...' triggers that fit this habit's natural moment in a day"],`,
    `  "smaller": ["2 smaller versions of this exact habit, for hard days"],`,
    `  "meals": [{"slot": "meal name", "ideas": ["3 simple ideas with everyday Israeli ingredients"]}]`,
    `}`,
    ``,
    `Include "meals" ONLY if the habit is about food or eating; otherwise omit the key entirely.`,
    `Write every string in ${lang}.`,
    `Safety rules, non-negotiable: no medical or nutritional advice for medical conditions. If the habit mentions a medical condition, pregnancy, medication, or disordered eating, keep the tips gentle and general and make one tip a recommendation to talk to a professional. Never give calorie numbers, never encourage skipping meals or extreme restriction.`,
    `Keep every string short — this renders on a phone screen.`,
  ].join("\n");
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, max);
}

function validate(raw: unknown): SupportContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  const why = typeof obj.why === "string" ? obj.why.trim() : "";
  const tips = asStringArray(obj.tips, 6);
  const anchors = asStringArray(obj.anchors, 5);
  const smaller = asStringArray(obj.smaller, 3);
  if (!label || !why || tips.length < 3) return null;

  let meals: SupportContent["meals"];
  if (Array.isArray(obj.meals)) {
    const parsed = obj.meals
      .map((m) => {
        if (typeof m !== "object" || m === null) return null;
        const meal = m as Record<string, unknown>;
        const slot = typeof meal.slot === "string" ? meal.slot.trim() : "";
        const ideas = asStringArray(meal.ideas, 5);
        return slot && ideas.length > 0 ? { slot, ideas } : null;
      })
      .filter((m): m is { slot: string; ideas: string[] } => m !== null);
    if (parsed.length > 0) meals = parsed;
  }

  return { label, why, tips, anchors, smaller, meals };
}

/**
 * Ask Claude for tips written for this exact habit. Resolves null wherever
 * that cannot happen (no capability, declined consent, bad answer, aborted) —
 * callers keep the static library in that case and show nothing scary.
 */
export async function fetchAiSupport(
  title: string,
  slot: string | undefined,
  locale: string,
  signal?: AbortSignal,
): Promise<SupportContent | null> {
  const sample = await sampleAvailable();
  if (!sample?.json || signal?.aborted) return null;

  try {
    const raw = await sample.json(buildPrompt(title, slot, locale), {
      modelTier: "quick",
      signal,
      // A habit's tips can be replayed all day; a changed title is a new input.
      cache: { gcTime: 86_400_000 },
    });
    return validate(raw);
  } catch {
    // Every rejection — declined consent, rate limit, refusal, bad JSON —
    // means the same thing to the screen: fall back to the library, silently.
    return null;
  }
}
