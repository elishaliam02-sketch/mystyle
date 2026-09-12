import { MEALS } from "./data";
import {
  ATTEMPT_TIMEOUT_MS,
  COOLDOWN_MS,
  MAX_INFLIGHT,
  PHOTO_HOST,
  PHOTO_SIZE,
  PhotoLoader,
  RETRY_DELAYS_MS,
  mealPhotoUrl,
  photoPrompt,
  type PhotoState,
} from "./photo";

/**
 * The photo queue, run against a fake clock and a fake network.
 *
 * What matters here is not that a URL is well formed — it is that a free image
 * service is asked politely (two at a time, the visible card first, once per
 * dish) and that a slow or broken service never leaves a card waiting forever.
 * None of that is observable by eye in less than half a minute, which is
 * exactly why it is tested rather than looked at.
 */

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

/** A clock and a timer queue under the test's control. */
function fakeWorld() {
  let now = 1_000_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    schedule: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return () => timers.delete(id);
    },
    /** Move time forward, firing whatever comes due, in order. */
    advance: (ms: number) => {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

/** A network whose every request is answered by hand. */
function fakeNet() {
  const calls: string[] = [];
  const open = new Map<string, { ok: () => void; fail: () => void }>();
  return {
    calls,
    prefetch: (uri: string) =>
      new Promise<void>((resolve, reject) => {
        calls.push(uri);
        open.set(uri, { ok: () => resolve(), fail: () => reject(new Error("no")) });
      }),
    /** Answer the nth request made so far. */
    answer: async (index: number, ok: boolean) => {
      const uri = calls[index];
      const handle = open.get(uri);
      if (handle) ok ? handle.ok() : handle.fail();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

const meals = MEALS.slice(0, 8);

// --- the URL: one per dish, built from that dish's own ingredients
{
  const urls = MEALS.map((m) => mealPhotoUrl(m));
  check("every photo comes from the one named host",
    urls.every((u) => u.startsWith(`https://${PHOTO_HOST}/prompt/`)));
  check("every dish has its own photo", new Set(urls).size === urls.length);
  check("the default size is the shared one, so every phone asks for one URL",
    urls.every((u) => u.includes(`width=${PHOTO_SIZE.width}`) && u.includes(`height=${PHOTO_SIZE.height}`)));
  check("the same dish always asks for the same photo",
    mealPhotoUrl(MEALS[3]) === mealPhotoUrl(MEALS[3]));
  check("nothing personal is in the prompt — only the dish and its ingredients",
    MEALS.every((m) => {
      const p = photoPrompt(m).toLowerCase();
      return p.includes(m.en.title.toLowerCase()) && !/\d{4}-\d\d-\d\d|@|kg\b/.test(p);
    }));
  check("the prompt asks for no caption", photoPrompt(MEALS[0]).includes("no text"));
  check("the URL is properly encoded", urls.every((u) => !u.includes(" ")));
}

// --- two at a time, and no more, however many cards are on screen
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  for (const m of meals) loader.watch(m, () => {});
  check("a screen full of cards asks for only two photos at once",
    net.calls.length === MAX_INFLIGHT, `${net.calls.length} in flight`);
  check("the rest are waiting, not dropped",
    loader.busy.waiting === meals.length - MAX_INFLIGHT, String(loader.busy.waiting));
}

// --- a finished photo frees the slot for the next dish in line
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  const seen: PhotoState[] = [];
  loader.watch(meals[0], (s) => seen.push(s));
  for (const m of meals.slice(1, 5)) loader.watch(m, () => {});
  const before = net.calls.length;
  await net.answer(0, true);
  check("a photo that arrives starts the next one", net.calls.length === before + 1);
  check("the card is told, and only about real changes",
    seen.join(">") === "pending>ready", seen.join(">"));
  check("the dish is remembered as ready", loader.stateOf(meals[0]) === "ready");
}

// --- the card somebody is looking at is served before the one off screen
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  // Two fill the slots; the next three wait.
  for (const m of meals.slice(0, 5)) loader.watch(m, () => {});
  // Scrolling brings the last one back into view — it asks again.
  loader.watch(meals[4], () => {});
  await net.answer(0, true);
  check("scrolling to a card jumps it ahead of the off-screen queue",
    net.calls[2] === mealPhotoUrl(meals[4]), net.calls[2]?.slice(-30));
}

// --- asking twice for the same dish is one request, not two
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  const stop = loader.watch(meals[0], () => {});
  loader.watch(meals[0], () => {});
  check("two cards of the same dish cost one request", net.calls.length === 1);
  await net.answer(0, true);
  const told: PhotoState[] = [];
  loader.watch(meals[0], (s) => told.push(s));
  check("a card that appears later is handed the answer at once", told[0] === "ready", told.join(">"));
  check("and costs no second request", net.calls.length === 1, String(net.calls.length));
  stop();
}

// --- a service that never answers does not hold the queue, or the card
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  loader.watch(meals[0], () => {});
  loader.watch(meals[1], () => {});
  loader.watch(meals[2], () => {});
  check("a generous timeout, because generating a photo is slow",
    ATTEMPT_TIMEOUT_MS >= 20_000, String(ATTEMPT_TIMEOUT_MS));
  check("the third dish is waiting behind the two in flight", loader.busy.waiting === 1);
  world.advance(ATTEMPT_TIMEOUT_MS + 1);
  check("a request that never answers gives up its slot to the one waiting",
    net.calls.length === MAX_INFLIGHT + 1 && net.calls[2] === mealPhotoUrl(meals[2]),
    String(net.calls.length));
  check("and nothing is left stuck in the queue", loader.busy.waiting === 0);
}

// --- three strikes, then the drawing stands and the service is left alone
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  const seen: PhotoState[] = [];
  loader.watch(meals[0], (s) => seen.push(s));
  await net.answer(0, false);
  check("a failure is not the end of it", seen.join(">") === "pending", seen.join(">"));
  check("it waits before trying again, rather than hammering",
    net.calls.length === 1, String(net.calls.length));
  world.advance(RETRY_DELAYS_MS[0]);
  check("and then tries again", net.calls.length === 2, String(net.calls.length));
  await net.answer(1, false);
  world.advance(RETRY_DELAYS_MS[1]);
  check("the second gap is longer than the first", RETRY_DELAYS_MS[1] > RETRY_DELAYS_MS[0]);
  check("a third attempt is made", net.calls.length === 3, String(net.calls.length));
  await net.answer(2, false);
  check("after three failures the card stops waiting",
    seen.join(">") === "pending>missing", seen.join(">"));

  // And nothing more is asked of the service for a good while.
  loader.watch(meals[0], () => {});
  check("a dish that failed outright is left alone for a cool-off",
    net.calls.length === 3, String(net.calls.length));
  world.advance(COOLDOWN_MS + 1);
  loader.watch(meals[0], () => {});
  check("after the cool-off it is worth one more try",
    net.calls.length === 4, String(net.calls.length));
  check("the cool-off is long enough to be a rest", COOLDOWN_MS >= 60_000);
}

// --- a card that goes away stops hearing about it
{
  const world = fakeWorld();
  const net = fakeNet();
  const loader = new PhotoLoader({ prefetch: net.prefetch, schedule: world.schedule, now: world.now });
  let heard = 0;
  const stop = loader.watch(meals[0], () => { heard += 1; });
  check("a card hears the state it starts in", heard === 1);
  stop();
  await net.answer(0, true);
  check("a card that scrolled away hears nothing more", heard === 1, String(heard));
  check("but the photo is still remembered for next time",
    loader.stateOf(meals[0]) === "ready");
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
