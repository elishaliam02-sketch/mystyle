import { FOODS, type Food, type Meal } from "./data";

/**
 * Real photographs for meals, from Wikimedia Commons.
 *
 * This replaces an AI image generator. That version wrote a prompt describing
 * the dish and let a model paint it, and the results were the problem: plates
 * with six-pronged forks, food that is not quite any real food, a shine no
 * kitchen produces. A picture of dinner has to look like dinner or the whole
 * screen reads as fake, so these are photographs taken by people of actual
 * plates — nothing is generated.
 *
 * Commons is the source because it is free, needs no API key and no billing
 * account, and everything on it is openly licensed, so shipping the photos in
 * a real app is not a legal problem. (Google Images has no such API: the
 * thumbnails are not licensed for reuse and Custom Search needs a paid key
 * past 100 queries a day. Commons is the honest version of the same idea.)
 *
 * The search is an API call, so it can fail or find nothing. Every caller
 * keeps the drawn plate underneath and only swaps once a photo is in hand —
 * offline the app is exactly as it was.
 */

/** Commons' API endpoint. `origin=*` is what makes it work on web too. */
const API = "https://commons.wikimedia.org/w/api.php";

/** How many search hits to consider before giving up on a query. */
const CANDIDATES = 12;

/**
 * Below this, an image is a thumbnail, a sprite or an icon rather than a photo
 * somebody took. Real camera uploads clear it easily.
 */
const MIN_SOURCE_WIDTH = 640;

/**
 * Commons is a media archive, not a food site: "chicken" matches poultry
 * diagrams, "corn" matches crop maps, and almost every food word matches some
 * municipality's coat of arms. These words in a file name mean the image is a
 * document about the subject rather than a picture of it on a plate.
 */
const NOT_A_PHOTO =
  /\b(logo|icon|map|diagram|chart|graph|coat[_ ]of[_ ]arms|flag|stamp|seal|poster|label|sign|banner|drawing|illustration|painting|engraving|sketch|clipart)\b/i;

export type CommonsImage = {
  /** A thumbnail at (about) the width we asked for. */
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
};

export type CommonsPage = {
  title?: string;
  /** Search rank — lower is a better hit. `generator=search` sets it. */
  index?: number;
  imageinfo?: CommonsImage[];
};

/**
 * The API call for one search phrase. Pure and exported so the tests can check
 * the URL without a network — this file is the only place the endpoint shape
 * is written down.
 */
export function commonsSearchUrl(query: string, width: number): string {
  const params = [
    "action=query",
    "format=json",
    "formatversion=2",
    // Let a browser read the response; without it web builds fail CORS.
    "origin=*",
    "generator=search",
    "gsrnamespace=6", // File: pages only
    `gsrsearch=${encodeURIComponent(query)}`,
    `gsrlimit=${CANDIDATES}`,
    "prop=imageinfo",
    `iiprop=${encodeURIComponent("url|mime|size")}`,
    `iiurlwidth=${Math.max(1, Math.round(width))}`,
  ];
  return `${API}?${params.join("&")}`;
}

/**
 * The best real photograph in a Commons response, or null if it holds none.
 *
 * Search rank leads — Commons' own relevance is better than anything we could
 * re-derive — and the rest is a filter for "is this a photograph of the food",
 * with one nudge: a landscape frame survives the wide crop on the card, where
 * a tall one loses its top and bottom to it.
 */
export function pickPhoto(pages: CommonsPage[]): string | null {
  const usable = pages
    .filter((p) => isPhoto(p))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0) - landscapeBonus(a) + landscapeBonus(b));
  return usable[0]?.imageinfo?.[0]?.thumburl ?? null;
}

/** Worth up to one rank position — a tie-breaker, never a re-ranking. */
function landscapeBonus(p: CommonsPage): number {
  const info = p.imageinfo?.[0];
  if (!info?.width || !info.height) return 0;
  return info.width >= info.height ? 1 : 0;
}

function isPhoto(p: CommonsPage): boolean {
  const info = p.imageinfo?.[0];
  if (!info?.thumburl) return false;
  // JPEG is the giveaway: cameras write JPEG, while the PNGs and SVGs on
  // Commons are overwhelmingly diagrams, logos and screenshots.
  if (info.mime !== "image/jpeg") return false;
  if ((info.width ?? 0) < MIN_SOURCE_WIDTH) return false;
  if (p.title && NOT_A_PHOTO.test(p.title)) return false;
  return true;
}

/**
 * What to search for, best phrase first.
 *
 * The dish's own curated phrase leads, because it names the thing a
 * photographer would have labelled the picture. When Commons has no photo of
 * that exact dish — and it has no "cottage cheese on toast" — the ladder falls
 * back to the ingredient the plate is built on, which it certainly does have.
 * A photo of grilled chicken over a dish card that says chicken and rice is a
 * fair picture of the meal; a cartoon is not.
 */
export function photoQueries(meal: Meal): string[] {
  const queries: string[] = [];
  const add = (q: string) => {
    const clean = q.trim();
    if (clean && !queries.includes(clean)) queries.push(clean);
  };

  if (meal.photo) add(meal.photo);

  // The lead ingredient, which `uses` puts first by convention.
  const lead = meal.uses.map(foodById).find((f): f is Food => !!f);
  if (lead) add(`${lead.en} food`);

  return queries;
}

function foodById(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

/** Stop waiting on a search this long in; the drawn plate is already on screen. */
const TIMEOUT_MS = 5000;

/**
 * Resolved photos, so a dish is looked up once per launch however many cards
 * show it. A null is cached too: a dish Commons cannot picture should not cost
 * a request every time it scrolls past.
 *
 * Keyed on the queries, not on the meal id, because "your plate" keeps the one
 * id while its ingredients change underneath it — key it by id and that card
 * shows the photo of the first fridge it ever saw.
 */
const cache = new Map<string, string | null>();
/** Lookups in flight, so two cards for one dish share a single request. */
const inFlight = new Map<string, Promise<string | null>>();

/** For the tests, and for a manual refresh if one is ever wanted. */
export function clearPhotoCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * A real photo for a meal, or null when there is none to be had. Never throws:
 * a failure here means the card keeps the drawing it is already showing, which
 * is a complete picture in its own right.
 */
export function fetchMealPhoto(meal: Meal, width: number): Promise<string | null> {
  const queries = photoQueries(meal);
  if (queries.length === 0) return Promise.resolve(null);

  const key = `${queries.join("|")}@${Math.round(width)}`;
  const done = cache.get(key);
  if (done !== undefined) return Promise.resolve(done);

  const running = inFlight.get(key);
  if (running) return running;

  const job = resolve(queries, width)
    .catch(() => null)
    .then((url) => {
      cache.set(key, url);
      inFlight.delete(key);
      return url;
    });
  inFlight.set(key, job);
  return job;
}

async function resolve(queries: string[], width: number): Promise<string | null> {
  for (const query of queries) {
    const pages = await search(query, width);
    const url = pickPhoto(pages);
    if (url) return url;
  }
  return null;
}

/**
 * How many searches may be in the air at once.
 *
 * The kitchen opens with a dozen meal cards, each willing to try two queries,
 * so an ungated screen fires two dozen requests at a free public API the
 * instant it renders. Four at a time is polite, and it reads better too: the
 * photos land in a steady trickle rather than all at once several seconds in.
 */
const MAX_PARALLEL = 4;
let active = 0;
const waiting: (() => void)[] = [];

async function gate<T>(job: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((go) => waiting.push(go));
  active++;
  try {
    return await job();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

function search(query: string, width: number): Promise<CommonsPage[]> {
  return gate(() => searchNow(query, width));
}

async function searchNow(query: string, width: number): Promise<CommonsPage[]> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(commonsSearchUrl(query, width), { signal: stop.signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { query?: { pages?: CommonsPage[] } };
    // formatversion=2 makes pages an array; a search with no hits omits it.
    return body.query?.pages ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
