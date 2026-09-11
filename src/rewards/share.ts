import { fill } from "@/i18n/fill";
import type { Dict } from "@/i18n/dict";
import type { Reward } from "./index";

/**
 * What a score looks like when it leaves the app.
 *
 * A share that says "I scored 1,240!" means nothing to the friend who receives
 * it — they have no scale to read it against, and the sender knows that, which
 * is why most people never press share twice. So the message carries the two
 * things that survive without context: how long this has been kept up, and
 * what was actually done. The number rides along; it is not the point.
 *
 * Pure and tested, because this is the one piece of text in the app that gets
 * read by people who have never seen it: a stray placeholder or an empty line
 * here is a mistake shown to strangers.
 */

export type ShareInput = {
  reward: Pick<Reward, "level" | "points" | "ticks">;
  /** The longest run of days held, across any habit. */
  streakDays: number;
  /** Today's score, 0–100, when there is one worth quoting. */
  dayScore?: number;
  /** Challenges finished, if any. */
  challenges?: number;
  /** The person's name, when they gave one. */
  name?: string;
};

/**
 * Builds the message. Lines are assembled rather than templated whole, so a
 * person with no streak yet does not send a line saying "0 days in a row".
 */
export function shareText(t: Dict, input: ShareInput): string {
  const { reward, streakDays, dayScore, challenges, name } = input;
  const lines: string[] = [];

  lines.push(
    name?.trim()
      ? fill(t.share.headlineNamed, { name: name.trim(), level: reward.level })
      : fill(t.share.headline, { level: reward.level }),
  );

  lines.push(fill(t.share.points, { points: reward.points.toLocaleString() }));

  if (streakDays >= 2) lines.push(fill(t.share.streak, { days: streakDays }));

  const done = reward.ticks.easy + reward.ticks.moderate + reward.ticks.hard;
  if (done > 0) lines.push(fill(t.share.done, { count: done }));

  if (reward.ticks.hard > 0) lines.push(fill(t.share.hard, { count: reward.ticks.hard }));

  if (challenges && challenges > 0) lines.push(fill(t.share.challenges, { count: challenges }));

  if (typeof dayScore === "number" && dayScore > 0) {
    lines.push(fill(t.share.today, { score: dayScore }));
  }

  lines.push("");
  lines.push(t.share.footer);

  return lines.join("\n");
}

/** The subject line, for the share targets that want one (mail, mostly). */
export function shareSubject(t: Dict, level: number): string {
  return fill(t.share.subject, { level });
}
