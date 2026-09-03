/**
 * Tests for resolving an exercise's demo video. The interesting cases are all
 * the ways YouTube can fail to answer — the app must still open something.
 */
import { EXERCISES } from "./exercises";
import { bestHit, demoLink, firstVideoId, isVideoId, keyWords, searchHits, searchUrl, searchUrls, watchUrl } from "./video";

const results: [string, boolean, string?][] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push([name, pass, detail]);
}

const squat = EXERCISES.find((e) => e.id === "squat") ?? EXERCISES[0]!;
const page = (id: string) =>
  `<html><script>var ytInitialData = {"contents":{"x":[{"videoId":"${id}","title":"demo"}]}};</script></html>`;

// --- pulling the top result out of the page
{
  check("finds the id in a search page", firstVideoId(page("dQw4w9WgXcQ")) === "dQw4w9WgXcQ");
  check("takes the first of several", firstVideoId(page("aaaaaaaaaaa") + page("bbbbbbbbbbb")) === "aaaaaaaaaaa");
  check("an empty page yields nothing", firstVideoId("") === null);
  check("a page with no video yields nothing", firstVideoId("<html>no results</html>") === null);
  check("a too-short id is not accepted", firstVideoId('"videoId":"abc"') === null);
  check("a 10-char id is not accepted", firstVideoId('"videoId":"a-b_c1234X"') === null);
  check("dashes and underscores are part of an id", firstVideoId('"videoId":"a-b_c1234XY"') === "a-b_c1234XY");
  check("an over-long id is rejected rather than truncated", firstVideoId('"videoId":"a-b_c1234XYZ"') === null);
}

// --- the id shape
{
  check("a real id passes", isVideoId("dQw4w9WgXcQ"));
  check("an empty id fails", !isVideoId(""));
  check("a url is not an id", !isVideoId("https://youtu.be/x"));
  check("a quote-injected id fails", !isVideoId('a"b'));
}

// --- the urls
{
  check("a watch url points at one video", watchUrl("dQw4w9WgXcQ") === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  check("a search url is escaped", searchUrl(squat).includes(encodeURIComponent(squat.yt)));
  check("every exercise can build a search url", EXERCISES.every((e) => searchUrl(e).startsWith("https://www.youtube.com/results?")));
}

// --- resolving, with every failure mode
await (async () => {
  const ok = { fetchText: async () => page("dQw4w9WgXcQ"), cache: {} };
  check("resolves to the exact video", (await demoLink(squat, ok)) === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  let asked = 0;
  const remembered: Record<string, string> = {};
  const counting = {
    fetchText: async () => { asked++; return page("dQw4w9WgXcQ"); },
    cache: remembered,
    remember: (exId: string, vid: string) => { remembered[exId] = vid; },
  };
  await demoLink(squat, counting);
  check("a resolved id is remembered", remembered[squat.id] === "dQw4w9WgXcQ");
  await demoLink(squat, counting);
  check("a remembered id is not fetched again", asked === 1, String(asked));

  const offline = { fetchText: async () => { throw new Error("offline"); }, cache: {} };
  check("offline falls back to the search", (await demoLink(squat, offline)) === searchUrl(squat));

  const junk = { fetchText: async () => "<html>consent wall</html>", cache: {} };
  check("an unrecognised page falls back to the search", (await demoLink(squat, junk)) === searchUrl(squat));

  const poisoned = { fetchText: async () => page("dQw4w9WgXcQ"), cache: { [squat.id]: "not-an-id" } };
  check("a corrupt cached id is ignored", (await demoLink(squat, poisoned)) === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  const slowFail = { fetchText: async () => { throw new Error("boom"); }, cache: { [squat.id]: "dQw4w9WgXcQ" } };
  check("a cached id needs no network at all", (await demoLink(squat, slowFail)) === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  check("every exercise resolves to something openable", (await Promise.all(
    EXERCISES.map((e) => demoLink(e, { fetchText: async () => { throw new Error("x"); }, cache: {} })),
  )).every((u) => u.startsWith("https://www.youtube.com/")));
})();

// --- picking the right video, not merely the first one
{
  const hit = (id: string, title: string) =>
    `"videoId":"${id}","thumbnail":{},"title":{"runs":[{"text":"${title}"}]}`;
  const results = (...rows: string[]) => `<html><script>{${rows.join(",")}}</script></html>`;

  const bench = EXERCISES.find((e) => e.id === "bench-press")!;
  check("titles are read off the page", (() => {
    const rows = searchHits(results(hit("aaaaaaaaaaa", "Barbell Bench Press"), hit("bbbbbbbbbbb", "Squat")));
    return rows.length === 2 && rows[0]!.title === "Barbell Bench Press";
  })());
  check("an escaped title survives", (() => {
    const rows = searchHits(results(hit("aaaaaaaaaaa", "How to \\\"bench\\\" press")));
    return rows[0]!.title.includes('"bench"');
  })());
  check("a unicode-escaped title survives", (() => {
    const rows = searchHits(results(hit("aaaaaaaaaaa", "Bench \\u0026 press")));
    return rows[0]!.title.includes("&");
  })());

  check("an ad at the top is skipped for the real thing",
    bestHit(results(
      hit("aaaaaaaaaaa", "Get shredded in 30 days - supplement ad"),
      hit("bbbbbbbbbbb", "Barbell Bench Press - proper form"),
    ), bench) === "bbbbbbbbbbb");
  check("the right movement beats a neighbouring one",
    bestHit(results(
      hit("aaaaaaaaaaa", "Dumbbell fly tutorial"),
      hit("bbbbbbbbbbb", "How to barbell bench press correctly"),
    ), bench) === "bbbbbbbbbbb");
  check("a perfect match a few rows down still wins",
    bestHit(results(
      hit("aaaaaaaaaaa", "Bench tips"),
      hit("bbbbbbbbbbb", "Chest day vlog"),
      hit("ccccccccccc", "Leg day"),
      hit("ddddddddddd", "Barbell bench press proper form"),
    ), bench) === "ddddddddddd");
  check("when nothing matches, the top result is still opened",
    bestHit(results(hit("aaaaaaaaaaa", "מדריך בעברית"), hit("bbbbbbbbbbb", "אימון")), bench) === "aaaaaaaaaaa");
  check("a page with ids but no titles still yields the first id",
    bestHit('"videoId":"aaaaaaaaaaa"', bench) === "aaaaaaaaaaa");
  check("an empty page yields nothing", bestHit("", bench) === null);

  check("the key words drop the filler", (() => {
    const w = keyWords(bench);
    return w.includes("barbell") && w.includes("bench") && w.includes("press") && !w.includes("form");
  })(), keyWords(bench).join(","));
  check("every exercise has something to match on",
    EXERCISES.every((e) => keyWords(e).length > 0),
    EXERCISES.filter((e) => keyWords(e).length === 0).map((e) => e.id).join(","));

  check("two search pages are tried", searchUrls(bench).length === 2);
  check("the mobile page is the second", searchUrls(bench)[1]!.startsWith("https://m.youtube.com/"));
}

// --- falling over to the second page when the first one fails
await (async () => {
  const bench = EXERCISES.find((e) => e.id === "bench-press")!;
  const page = `"videoId":"dQw4w9WgXcQ","x":{},"title":{"runs":[{"text":"Barbell bench press form"}]}`;
  let calls = 0;
  const flaky = {
    fetchText: async (url: string) => {
      calls++;
      if (url.includes("www.youtube.com")) throw new Error("blocked");
      return page;
    },
    cache: {},
  };
  check("a blocked desktop page falls through to mobile",
    (await demoLink(bench, flaky)) === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  check("both pages were tried", calls === 2, String(calls));

  let tried = 0;
  const good = {
    fetchText: async () => { tried++; return page; },
    cache: {},
  };
  await demoLink(bench, good);
  check("a page that works is not followed by a second request", tried === 1, String(tried));
})();

const failed = results.filter(([, ok]) => !ok);
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
