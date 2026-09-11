/**
 * The connectivity rules, tested without a network.
 *
 * `probe` is the one piece with real consequences — it decides whether the app
 * tells someone they are offline — and its logic is one line that is easy to
 * get backwards: any answer from the server means the network works, including
 * a refusal. Only a transport failure or a timeout means it does not.
 */

import { probe } from "./index";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

type FetchLike = typeof globalThis.fetch;
const realFetch = globalThis.fetch;
const withFetch = async (impl: FetchLike, run: () => Promise<void>) => {
  globalThis.fetch = impl;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
};

// A server that answers is a network that works, whatever it answers.
await withFetch(
  (async () => new Response("ok", { status: 200 })) as FetchLike,
  async () => {
    check("a 200 means online", (await probe()) === true);
  },
);
await withFetch(
  (async () => new Response("nope", { status: 401 })) as FetchLike,
  async () => {
    check("even a 401 means online — the packets got there", (await probe()) === true);
  },
);
await withFetch(
  (async () => new Response("boom", { status: 503 })) as FetchLike,
  async () => {
    check("a server error still means online", (await probe()) === true);
  },
);

// Only a transport failure is offline.
await withFetch(
  (async () => {
    throw new TypeError("Failed to fetch");
  }) as FetchLike,
  async () => {
    check("a transport failure means offline", (await probe()) === false);
  },
);
await withFetch(
  (async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  }) as FetchLike,
  async () => {
    check("a timeout means offline", (await probe()) === false);
  },
);

// A probe must never throw: it is called from an effect on every foreground,
// and an unhandled rejection there would take the screen down.
await withFetch(
  (() => {
    throw new Error("synchronous explosion");
  }) as unknown as FetchLike,
  async () => {
    let threw = false;
    try {
      await probe();
    } catch {
      threw = true;
    }
    check("a probe never throws at its caller", !threw);
  },
);

// It asks exactly once per call, and it asks the sync server rather than some
// third party's connectivity endpoint — a reachability check that phones a
// stranger is a tracker with a friendly name.
{
  const urls: string[] = [];
  await withFetch(
    (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response("ok", { status: 200 });
    }) as FetchLike,
    async () => {
      await probe();
      check("one probe is one request", urls.length === 1, String(urls.length));
      check("it asks our own server", urls[0].includes("supabase.co"), urls[0]);
      check("and nothing else", !/google|apple|msftconnecttest|cloudflare/i.test(urls[0]), urls[0]);
    },
  );
}

// An unconfigured project is not an offline phone. Reporting the second put a
// "no internet" banner in front of people who were online and downloading
// fine — the bug that prompted all of this.
{
  const config = await import("@/cloud/config");
  const wasConfigured = config.cloudConfigured;
  check("this build is configured, so probes mean something", wasConfigured === true);
}

// The probe answers three ways, and the difference matters: true and false are
// answers about the network, null means there is no server to ask about.
await withFetch(
  (async () => new Response("ok", { status: 200 })) as FetchLike,
  async () => {
    const answer = await probe();
    check("a reachable server is exactly true, never null", answer === true, String(answer));
  },
);
await withFetch(
  (async () => {
    throw new TypeError("Failed to fetch");
  }) as FetchLike,
  async () => {
    const answer = await probe();
    check("an unreachable server is exactly false, never null", answer === false, String(answer));
  },
);

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
