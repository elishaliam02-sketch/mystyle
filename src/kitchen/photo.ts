import { FOODS, type Food, type Meal } from "./data";

/**
 * Real photographs of the meals — and the queue that gets them onto the screen.
 *
 * The pictures are generated on demand by a free image service from a prompt
 * built out of the dish and its actual ingredients, so a plate is a photo of
 * *this* meal rather than a stock stand-in, and nobody's copyrighted shot is
 * borrowed to do it. The drawn plate in `MealImage` stays underneath as the
 * base layer, which is what lets this be slow without ever showing a spinner.
 *
 * The first version asked for every visible card at once and gave up after six
 * seconds. Both halves of that were wrong, and together they meant almost
 * nobody ever saw a photo:
 *
 * - Generating an image takes a while — ten, fifteen, occasionally twenty-five
 *   seconds on a cold prompt. Six seconds is a guaranteed miss, so the app
 *   looked like it had no photos at all while quietly fetching ten of them.
 * - Ten simultaneous requests is how a free service decides you are abusing it.
 *   Two at a time, newest asked first, serves the card somebody is actually
 *   looking at and keeps the rest in line behind it.
 *
 * So: one request per dish, two in flight, a generous timeout, two retries with
 * a growing gap, and a cool-off before a dish that failed outright is tried
 * again. A failure is never fatal — the drawing is a finished picture, not a
 * placeholder.
 *
 * Everything goes through an injectable `prefetch`, `schedule` and `now`, so
 * the whole policy is testable in plain Node with no network and no clock.
 */

/**
 * One size for every device, so every phone asks for the same URL and hits the
 * service's own cache instead of paying for a fresh generation. It matches the
 * card's 320x150 aspect and is scaled down on display — asking for the full 3x
 * pixel size would multiply the generation time for no visible gain.
 */
export const PHOTO_SIZE = { width: 512, height: 240 } as const;

/** At most this many generations in flight. More is what gets you throttled. */
export const MAX_INFLIGHT = 2;
/** How long one attempt is given before the slot passes to the next dish. */
export const ATTEMPT_TIMEOUT_MS = 28_000;
/** The gaps before the second and third attempts. Three strikes, then a rest. */
export const RETRY_DELAYS_MS = [5_000, 20_000] as const;
/** How long a dish that failed every attempt is left alone. */
export const COOLDOWN_MS = 180_000;

/**
 * `pending` means keep the drawing up and keep hoping; `ready` means the photo
 * is in the image cache and can be shown without a flash; `missing` means the
 * drawing is the picture, for now.
 */
export type PhotoState = "pending" | "ready" | "missing";

/** Fetch an image into the platform's cache. `Image.prefetch`, in practice. */
export type Prefetch = (uri: string) => Promise<unknown>;
/** Run something later, returning a way to call it off. `setTimeout`, normally. */
export type Schedule = (fn: () => void, ms: number) => () => void;

type Entry = {
  url: string;
  state: PhotoState;
  attempts: number;
  inflight: boolean;
  /** Nothing before this moment: a dish that just failed an attempt rests. */
  readyAt: number;
  listeners: Set<(state: PhotoState) => void>;
};

/**
 * The prompt. English throughout — the model reads it best — and built from the
 * meal's own ingredient list, so changing what a dish is made of changes its
 * photo. "no text" matters: image models love to caption a plate.
 */
export function photoPrompt(meal: Meal): string {
  const ingredients = meal.uses
    .map((id) => FOODS.find((f) => f.id === id))
    .filter((f): f is Food => !!f)
    .map((f) => f.en)
    .join(", ");
  return (
    `professional food photography of a full plate of ${meal.en.title}, ` +
    `made with ${ingredients}, the whole dish centred and fully in frame, ` +
    `wide overhead shot, natural daylight, fresh, appetizing, sharp focus, no text`
  );
}

/**
 * A photo for a meal. The seed comes from the meal id, so the same dish keeps
 * the same photograph across launches and devices rather than becoming a
 * different lunch every time the list scrolls.
 */
export function mealPhotoUrl(
  meal: Meal,
  size: { width: number; height: number } = PHOTO_SIZE,
): string {
  const q = `width=${size.width}&height=${size.height}&nologo=true&seed=${stableSeed(meal.id)}`;
  return `https://${PHOTO_HOST}/prompt/${encodeURIComponent(photoPrompt(meal))}?${q}`;
}

/** A small deterministic number from a string, so one meal keeps one image. */
function stableSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100000;
}

/** The only host photos come from — named in the privacy policy, by this name. */
export const PHOTO_HOST = "image.pollinations.ai";

export class PhotoLoader {
  private readonly entries = new Map<string, Entry>();
  /** Dish ids waiting for a slot. Served from the back: newest asked, first served. */
  private queue: string[] = [];
  private inflight = 0;

  constructor(
    private readonly deps: {
      prefetch: Prefetch;
      schedule: Schedule;
      now: () => number;
    },
  ) {}

  /** What is known about this dish right now, without asking for anything. */
  stateOf(meal: Meal): PhotoState {
    return this.entries.get(meal.id)?.state ?? "pending";
  }

  url(meal: Meal): string {
    return this.entry(meal).url;
  }

  /**
   * Ask for a dish's photo and hear about it. Called as a card appears; the
   * returned function is called as it goes away. Asking again for a dish that
   * already loaded costs nothing — the answer comes straight back.
   */
  watch(meal: Meal, onState: (state: PhotoState) => void): () => void {
    const entry = this.entry(meal);
    entry.listeners.add(onState);
    onState(entry.state);
    if (entry.state !== "ready") this.enqueue(meal.id);
    return () => {
      entry.listeners.delete(onState);
    };
  }

  /** For the tests, and for anything that wants to know how busy this is. */
  get busy(): { inflight: number; waiting: number } {
    return { inflight: this.inflight, waiting: this.queue.length };
  }

  private entry(meal: Meal): Entry {
    const found = this.entries.get(meal.id);
    if (found) return found;
    const made: Entry = {
      url: mealPhotoUrl(meal),
      state: "pending",
      attempts: 0,
      inflight: false,
      readyAt: 0,
      listeners: new Set(),
    };
    this.entries.set(meal.id, made);
    return made;
  }

  private enqueue(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || entry.inflight || entry.state === "ready") return;
    if (entry.readyAt > this.deps.now()) return; // resting after a failure
    // Asked for again moves a dish to the front of the line, which is what
    // makes scrolling back to a card jump it ahead of whatever is off screen.
    this.queue = this.queue.filter((q) => q !== id);
    this.queue.push(id);
    this.pump();
  }

  private pump(): void {
    while (this.inflight < MAX_INFLIGHT && this.queue.length > 0) {
      const id = this.queue.pop()!;
      const entry = this.entries.get(id);
      if (!entry || entry.inflight || entry.state === "ready") continue;
      if (entry.readyAt > this.deps.now()) continue;
      this.start(id, entry);
    }
  }

  private start(id: string, entry: Entry): void {
    entry.inflight = true;
    entry.attempts += 1;
    this.inflight += 1;

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cancelTimeout();
      entry.inflight = false;
      this.inflight -= 1;
      if (ok) {
        this.set(entry, "ready");
      } else {
        const gap = RETRY_DELAYS_MS[entry.attempts - 1];
        if (gap === undefined) {
          // Out of attempts. Say so, so the card stops waiting, and leave the
          // dish alone for a while: a service that has failed three times in a
          // row will not be fixed by a fourth request this minute.
          entry.readyAt = this.deps.now() + COOLDOWN_MS;
          this.set(entry, "missing");
        } else {
          entry.readyAt = this.deps.now() + gap;
          this.deps.schedule(() => this.enqueue(id), gap);
        }
      }
      this.pump();
    };

    const cancelTimeout = this.deps.schedule(() => finish(false), ATTEMPT_TIMEOUT_MS);
    this.deps
      .prefetch(entry.url)
      .then(() => finish(true))
      .catch(() => finish(false));
  }

  private set(entry: Entry, state: PhotoState): void {
    if (entry.state === state) return;
    entry.state = state;
    for (const listener of entry.listeners) listener(state);
  }
}
