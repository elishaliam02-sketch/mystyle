/**
 * Opening the *exact* demonstration video for an exercise, not a search page.
 *
 * The app has no YouTube API key and no bundled list of video ids — a hard-coded
 * id rots the day the uploader takes the clip down, and a wrong one is worse
 * than a search. So the id is resolved on the phone, once per exercise, from
 * YouTube's own search results page: the markup carries `"videoId":"…"` for
 * each hit, and the first one is the top result — the video the search page
 * would have made the person tap anyway.
 *
 * Everything here degrades rather than breaks. No network, a changed page
 * shape, a consent interstitial: the search URL opens instead, which is exactly
 * what the app did before. Once resolved, the id is remembered, so the second
 * tap is instant and offline.
 */
import type { Exercise } from "./exercises";

/** A YouTube video id: 11 characters of the URL-safe alphabet. */
const ID = /^[A-Za-z0-9_-]{11}$/;

/** The search page for an exercise — the fallback, and what we scrape. */
export function searchUrl(ex: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.yt)}`;
}

/** The watch page for one specific video. */
export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function isVideoId(id: string): boolean {
  return ID.test(id);
}

/**
 * The top result's video id from a YouTube search page.
 *
 * Deliberately a regex over the raw HTML rather than a JSON parse: the page
 * ships one enormous `ytInitialData` blob whose shape changes without notice,
 * while `"videoId":"…"` has been stable for years and is trivially testable.
 * Returns null rather than guessing when nothing matches.
 */
export function firstVideoId(html: string): string | null {
  const m = /"videoId":"([A-Za-z0-9_-]{11})"/.exec(html);
  return m ? m[1]! : null;
}

export type Hit = { id: string; title: string };

/**
 * Every result on the page, paired with its title.
 *
 * The first `videoId` on a YouTube search page is not always the exercise: it
 * can be an ad, a Short, or a "people also watched" shelf. Reading the titles
 * lets the caller pick the result that is actually about the movement, which
 * is the difference between "opens a video" and "opens *the* video".
 */
export function searchHits(html: string): Hit[] {
  const out: Hit[] = [];
  const re = /"videoId":"([A-Za-z0-9_-]{11})"(.*?)"(?:title|headline)":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
  for (;;) {
    const m = re.exec(html);
    if (!m) break;
    out.push({ id: m[1]!, title: unescapeJson(m[3]!) });
  }
  return out;
}

function unescapeJson(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** Words too common to tell one exercise's video from another's. */
const NOISE = new Set([
  "the", "a", "an", "and", "with", "for", "to", "of", "how", "form", "proper",
  "exercise", "tutorial", "guide", "workout", "your", "in", "on", "do",
]);

/** The words that actually identify this movement, from its English name. */
export function keyWords(ex: Exercise): string[] {
  const words = `${ex.en} ${ex.yt}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NOISE.has(w));
  const long = words.filter((w) => w.length > 2);
  // "V-up" is entirely short words. Dropping them would leave nothing to match
  // on and send the button to whatever sat at the top of the page.
  return long.length > 0 ? [...new Set(long)] : [...new Set(words)];
}

/**
 * The best result for this exercise: the highest-placed one whose title names
 * the movement. Falls back to the top result — a video about roughly the right
 * thing beats no video — and to null when the page yielded nothing at all.
 */
export function bestHit(html: string, ex: Exercise): string | null {
  const hits = searchHits(html);
  if (hits.length === 0) return firstVideoId(html);
  const words = keyWords(ex);
  if (words.length === 0) return hits[0]!.id;
  let best: { id: string; score: number } | null = null;
  hits.forEach((hit, rank) => {
    const title = hit.title.toLowerCase();
    const matched = words.filter((w) => title.includes(w)).length;
    if (matched === 0) return;
    // How much of the name the title carries, minus a small penalty for
    // sitting further down the page, so a perfect match at rank 4 still beats
    // a half match at rank 1.
    const score = matched / words.length - rank * 0.02;
    if (!best || score > best.score) best = { id: hit.id, score };
  });
  return best ? (best as { id: string }).id : hits[0]!.id;
}

/**
 * The pages worth asking, in order. The desktop results page is the richest;
 * the mobile one is a different renderer that has survived changes the desktop
 * one did not, and it is smaller to download. Trying both is the whole
 * "workaround" — there is no public API to ask without a key.
 */
export function searchUrls(ex: Exercise): string[] {
  const q = encodeURIComponent(ex.yt);
  return [
    `https://www.youtube.com/results?search_query=${q}`,
    `https://m.youtube.com/results?search_query=${q}`,
  ];
}

export type ResolveDeps = {
  /** Injected so this is testable without a network. */
  fetchText: (url: string) => Promise<string>;
  /** Ids resolved on an earlier tap. */
  cache: Record<string, string>;
  /** Called with a newly resolved id so the caller can remember it. */
  remember?: (exerciseId: string, videoId: string) => void;
};

/**
 * The URL to open for an exercise: the exact video when one can be found or is
 * already known, and the search page when it cannot. Never throws — a failure
 * here must not stop someone mid-set from seeing how the movement looks.
 */
export async function demoLink(ex: Exercise, deps: ResolveDeps): Promise<string> {
  const known = deps.cache[ex.id];
  if (known && isVideoId(known)) return watchUrl(known);
  for (const url of searchUrls(ex)) {
    try {
      const html = await deps.fetchText(url);
      const id = bestHit(html, ex);
      if (id && isVideoId(id)) {
        deps.remember?.(ex.id, id);
        return watchUrl(id);
      }
    } catch {
      // offline, blocked, or a page we no longer recognise — try the next one
    }
  }
  return searchUrl(ex);
}
