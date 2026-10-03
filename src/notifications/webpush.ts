import { Platform } from "react-native";
import { cloudConfigured, SUPABASE_URL } from "@/cloud/config";
import { ensureSession, supabase } from "@/cloud/client";
import type { DatedReminder } from "./plan";
import { routeOf } from "./plan";

/**
 * Reminders in the browser, by Web Push.
 *
 * A web page cannot wake itself at 15:00, so the server pushes — but it is
 * told only ids and times. The words go into this browser's own storage
 * (IndexedDB), where the service worker (public/sw.js) reads them when the
 * push lands. On an iPhone this needs the app opened from the home screen:
 * Safari in a tab has no push at all.
 */

const ENDPOINT = `${SUPABASE_URL}/functions/v1/push`;
const DB_NAME = "apex-reminders";

export type WebPushSupport = "ok" | "install" | "no";

/** Whether this browser can take reminders — or could, once installed. */
export function webPushSupport(): WebPushSupport {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof navigator === "undefined") return "no";
  if (!cloudConfigured) return "no";
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as { standalone?: boolean }).standalone === true;
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (capable) return "ok";
  return ios && !standalone ? "install" : "no";
}

/** Whether the browser itself still allows notifications from this site. */
export function webPushPermitted(): boolean {
  return webPushSupport() === "ok" && Notification.permission === "granted";
}

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function call(body: object, auth = true): Promise<Response | null> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) {
      const session = await ensureSession();
      if (!session.ok) return null;
      const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
      if (!token) return null;
      headers.Authorization = `Bearer ${token}`;
    }
    return await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    return null;
  }
}

export type EnableResult = "ok" | "denied" | "install" | "unavailable" | "failed";

/**
 * Turns reminders on in this browser. The permission prompt comes first and
 * straight from the tap — Safari ignores a prompt asked for after an await.
 */
export async function enableWebPush(): Promise<EnableResult> {
  const support = webPushSupport();
  if (support === "install") return "install";
  if (support !== "ok") return "unavailable";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const reg = await navigator.serviceWorker.register("/sw.js");
    // A browser whose service workers are switched off never gets "ready";
    // without a limit the switch would sit on "turning on…" for good.
    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]);
    if (!ready) return "unavailable";
    const keyRes = await call({ action: "key" }, false);
    if (!keyRes?.ok) return "unavailable";
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) return "unavailable";
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = keyBytes(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
    }
    const res = await call({ action: "subscribe", subscription: sub.toJSON() });
    return res?.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

/** Turns them off: this browser unsubscribes, and the server forgets the queue. */
export async function disableWebPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    // Already gone is as good as gone.
  }
  await call({ action: "unsubscribe" });
  await saveTexts([], null);
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("texts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Writes the words of the coming reminders where the service worker reads them. */
export async function saveTexts(items: DatedReminder[], fallback: { title: string; body: string } | null): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("texts", "readwrite");
      const store = tx.objectStore("texts");
      store.clear();
      for (const r of items) store.put({ title: r.title, body: r.body, url: routeOf(r.id) }, r.id);
      if (fallback) store.put({ ...fallback, url: "/" }, "_fallback");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Hands the coming reminders over: the words to this browser's storage, the
 * ids and times to the server. Returns whether the server took them.
 */
export async function pushSchedule(items: DatedReminder[], fallback: { title: string; body: string }): Promise<boolean> {
  await saveTexts(items, fallback);
  const res = await call({ action: "schedule", items: items.map((r) => ({ id: r.id, at: r.at.toISOString() })) });
  return !!res?.ok;
}
