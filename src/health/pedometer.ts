/**
 * Automatic step counting, off the phone's own motion sensor.
 *
 * Typing in a step count is a bad ask — nobody actually knows what they walked.
 * So the app counts for itself wherever the phone lets it:
 *
 *  - iOS keeps a queryable history, so the true total for today is read
 *    straight out of it and refreshed while the screen is open.
 *  - Android exposes only a live counter (steps since you subscribed), so the
 *    app watches it and adds what it sees to today's tally as you walk.
 *
 * Everything is wrapped: no sensor, no permission, a browser, or an older phone
 * all degrade to "unavailable", and the screen falls back to typing a number.
 * Nothing here can throw into a render.
 */
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";

export type AutoStepsState = {
  /** Whether the phone can count steps for this person at all. */
  available: boolean;
  /** True once permission is granted and counting is actually running. */
  running: boolean;
};

/** Local midnight for the device, as a Date — the start of "today"'s steps. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Counts steps automatically.
 *
 * @param onTotal  Called with the true total for today (iOS): replaces the count.
 * @param onDelta  Called with newly-walked steps (Android): adds to the count.
 * @param enabled  Pass false to stand down (e.g. while the screen is hidden).
 */
export function useAutoSteps(opts: {
  onTotal: (steps: number) => void;
  onDelta: (steps: number) => void;
  enabled?: boolean;
}): AutoStepsState {
  const { onTotal, onDelta, enabled = true } = opts;
  const [available, setAvailable] = useState(false);
  const [running, setRunning] = useState(false);
  // Held in refs so changing handlers never restart the subscription.
  const totalRef = useRef(onTotal);
  const deltaRef = useRef(onDelta);
  totalRef.current = onTotal;
  deltaRef.current = onDelta;

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    // What the live Android counter last reported, so only the new steps are added.
    let lastSeen = 0;
    // Steps seen but not yet handed over, so the store isn't written per step.
    let pending = 0;

    (async () => {
      try {
        const ok = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(ok);
        if (!ok) return;

        const perm = await Pedometer.requestPermissionsAsync().catch(() => null);
        if (cancelled) return;
        if (perm && perm.granted === false) return;

        // iOS: ask for the real total for today, and keep it fresh.
        if (Platform.OS === "ios") {
          const read = async () => {
            try {
              const res = await Pedometer.getStepCountAsync(startOfToday(), new Date());
              if (!cancelled && res && Number.isFinite(res.steps)) totalRef.current(res.steps);
            } catch {
              // a denied permission mid-flight; nothing to do
            }
          };
          await read();
          if (cancelled) return;
          poll = setInterval(read, 30_000);
          setRunning(true);
          return;
        }

        // Android: only a live counter. Add what it reports as it climbs, in
        // small batches so a walk doesn't write to storage on every step.
        subscription = Pedometer.watchStepCount((result) => {
          const total = Number(result?.steps ?? 0);
          if (!Number.isFinite(total)) return;
          const delta = total - lastSeen;
          lastSeen = total;
          if (delta <= 0) return;
          pending += delta;
          if (pending >= 10) {
            const send = pending;
            pending = 0;
            deltaRef.current(send);
          }
        });
        setRunning(true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      // Hand over whatever was counted but not yet flushed, so leaving the
      // screen mid-walk doesn't drop those steps.
      if (pending > 0) {
        try {
          deltaRef.current(pending);
        } catch {
          // the screen is going away; nothing to report to
        }
        pending = 0;
      }
      if (poll) clearInterval(poll);
      subscription?.remove();
      setRunning(false);
    };
  }, [enabled]);

  return { available, running };
}
