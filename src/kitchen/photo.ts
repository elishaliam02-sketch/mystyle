import { photoConsentGiven } from "@/legal";
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

/**
 * The two hosts this reaches: the API answers the search, and the thumbnails it
 * names are served from the upload host. Both are exported because the privacy
 * policy has to name every host the app contacts, and a test checks that it
 * does — a service the documents never mention is a compliance bug however
 * innocuous what it is sent.
 */
export const PHOTO_HOSTS = ["commons.wikimedia.org", "upload.wikimedia.org"] as const;

/** Commons' API endpoint. `origin=*` is what makes it work on web too. */
const API = `https://${PHOTO_HOSTS[0]}/w/api.php`;

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
 * municipality's coat of arms. These words mean the image is a document about
 * the subject rather than a picture of it on a plate.
 */
const NOT_A_PHOTO =
  /\b(logos?|icons?|maps?|diagrams?|charts?|graphs?|coat[_ ]of[_ ]arms|flags?|stamps?|seals?|posters?|labels?|signs?|banners?|drawings?|illustrations?|paintings?|engravings?|etchings?|lithographs?|woodcuts?|sketch(es)?|clipart|artwork|still[_ ]life|manuscripts?|frescos?|mosaics?)\b/i;

/**
 * And a media archive has a great deal of food that is not a meal. "oats"
 * returns a moth sitting on an oat stalk, "chickpeas" a sack of dried ones,
 * "salmon" a fish in a river. All are photographs, and none is dinner.
 *
 * These words are checked against the title and the file's categories, which is
 * where Commons actually records what a picture is of. The list only holds
 * things that cannot be on a plate — an insect, a field, a museum — so it never
 * has to weigh up how appetising something looks.
 */
const NOT_A_DISH =
  /\b(insects?|moths?|butterfl(y|ies)|beetles?|caterpillars?|larvae?|bees?|wasps?|birds?|livestock|cattle|herds?|fields?|crops?|plantations?|harvests?|farms?|orchards?|seedlings?|botanical|herbarium|museums?|galler(y|ies)|banknotes?|coins?|monuments?|statues?)\b/i;

/**
 * Nothing photographed before this is a picture of a meal somebody might cook
 * tonight — it is a painting, an engraving or a museum plate. Commons records
 * the capture date, and an old one is the single most reliable signal that a
 * file which passed every other test is artwork: a seventeenth-century still
 * life of fish is a JPEG of 2000 pixels like any other.
 */
const OLDEST_USEFUL_YEAR = 1970;

export type CommonsImage = {
  /** A thumbnail at (about) the width we asked for. */
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
  /** Commons' own metadata block: who took it, and under what licence. */
  extmetadata?: Record<string, { value?: string } | undefined>;
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
    // extmetadata carries the licence and the photographer. It is not optional:
    // most Commons licences (CC BY, CC BY-SA) are only honoured if the credit
    // travels with the picture, so a photo we cannot name is a photo we cannot
    // use. See `creditFor`.
    `iiprop=${encodeURIComponent("url|mime|size|extmetadata")}`,
    `iiurlwidth=${Math.max(1, Math.round(width))}`,
  ];
  return `${API}?${params.join("&")}`;
}

/** A photograph and the credit line that has to be shown with it, if any. */
export type Photo = {
  url: string;
  /**
   * "Jane Doe · CC BY-SA 4.0", or null when the licence asks for nothing (a
   * public-domain or CC0 image). Never a licence with no name attached: that
   * combination is rejected rather than shown uncredited.
   */
  credit: string | null;
};

/**
 * Licences that ask for nothing back. Everything else on Commons wants the
 * photographer named — CC BY and CC BY-SA both do — and "everything else"
 * includes anything we do not recognise, because guessing in the permissive
 * direction is how you end up using someone's work against their terms.
 */
const NO_CREDIT_NEEDED = /^(cc0|public domain|pd|no restrictions)/i;

/** Commons writes these fields as HTML — a link around the photographer's name. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The credit line for an image: who to name and under what licence.
 *
 * Returns `null` when none is needed, and `undefined` when one is needed and
 * cannot be built — the caller drops that photo. Showing a CC BY picture with
 * no photographer's name is a licence breach, and the drawn plate underneath is
 * a perfectly good picture, so there is never a reason to take the risk.
 */
export function creditFor(info: CommonsImage): string | null | undefined {
  const licence = plainText(info.extmetadata?.LicenseShortName?.value ?? "");
  const artist = plainText(info.extmetadata?.Artist?.value ?? "");
  if (licence && NO_CREDIT_NEEDED.test(licence)) return null;
  if (!licence || !artist) return undefined;
  // A wall of text where a name should be is somebody's whole upload template.
  const name = artist.length > 60 ? `${artist.slice(0, 57).trimEnd()}…` : artist;
  return `${name} · ${licence}`;
}

/**
 * The best real photograph in a Commons response, or null if it holds none.
 *
 * Search rank leads — Commons' own relevance is better than anything we could
 * re-derive — and the rest is a filter for "is this a photograph of the food",
 * with one nudge: a landscape frame survives the wide crop on the card, where
 * a tall one loses its top and bottom to it. The first hit we can both use and
 * credit wins; one we cannot credit is passed over, not shown bare.
 */
export function pickPhoto(pages: CommonsPage[]): Photo | null {
  const usable = pages
    .filter((p) => isPhoto(p))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0) - landscapeBonus(a) + landscapeBonus(b));
  for (const page of usable) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    const credit = creditFor(info);
    if (credit === undefined) continue; // cannot be credited, so cannot be used
    return { url: info.thumburl, credit };
  }
  return null;
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

  // The file name, plus what Commons says the picture is of. Categories are
  // where "Still life paintings of fish" is actually written down; the title is
  // often just a camera's filename.
  const said = [
    p.title ?? "",
    plainText(info.extmetadata?.Categories?.value ?? ""),
    plainText(info.extmetadata?.ObjectName?.value ?? ""),
  ].join(" ");
  if (NOT_A_PHOTO.test(said)) return false;
  if (NOT_A_DISH.test(said)) return false;

  const year = yearOf(info);
  if (year !== null && year < OLDEST_USEFUL_YEAR) return false;
  return true;
}

/** The year a picture was taken, when Commons knows it. */
function yearOf(info: CommonsImage): number | null {
  const raw = plainText(info.extmetadata?.DateTimeOriginal?.value ?? "");
  const match = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(raw);
  return match ? Number(match[1]) : null;
}

/**
 * What to search for, best phrase first.
 *
 * The dish's own curated phrase leads, because it names the thing a
 * photographer would have labelled the picture. When Commons has no photo of
 * that exact dish — and it has no "cottage cheese on toast" — the ladder walks
 * down toward the ingredients the plate is built on. A photo of grilled chicken
 * over a card that says chicken and rice is a fair picture of the meal.
 *
 * The rungs below the dish are the lesson of the first contact sheet. Falling
 * straight to one ingredient plus the word "food" returned a moth on an oat
 * stalk, a sack of dried chickpeas and a bag of pearl barley: on Commons, a
 * lone ingredient is a crop, not a meal. Two ingredients together nearly always
 * mean somebody cooked them, and "cooked" or "dish" says it outright — so those
 * come first, and the bare ingredient is only ever the last resort it should
 * always have been.
 */
export function photoQueries(meal: Meal): string[] {
  const queries: string[] = [];
  const add = (q: string) => {
    const clean = q.trim();
    if (clean && !queries.includes(clean)) queries.push(clean);
  };

  if (meal.photo) add(meal.photo);

  // The ingredients the dish leads with — `uses` puts them in that order.
  const [lead, second] = meal.uses.map(foodById).filter((f): f is Food => !!f);
  if (lead && second) add(`${lead.en} ${second.en} cooked`);
  if (lead && second) add(`${lead.en} ${second.en}`);
  if (lead) add(`${lead.en} dish`);
  if (lead) add(`cooked ${lead.en}`);
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
const cache = new Map<string, Photo | null>();
/** Lookups in flight, so two cards for one dish share a single request. */
const inFlight = new Map<string, Promise<Photo | null>>();

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
export function fetchMealPhoto(meal: Meal, width: number): Promise<Photo | null> {
  // The one gate, checked here rather than at the call sites, so there is no
  // second path out. Off means the drawn plate is the picture and no request is
  // made at all — and it reads false until the store has published the stored
  // answer, so a launch never fetches on a default the person overrode.
  if (!photoConsentGiven()) return Promise.resolve(null);

  const queries = photoQueries(meal);
  if (queries.length === 0) return Promise.resolve(null);

  const key = `${queries.join("|")}@${Math.round(width)}`;
  const done = cache.get(key);
  if (done !== undefined) return Promise.resolve(done);

  const running = inFlight.get(key);
  if (running) return running;

  const job = resolve(queries, width)
    .catch(() => null)
    .then((photo) => {
      cache.set(key, photo);
      inFlight.delete(key);
      return photo;
    });
  inFlight.set(key, job);
  return job;
}

async function resolve(queries: string[], width: number): Promise<Photo | null> {
  for (const query of queries) {
    const pages = await search(query, width);
    const photo = pickPhoto(pages);
    if (photo) return photo;
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
