import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { SUPABASE_URL, cloudConfigured } from "@/cloud/config";

/**
 * Knowing whether there is a connection — and saying so.
 *
 * What an app cannot do, and this one does not pretend to: join a Wi-Fi
 * network. Both platforms reserve that for the system. iOS needs a hotspot
 * entitlement Apple grants to routers and hardware companions, and Android
 * hands the choice to its own network panel. An app that claimed otherwise
 * would be a settings screen that silently does nothing.
 *
 * What it can do is the part people actually want: notice that the *server*
 * cannot be reached, say so rather than looking broken, sync the moment it
 * comes back, and put the device's own network settings one tap away. Note
 * what that is not: a judgement about Wi-Fi. Mobile data is a connection like
 * any other, and nothing here asks which one is in use.
 *
 * Deliberately built without a native connectivity module. Adding one would
 * mean a store rebuild before anybody saw the feature, and the question this
 * asks is narrower than "is there a network" anyway: *can we reach the server
 * we sync with*. A phone on hotel Wi-Fi that has not signed into the captive
 * portal reports a perfectly good connection and can reach nothing at all.
 *
 * It never probes unless cloud sync is switched on. With it off there is
 * nothing to reach, and a reachability ping would be exactly the kind of quiet
 * traffic the consent gate exists to prevent.
 */

export type Reachability =
  /** Not asked — sync is off, so the answer does not matter. */
  | "unknown"
  /** Asking right now. */
  | "checking"
  | "online"
  | "offline";

/**
 * How long a probe may take before it counts as a failure.
 *
 * Generous on purpose. Six seconds was not: a first request over mobile data
 * has to wake the radio, resolve DNS and complete a TLS handshake, and on a
 * weak signal that alone can outlast a short timeout — so the app declared
 * "no internet" to people who were online and downloading fine.
 */
const PROBE_TIMEOUT_MS = 12_000;
/**
 * One failed probe is not proof of anything. A single dropped packet, a radio
 * waking up, a server hiccup — the app waits for two failures in a row before
 * telling someone their connection is gone, and the first retry comes quickly
 * so a real outage is still reported within a few seconds.
 */
const FAILURES_BEFORE_OFFLINE = 2;
const FIRST_RETRY_MS = 4000;
/** How often to look again once offline. Nothing is sent while online. */
const RETRY_MS = 20_000;

/** The endpoint is irrelevant beyond "the server answers at all". */
const PROBE_URL = `${SUPABASE_URL}/auth/v1/health`;

/**
 * One reachability check. Any answer at all — including a refusal — means the
 * network works; only a transport failure or a timeout means it does not.
 *
 * An unconfigured project answers `null`, not `false`: "there is no server to
 * reach" is not "you have no connection", and reporting the second would put a
 * no-internet banner in front of someone whose internet is perfectly fine.
 */
export async function probe(): Promise<boolean | null> {
  if (!cloudConfigured) return null;
  const timer = new AbortController();
  const cancel = setTimeout(() => timer.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(PROBE_URL, { method: "GET", signal: timer.signal, cache: "no-store" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(cancel);
  }
}

/** Whether this platform can show the person their network settings. */
export const canOpenNetworkSettings = Platform.OS !== "web";

/**
 * Opens the device's own network settings.
 *
 * Android gets the "Network & internet" screen, not the Wi-Fi panel: plenty of
 * people are on mobile data by choice, and dropping them into a list of Wi-Fi
 * networks reads as "this app wants Wi-Fi", which it does not. iOS has no
 * public URL for network settings (the one that circulates is a private scheme
 * and a known rejection reason), so it opens this app's own settings page,
 * where iOS keeps the cellular-data switch for each app.
 */
export async function openNetworkSettings(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.WIRELESS_SETTINGS");
      return;
    }
    await Linking.openSettings();
  } catch {
    // A locked-down launcher can refuse; there is nothing useful to say.
  }
}

/**
 * Tracks reachability while `enabled`. On the web the browser already knows,
 * and says so without a single byte crossing the network; on a phone it is a
 * probe, repeated only while the answer is "offline".
 */
export function useConnectivity(enabled: boolean) {
  const [state, setState] = useState<Reachability>("unknown");
  const alive = useRef(true);
  const busy = useRef(false);
  /** Consecutive failed probes. Reset by any answer at all. */
  const failures = useRef(0);

  const check = useCallback(async () => {
    if (!enabled) {
      setState("unknown");
      return;
    }
    if (Platform.OS === "web") {
      // navigator.onLine is only ever a hint, but it is a free one, and on the
      // web a failed fetch is indistinguishable from a blocked one anyway.
      const on = typeof navigator === "undefined" || navigator.onLine !== false;
      setState(on ? "online" : "offline");
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setState((s) => (s === "unknown" ? "checking" : s));
    const reachable = await probe();
    busy.current = false;
    if (!alive.current) return;

    if (reachable === null) {
      // No server configured. Nothing to be offline from.
      failures.current = 0;
      setState("unknown");
      return;
    }
    if (reachable) {
      failures.current = 0;
      setState("online");
      return;
    }
    failures.current += 1;
    // Hold the previous answer until the failure repeats: a banner that
    // flickers on every dropped packet teaches people to ignore banners.
    if (failures.current >= FAILURES_BEFORE_OFFLINE) setState("offline");
    else setState((s) => (s === "online" ? "online" : "checking"));
  }, [enabled]);

  useEffect(() => {
    alive.current = true;
    void check();

    const subs: { remove: () => void }[] = [];
    subs.push(AppState.addEventListener("change", (next) => {
      if (next === "active") void check();
    }));

    let web: (() => void) | null = null;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onChange = () => void check();
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      web = () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    }

    return () => {
      alive.current = false;
      for (const sub of subs) sub.remove();
      web?.();
    };
  }, [check]);

  // Look again after a failure — quickly the first time, so a blip clears in
  // seconds and a real outage is still confirmed fast, then slowly while it
  // stays down. Nothing is sent while online: there is nothing to learn.
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    if (state !== "offline" && state !== "checking") return;
    const gap = state === "offline" ? RETRY_MS : FIRST_RETRY_MS;
    const id = setInterval(() => void check(), gap);
    return () => clearInterval(id);
  }, [enabled, state, check]);

  return {
    state,
    online: state === "online",
    offline: state === "offline",
    recheck: check,
  };
}
