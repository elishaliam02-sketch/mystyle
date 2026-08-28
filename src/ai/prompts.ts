import { askJson, strings, text } from "./client";
import type { SupportContent } from "@/support/types";

const DAY = 86_400_000;

function language(locale: string): string {
  return locale === "he" ? "Hebrew" : "English";
}

/** Shared rules. Weight loss touches health; these are not optional. */
function safety(): string {
  return [
    `Safety rules, non-negotiable:`,
    `- Never give calorie targets, macros, or numeric intake advice.`,
    `- Never give medical or clinical nutrition advice, and never diagnose.`,
    `- Never encourage skipping meals, fasting, purging, or extreme restriction.`,
    `- If the text mentions a medical condition, pregnancy, medication, or signs of`,
    `  disordered eating, keep everything gentle and general, drop any weight talk,`,
    `  and make one line a recommendation to speak with a professional.`,
    `- Never shame the person. They are already doing the hard part.`,
  ].join("\n");
}

// ---------------------------------------------------------------- habit tips

export async function askHabitSupport(
  title: string,
  slot: string | undefined,
  locale: string,
  signal?: AbortSignal,
) {
  const prompt = [
    `You write the guidance inside "MyStyle", an app where people build small daily habits to lose weight.`,
    `A person wrote this habit in their own words: "${title.trim()}"`,
    slot ? `They plan to do it around: ${slot}.` : `They did not fix a time of day.`,
    ``,
    `Read the whole sentence. Respond to what THIS person is actually doing — their setting, their obstacle, their wording. Generic advice that would fit any habit is a failure.`,
    ``,
    `Reply with ONLY this JSON object:`,
    `{"label":"2-3 word topic","why":"one concrete sentence on why this exact habit helps","tips":["5 tips, each doable today, specific to this habit, second person"],"anchors":["4 short existing-routine triggers that fit this habit's moment"],"smaller":["2 smaller versions of this exact habit for hard days"],"meals":[{"slot":"meal name","ideas":["3 simple everyday Israeli-kitchen ideas"]}]}`,
    ``,
    `Include "meals" ONLY if this habit is about food or eating. Otherwise omit the key.`,
    `Write every string in ${language(locale)}. Keep each string under 140 characters — this renders on a phone.`,
    ``,
    safety(),
  ].join("\n");

  return askJson<SupportContent>(prompt, {
    signal,
    tier: "default",
    cacheMs: DAY,
    validate: (raw) => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const label = text(o.label);
      const why = text(o.why);
      const tips = strings(o.tips, 6);
      if (!label || !why || tips.length < 3) return null;

      let meals: SupportContent["meals"];
      if (Array.isArray(o.meals)) {
        const parsed = o.meals
          .map((m) => {
            if (typeof m !== "object" || m === null) return null;
            const meal = m as Record<string, unknown>;
            const slotName = text(meal.slot);
            const ideas = strings(meal.ideas, 5);
            return slotName && ideas.length ? { slot: slotName, ideas } : null;
          })
          .filter((m): m is { slot: string; ideas: string[] } => m !== null);
        if (parsed.length) meals = parsed;
      }

      return {
        label,
        why,
        tips,
        anchors: strings(o.anchors, 5),
        smaller: strings(o.smaller, 3),
        meals,
      };
    },
  });
}

// ----------------------------------------------------------------- daily tip

export type DailyTip = { headline: string; body: string; action?: string };

export async function askDailyTip(
  habits: { title: string; slot?: string; doneToday: boolean }[],
  recentNotes: string[],
  locale: string,
  dayKey: string,
  signal?: AbortSignal,
) {
  const prompt = [
    `You write the daily nudge on the home screen of "MyStyle", a habit app for weight loss.`,
    ``,
    `The person's own habits right now:`,
    ...habits.map(
      (h) =>
        `- "${h.title}"${h.slot ? ` (around ${h.slot})` : ""} — ${h.doneToday ? "already done today" : "not done yet today"}`,
    ),
    recentNotes.length
      ? `\nWhat they wrote in recent evening recaps (most recent first):\n${recentNotes.map((n) => `- "${n}"`).join("\n")}`
      : `\nThey have not written any evening recaps yet.`,
    `\nToday is ${dayKey}.`,
    ``,
    `Write ONE short nudge for today, built on THEIR habits and THEIR own words above. If their recaps show a pattern (a time of day that keeps going wrong, a repeated obstacle), speak to it directly. Never generic.`,
    ``,
    `Reply with ONLY this JSON object:`,
    `{"headline":"up to 6 words","body":"1-2 sentences, concrete, second person","action":"optional single small thing to do today, under 60 characters"}`,
    ``,
    `Write in ${language(locale)}. Warm and direct, never preachy.`,
    ``,
    safety(),
  ].join("\n");

  return askJson<DailyTip>(prompt, {
    signal,
    tier: "default",
    cacheMs: DAY,
    validate: (raw) => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const headline = text(o.headline);
      const body = text(o.body);
      if (!headline || !body) return null;
      const action = text(o.action);
      return { headline, body, action: action || undefined };
    },
  });
}

// ------------------------------------------------------------ evening recap

/** A concrete change to tomorrow that the user accepts with one tap. */
export type Adjustment = {
  kind: "smaller" | "reschedule" | "anchor" | "none";
  habitTitle?: string;
  /** New habit text for "smaller". */
  newTitle?: string;
  /** morning | noon | evening for "reschedule". */
  slot?: string;
  /** The trigger sentence for "anchor". */
  anchor?: string;
  /** One line explaining the change, shown on the accept button's card. */
  reason?: string;
};

export type RecapReply = { reply: string; adjustment: Adjustment };

export async function askRecapReply(
  input: {
    name: string;
    mood: string;
    note: string;
    habits: { title: string; slot?: string; doneToday: boolean }[];
    recentNotes: string[];
  },
  locale: string,
  signal?: AbortSignal,
) {
  const prompt = [
    `You are the evening check-in inside "MyStyle", a habit app for weight loss. The person just finished their day and told you how it went. Answer like someone who has been paying attention to them for weeks — brief, specific, no cheerleading.`,
    ``,
    input.name ? `Their name: ${input.name}` : `They have not given a name.`,
    `How today felt, in their words: "${input.mood}"`,
    input.note ? `What they wrote: "${input.note}"` : `They wrote nothing else.`,
    ``,
    `Their habits today:`,
    ...input.habits.map(
      (h) =>
        `- "${h.title}"${h.slot ? ` (around ${h.slot})` : ""} — ${h.doneToday ? "done" : "not done"}`,
    ),
    input.recentNotes.length
      ? `\nEarlier recaps, most recent first:\n${input.recentNotes.map((n) => `- "${n}"`).join("\n")}`
      : ``,
    ``,
    `Do two things:`,
    `1. Reply in 2-3 sentences. React to what they actually wrote. If earlier recaps show the same thing going wrong repeatedly, name the pattern out loud — that is the whole value.`,
    `2. Propose at most ONE change to tomorrow, and only if it genuinely helps. Choose the kind:`,
    `   - "smaller": the habit is too big right now — give newTitle, a smaller version of the SAME habit`,
    `   - "reschedule": it keeps failing at its current time — give slot as morning, noon or evening`,
    `   - "anchor": it needs to hang off an existing routine — give anchor, a short "after I..." trigger`,
    `   - "none": nothing needs changing tonight. Use this freely; changing things every day is worse than leaving them alone.`,
    `   When proposing a change, habitTitle must copy one of their habit titles above EXACTLY.`,
    ``,
    `Reply with ONLY this JSON object:`,
    `{"reply":"your 2-3 sentences","adjustment":{"kind":"smaller|reschedule|anchor|none","habitTitle":"exact existing title","newTitle":"","slot":"","anchor":"","reason":"one short line on why"}}`,
    ``,
    `Write every string in ${language(locale)}.`,
    ``,
    safety(),
  ].join("\n");

  return askJson<RecapReply>(prompt, {
    signal,
    tier: "default",
    validate: (raw) => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const reply = text(o.reply);
      if (!reply) return null;

      let adjustment: Adjustment = { kind: "none" };
      if (typeof o.adjustment === "object" && o.adjustment !== null) {
        const a = o.adjustment as Record<string, unknown>;
        const kind = text(a.kind);
        if (kind === "smaller" || kind === "reschedule" || kind === "anchor") {
          adjustment = {
            kind,
            habitTitle: text(a.habitTitle) || undefined,
            newTitle: text(a.newTitle) || undefined,
            slot: text(a.slot) || undefined,
            anchor: text(a.anchor) || undefined,
            reason: text(a.reason) || undefined,
          };
        }
      }
      return { reply, adjustment };
    },
  });
}

// -------------------------------------------------------------- week reading

export type WeekInsight = { headline: string; body: string };

export async function askWeekInsight(
  input: {
    consistency: number;
    habits: { title: string; doneDays: number; totalDays: number }[];
    weights: { date: string; kg: number }[];
    recentNotes: string[];
  },
  locale: string,
  dayKey: string,
  signal?: AbortSignal,
) {
  const prompt = [
    `You read the week for someone using "MyStyle", a habit app for weight loss. Tell them what actually happened — one honest observation, not a summary of the numbers they can already see.`,
    ``,
    `Consistency over the last 7 days: ${input.consistency}%`,
    `Per habit:`,
    ...input.habits.map((h) => `- "${h.title}": done ${h.doneDays} of ${h.totalDays} possible days`),
    input.weights.length
      ? `Weigh-ins: ${input.weights.map((w) => `${w.date} ${w.kg}kg`).join(", ")}`
      : `No weigh-ins logged.`,
    input.recentNotes.length
      ? `Recent recap notes, most recent first:\n${input.recentNotes.map((n) => `- "${n}"`).join("\n")}`
      : `No recap notes yet.`,
    `Today is ${dayKey}.`,
    ``,
    `Reply with ONLY this JSON object:`,
    `{"headline":"up to 7 words","body":"2-3 sentences: what the week actually shows, and one thing to try next week"}`,
    ``,
    `Write in ${language(locale)}. If weight barely moved but habits held, say that holding is the win. Never guilt.`,
    ``,
    safety(),
  ].join("\n");

  return askJson<WeekInsight>(prompt, {
    signal,
    tier: "default",
    cacheMs: DAY,
    validate: (raw) => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const headline = text(o.headline);
      const body = text(o.body);
      return headline && body ? { headline, body } : null;
    },
  });
}
