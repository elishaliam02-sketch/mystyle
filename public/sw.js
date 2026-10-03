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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
