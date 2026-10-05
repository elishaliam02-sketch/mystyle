/*
 * APEX — the web app's service worker. It does one job: show a reminder when
 * the server pushes one, and open the right screen when it is tapped.
 *
 * The push carries only an id ("water@2026-10-03"). The words are read here,
 * from the browser's own storage, where the app wrote them — the server never
 * had them. An id this browser no longer knows still shows something, because
 * iOS takes push permission away from a site whose pushes show nothing.
 */
"use strict";

/*
 * Offline: the app's own files are kept here, so the home-screen app opens
 * with no signal — everything a person logs already lives on the device.
 *
 *  - pages: network first (a new version shows as soon as there is one), the
 *    kept copy when there is no network;
 *  - the bundle, fonts and images: their names carry a content hash, so a
 *    kept copy is never stale — kept first, fetched once;
 *  - anything on another origin (the server, photos) is not touched at all.
 */
const CACHE = "apex-app-v1";
const SHELL = "/index.html";

async function keepShell(html) {
  const cache = await caches.open(CACHE);
  await cache.put(SHELL, new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
  // The bundles this page names are the ones worth keeping; older ones go.
  const named = new Set((html.match(/\/_expo\/static\/[^"' )]+/g) || []).map((p) => p.split("?")[0]));
  await Promise.all(
    [...named].map(async (p) => {
      if (!(await cache.match(p))) {
        try {
          const res = await fetch(p);
          if (res.ok) await cache.put(p, res);
        } catch (e) {
          // offline right now; it is kept on the next visit
        }
      }
    }),
  );
  const keys = await cache.keys();
  for (const req of keys) {
    const path = new URL(req.url).pathname;
    if (/^\/_expo\/static\/js\/web\/index-/.test(path) && !named.has(path)) await cache.delete(req);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        if (res.ok) await keepShell(await res.text());
      } catch (e) {
        // installed while offline: the shell is kept on the next page load
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);

// Only what carries a content hash in its name: a kept copy of it can never
// be stale. (The root icons do not, so they are left to the network.)
const HASHED = /^\/(_expo\/static\/|assets\/)/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/admin")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
            const copy = res.clone();
            event.waitUntil(copy.text().then(keepShell).catch(() => {}));
          }
          return res;
        } catch (e) {
          const kept = await (await caches.open(CACHE)).match(SHELL);
          return kept || Response.error();
        }
      })(),
    );
    return;
  }

  if (HASHED.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const kept = await cache.match(url.pathname);
        if (kept) return kept;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") event.waitUntil(cache.put(url.pathname, res.clone()));
        return res;
      })(),
    );
  }
});

function readText(id) {
  return new Promise((resolve) => {
    let open;
    try {
      open = indexedDB.open("apex-reminders", 1);
    } catch (e) {
      resolve(null);
      return;
    }
    open.onupgradeneeded = () => open.result.createObjectStore("texts");
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      try {
        const db = open.result;
        const tx = db.transaction("texts", "readonly");
        const store = tx.objectStore("texts");
        const one = store.get(id);
        const fallback = store.get("_fallback");
        tx.oncomplete = () => resolve({ text: one.result || null, fallback: fallback.result || null });
        tx.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    };
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let id = null;
      try {
        id = event.data ? event.data.json().id : null;
      } catch (e) {
        id = null;
      }
      const found = id ? await readText(id) : null;
      const text = (found && found.text) || (found && found.fallback) || { title: "APEX", body: "", url: "/" };
      await self.registration.showNotification(text.title || "APEX", {
        body: text.body || "",
        tag: id || "apex",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: typeof text.url === "string" && text.url.startsWith("/") ? text.url : "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          if ("navigate" in w) {
            try {
              await w.navigate(url);
            } catch (e) {
              // a page from another origin cannot be steered; focusing it still helps
            }
          }
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
