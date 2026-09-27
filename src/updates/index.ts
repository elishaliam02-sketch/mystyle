import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { AppState, Platform, TextInput } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * Updating the app from inside the app — automatically.
 *
 * A store release takes days to review and days more to reach the people who
 * have automatic updates off. An over-the-air update — the JavaScript, the
 * strings, the palette, the food library, every screen — reaches a phone
 * without anyone doing anything. Native code still needs a new build, which is
 * why `runtimeVersion` in app.json is tied to the app version: an update is
 * only ever handed to a build that can actually run it.
 *
 * How it arrives, with nobody pressing anything:
 *
 * - On every launch and every return to the app, the server is asked (a small
 *   request, at most once a minute). A new version downloads in the
 *   background.
 * - If it is down within a few seconds of the app being opened, the app
 *   restarts into it right away — the person has only just arrived, so
 *   nothing is interrupted. Everything they entered is saved on the phone
 *   and is there after the restart.
 * - If the download took longer (slow network), it waits and installs the
 *   next time the app is opened or brought back — never in the middle of use,
 *   and never while the keyboard is up.
 * - After an update the app says so once ("updated ✓"), so the person knows
 *   the new things are there.
 *
 * Never in development: `Updates.isEnabled` is false in Expo Go and in a dev
 * client, and on web the browser reloads the bundle by itself. Everything here
 * no-ops there rather than throwing. A check that cannot reach the network is
 * not an error worth a dialog; the app carries on with the version it has.
 */

/** The least time between two automatic checks. */
const MIN_GAP_MS = 60 * 1000;

/**
 * How long after the app is opened a finished download may still restart it
 * on the spot. Past this the person may be in the middle of something, so the
 * update waits for the next time the app is opened.
 */
const APPLY_WINDOW_MS = 12 * 1000;

/** The id of the downloaded update waiting to be installed. */
let pendingId: string | null = null;

export type UpdateState =
  /** Nothing to do — either up to date, or updates do not apply here. */
  | "idle"
  /** Asking the server whether there is something newer. */
  | "checking"
  /** There is, and it is coming down now. */
  | "downloading"
  /** Downloaded, waiting for a moment it can install without interrupting. */
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
 * got to. Installing is `checkAndApply`'s decision, not this function's.
 */
export async function fetchUpdate(): Promise<UpdateState> {
  if (!updatesSupported) return "idle";
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return "current";
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) pendingId = fetched.manifest?.id ?? null;
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

// One state for the whole app: the automatic checker in the root layout and
// every screen that shows it (the banner, the profile line) read the same one.
let shared: UpdateState = "idle";
const listeners = new Set<(s: UpdateState) => void>();
function setShared(next: UpdateState) {
  shared = next;
  for (const l of listeners) l(next);
}
let lastCheck = 0;
let busy = false;

/** Whether restarting now would throw away something being typed. */
function typing(): boolean {
  try {
    return TextInput.State.currentlyFocusedInput() != null;
  } catch {
    return false;
  }
}

const TRIED_KEY = "mystyle.updates.autoTried";

/**
 * Restarts into a downloaded update if nobody is mid-sentence. An update that
 * could not start (the phone fell back to the previous version) is not
 * restarted into again and again: two automatic tries per update, then it
 * waits for the next one.
 */
async function applyIfIdle(): Promise<boolean> {
  if (AppState.currentState !== "active" || typing()) return false;
  if (Updates.isEmergencyLaunch) return false;
  try {
    const raw = await AsyncStorage.getItem(TRIED_KEY);
    const tried = raw ? (JSON.parse(raw) as { id: string | null; n: number }) : null;
    const n = tried && tried.id === pendingId ? tried.n : 0;
    if (n >= 2) return false;
    await AsyncStorage.setItem(TRIED_KEY, JSON.stringify({ id: pendingId, n: n + 1 }));
  } catch {
    // Storage refused: still install — a missing counter is not a reason to
    // keep someone on an old version.
  }
  await applyUpdate();
  return true;
}

type Trigger = "launch" | "resume" | "manual";

/** Asks for an update, downloads it, and installs it when that is safe. */
export async function checkAndApply(trigger: Trigger): Promise<UpdateState> {
  if (!updatesSupported) {
    // A manual check on web or in Expo Go should still answer, rather than
    // leaving a button spinning forever.
    if (trigger === "manual") setShared("idle");
    return "idle";
  }
  // Already downloaded: this is the moment it was waiting for.
  if (shared === "ready") {
    if (trigger !== "launch") await applyIfIdle();
    return shared;
  }
  if (busy) return shared;
  const started = Date.now();
  if (trigger === "resume" && started - lastCheck < MIN_GAP_MS) return shared;

  busy = true;
  lastCheck = started;
  setShared("checking");
  const result = await fetchUpdate();
  busy = false;
  setShared(result);
  // Downloaded quickly after the app was opened (or the person asked): the
  // restart is part of opening the app, not an interruption.
  if (result === "ready" && (trigger === "manual" || Date.now() - started < APPLY_WINDOW_MS)) {
    await applyIfIdle();
  }
  return result;
}

/**
 * Mounted once, at the root: checks at launch and on every return to the
 * app, and installs what it finds.
 */
export function useAutoUpdates() {
  useEffect(() => {
    if (!updatesSupported) return;
    void checkAndApply("launch");
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void checkAndApply("resume");
    });
    return () => sub.remove();
  }, []);
}

const LAST_UPDATE_KEY = "mystyle.updates.lastId";

/**
 * True for the first launch after an update was installed — once, so the app
 * can say "updated ✓" and the person knows the new things are there.
 */
export function useJustUpdated(): boolean {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!updatesSupported) return;
    const id = Updates.isEmbeddedLaunch ? "embedded" : (Updates.updateId ?? "");
    if (!id) return;
    let alive = true;
    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(LAST_UPDATE_KEY);
        await AsyncStorage.setItem(LAST_UPDATE_KEY, id);
        // The very first launch has nothing to compare against: that is an
        // install, not an update.
        if (alive && seen && seen !== id && id !== "embedded") setFresh(true);
      } catch {
        // Storage refused: no "updated" note, nothing else lost.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return fresh;
}

/** What the screens show: the shared state and a manual check. */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>(shared);
  useEffect(() => {
    listeners.add(setState);
    setState(shared);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return {
    state,
    /** True once there is a downloaded update waiting to be installed. */
    ready: state === "ready",
    supported: updatesSupported,
    check: () => checkAndApply("manual"),
    apply: applyUpdate,
    running: runningVersion(),
  };
}
