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
  try {
    const html = await deps.fetchText(searchUrl(ex));
    const id = firstVideoId(html);
    if (id) {
      deps.remember?.(ex.id, id);
      return watchUrl(id);
    }
  } catch {
    // offline, blocked, or a page we no longer recognise — fall through
  }
  return searchUrl(ex);
}
