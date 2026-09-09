import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * Updating the app from inside the app.
 *
 * A store release takes days to review and days more to reach the people who
 * have automatic updates off. An over-the-air update — the JavaScript, the
 * strings, the palette, the food library, every screen — reaches a phone the
 * next time it is opened. Native code still needs a store build, which is why
 * `runtimeVersion` in app.json is tied to the app version: an update is only
 * ever handed to a build that can actually run it.
 *
 * The rules this follows:
 *
 * - Never interrupt. An update is fetched quietly in the background and then
 *   *offered*. Restarting the app under someone who is mid-set, mid-meal or
 *   mid-sentence is a good way to lose what they were writing.
 * - Never in development. `Updates.isEnabled` is false in Expo Go and in a dev
 *   client, and on web there is no update mechanism at all — the browser
 *   reloads the bundle by itself. Everything here no-ops there rather than
 *   throwing.
 * - Never spam the server. One check per launch and one per return from the
 *   background, and not more often than `MIN_GAP_MS`.
 * - Never fail loudly. A check that cannot reach the network is not an error
 *   worth a dialog; the app carries on with the version it has.
 */

/** The least time between two automatic checks. */
const MIN_GAP_MS = 15 * 60 * 1000;

export type UpdateState =
  /** Nothing to do — either up to date, or updates do not apply here. */
  | "idle"
  /** Asking the server whether there is something newer. */
  | "checking"
  /** There is, and it is coming down now. */
  | "downloading"
  /** Downloaded and waiting for the person to say when. */
  | "ready"
  /** Checked, and this is the newest version. */
  | "current"
  /** The check failed — offline, most likely. Not worth alarming anyone. */
  | "failed";

/** Whether over-the-air updates mean anything on this device and build. */
export const updatesSupported = Updates.isEnabled && Platform.OS !== "web";

/** What is running right now — for the "about" line in the profile screen. */
export function runningVersion(): {
  /** The store version, e.g. "0.1.0". */
  version: string;
  /** Which release channel this build follows, when it has one. */
  channel: string | null;
  /** The id of the over-the-air update in use, when it is not the built-in one. */
  updateId: string | null;
  /** True when this is the bundle that shipped inside the store build. */
  embedded: boolean;
} {
  return {
    // The store version comes from app.json, which is the same number on every
    // platform — `Updates.manifest` is null on web and in a bare dev client.
    version: Constants.expoConfig?.version ?? Updates.runtimeVersion ?? "",
    channel: Updates.channel ?? null,
    updateId: Updates.isEmbeddedLaunch ? null : Updates.updateId,
    embedded: Updates.isEmbeddedLaunch,
  };
}

/**
 * Checks for an update, downloads it if there is one, and reports where it
 * got to. Returns the state rather than acting on it: whether to restart is
 * the person's call, not this function's.
 */
export async function fetchUpdate(): Promise<UpdateState> {
  if (!updatesSupported) return "idle";
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return "current";
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew ? "ready" : "current";
  } catch {
    // Offline, or the update server is having a bad day. Neither is the
    // user's problem, and neither should reach their screen.
    return "failed";
  }
}

/** Restarts into the downloaded update. */
export async function applyUpdate(): Promise<void> {
  if (!updatesSupported) return;
  try {
    await Updates.reloadAsync();
  } catch {
    // If the reload is refused the app simply keeps running the old version,
    // and the update applies on the next cold start anyway.
  }
}

/**
 * The hook the screens use: checks once on mount, again whenever the app comes
 * back to the foreground, and exposes a manual check for the profile screen.
 */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>("idle");
  const lastCheck = useRef(0);
  const busy = useRef(false);
  const alive = useRef(true);
  // The foreground listener is installed once and keeps whatever closure it
  // was given, so the current state has to reach it through a ref rather than
  // through a dependency — otherwise the "already downloaded" guard below
  // would forever see the state as it was at mount.
  const current = useRef<UpdateState>(state);
  current.current = state;

  const run = useCallback(async (manual: boolean) => {
    if (!updatesSupported) {
      // A manual check on web or in Expo Go should still answer, rather than
      // leaving a button spinning forever.
      if (manual) setState("idle");
      return;
    }
    if (busy.current) return;
    const now = Date.now();
    if (!manual && now - lastCheck.current < MIN_GAP_MS) return;
    // An update already downloaded stays offered; re-checking would only
    // replace "restart to update" with "you are up to date", which is a lie.
    if (current.current === "ready") return;

    busy.current = true;
    lastCheck.current = now;
    setState("checking");
    const result = await fetchUpdate();
    if (alive.current) setState(result);
    busy.current = false;
  }, []);

  useEffect(() => {
    alive.current = true;
    void run(false);

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void run(false);
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, [run]);

  return {
    state,
    /** True once there is a downloaded update waiting for a restart. */
    ready: state === "ready",
    supported: updatesSupported,
    check: () => run(true),
    apply: applyUpdate,
    running: runningVersion(),
  };
}
