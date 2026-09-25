import { fill } from "@/i18n/fill";
import type { Dict } from "@/i18n/dict";

/**
 * Insights the device computes for itself.
 *
 * The weekly reading and the evening reply were built to be written by Claude,
 * but the server that does that is not connected yet — and until it is, those
 * two cards showed an apology and nothing else. That reads as a broken feature.
 *
 * So the app writes an honest version itself, from numbers it already has. It
 * is not as warm as a model's, and it does not remember yesterday, but it is
 * true and it is specific to the person reading it. When the server arrives it
 * enriches this; it does not replace something empty.
 *
 * Pure functions, no React and no network, so the copy can be tested directly.
 */

type Insight = Dict["insight"];

export type HabitWeek = { title: string; doneDays: number; totalDays: number };
export type Weight = { date: string; kg: number };

export type WeekReading = { headline: string; body: string };

export function weekReading(
  data: { consistency: number; habits: HabitWeek[]; weights: Weight[]; goal?: string },
  d: Insight,
): WeekReading {
  const { consistency, habits, weights } = data;

  const headline =
    habits.length === 0
      ? d.weekEmpty
      : consistency >= 0.8
        ? d.weekStrong
        : consistency >= 0.5
          ? d.weekSteady
          : consistency > 0
            ? d.weekStart
            : d.weekEmpty;

  const lines: string[] = [];

  // The habit that held best, named, so the reading is about this person and
  // not a generic pep talk. Only counts habits that had days to be judged on.
  const judged = habits.filter((h) => h.totalDays > 0);
  const rate = (h: HabitWeek) => h.doneDays / h.totalDays;
  const best = judged.slice().sort((a, b) => rate(b) - rate(a))[0];
  if (best && best.doneDays > 0) {
    lines.push(fill(d.weekBest, { habit: best.title, done: best.doneDays, total: best.totalDays }));
  }

  // A habit clearly lagging the others is worth naming once, as an offer to
  // shrink it — the app's whole theory is that smaller is what sticks. Only
  // when there is a healthier habit to contrast it with, so this never fires
  // on someone whose single habit is simply new.
  const worst = judged.slice().sort((a, b) => rate(a) - rate(b))[0];
  if (worst && best && worst !== best && rate(worst) < 0.4 && rate(best) >= 0.5) {
    lines.push(fill(d.weekStruggle, { habit: worst.title }));
  }

  // The scale, read the way the app asks the user to read it: as a trend, not
  // a verdict on one morning.
  if (weights.length >= 2) {
    const sorted = weights.slice().sort((a, b) => a.date.localeCompare(b.date));
    const delta = sorted[0].kg - sorted[sorted.length - 1].kg; // positive = lost
    const kg = Math.abs(Math.round(delta * 10) / 10);
    // On a bulk the gain is the point: it is praised, and a loss is the
    // thing to fix — not the other way round.
    if (data.goal === "bulk") {
      if (delta <= -0.3) lines.push(fill(d.weekWeightUpBulk, { kg }));
      else if (delta >= 0.3) lines.push(fill(d.weekWeightDownBulk, { kg }));
      else lines.push(d.weekWeightFlat);
    } else if (delta >= 0.3) lines.push(fill(d.weekWeightDown, { kg }));
    else if (delta <= -0.3) lines.push(d.weekWeightUp);
    else lines.push(d.weekWeightFlat);
  }

  lines.push(
    consistency >= 0.8
      ? d.weekCloseStrong
      : consistency >= 0.5
        ? d.weekCloseSteady
        : consistency > 0
          ? d.weekCloseStart
          : d.weekCloseEmpty,
  );

  return { headline, body: lines.join(" ") };
}

export type RecapReply = { reply: string };

export function recapReply(
  data: { name: string; mood: "good" | "ok" | "hard"; doneCount: number; total: number },
  d: Insight,
): RecapReply {
  const { mood, doneCount, total } = data;
  const name = data.name.trim() || nameFallback(d);

  let reply: string;
  if (mood === "hard") {
    reply = fill(d.recapHard, { name });
  } else if (mood === "good") {
    reply =
      total > 0 && doneCount >= total
        ? fill(d.recapGoodAll, { name })
        : fill(d.recapGoodSome, { name, done: doneCount, total });
  } else {
    reply =
      doneCount > 0
        ? fill(d.recapOkSome, { done: doneCount, total })
        : d.recapOkNone;
  }

  // A gentle, general nudge on a day where a fair chunk was missed — the same
  // "make it smaller" idea the suggestion card would carry, offered in words
  // rather than as an automatic change.
  if (mood !== "good" && total >= 2 && doneCount <= Math.floor(total / 2)) {
    reply = `${reply} ${d.recapNudge}`;
  }

  return { reply };
}

/** The reply reads better with a name; when there isn't one, this stands in. */
function nameFallback(d: Insight): string {
  // recapOkNone carries no name token, so any neutral address works; the
  // Hebrew and English "you"-ish openers are already inside the templates, so
  // an empty name simply drops the vocative. Return empty to do exactly that.
  void d;
  return "";
}
