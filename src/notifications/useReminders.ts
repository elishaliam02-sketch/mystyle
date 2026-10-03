import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState as AppLifecycle, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useI18n } from "@/i18n";
import { useStore } from "@/store";
import { available, hasPermission, onReminderTap, requestPermission, reschedule } from ".";
import { datedReminders, identifierOf, whenLabel, type ReminderCopy } from "./plan";
import { disableWebPush, enableWebPush, pushSchedule, webPushPermitted, webPushSupport, type EnableResult } from "./webpush";

const onWeb = Platform.OS === "web";

function useCopy(): ReminderCopy {
  const { t } = useI18n();
  return useMemo(
    () => ({
      slotTitle: t.reminders.slotTitle,
      slotOneTitle: t.reminders.slotOneTitle,
      recapTitle: t.reminders.recapTitle,
      recapBody: t.reminders.recapBody,
      trainTitle: t.reminders.trainTitle,
      trainBody: t.reminders.trainBody,
      waterTitle: t.reminders.waterTitle,
      waterBody: t.reminders.waterBody,
      foodTitle: t.reminders.foodTitle,
      foodBody: t.reminders.foodBody,
      stepsTitle: t.reminders.stepsTitle,
      stepsBody: t.reminders.stepsBody,
      weighTitle: t.reminders.weighTitle,
      weighBody: t.reminders.weighBody,
      measureTitle: t.reminders.measureTitle,
      measureBody: t.reminders.measureBody,
    }),
    [t],
  );
}

/** Bumps whenever the app comes back to the front — a new day, or a phone
 * left in a pocket since yesterday, moves the schedule's window forward. */
function useForegroundTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!available() && !onWeb) return;
    const sub = AppLifecycle.addEventListener("change", (s) => {
      if (s === "active") setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);
  return tick;
}

/**
 * Keeps the phone's reminders in step with the day, from anywhere in the app.
 *
 * Mounted once at the root rather than inside a settings screen: a habit added
 * before the profile tab was ever opened has to be reminded about too. What is
 * scheduled is today's unfinished business and the days ahead — water that is
 * already drunk, a recap already written or a workout already logged drops out
 * of today's list the moment it is done.
 */
export function ReminderSync() {
  const { t } = useI18n();
  const { state, ready, legalCurrent, saveProfile, setWebPush } = useStore();
  const router = useRouter();
  const copy = useCopy();
  const tick = useForegroundTick();
  // The phone app's switch syncs with the profile; a browser's is its own.
  const enabled = onWeb ? state.webPush === true : state.profile.reminders === true;

  const want = useMemo(
    () => (enabled ? datedReminders(state, copy, new Date()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, state, copy, tick],
  );
  // The words and the times, not the array identity, decide whether the phone
  // needs touching — most state changes leave the schedule exactly as it was.
  const signature = want.map(identifierOf).join("|");

  // The browser: the words to its own storage, the ids and times to the
  // server — a moment after the last change, so a run of ticks is one call.
  useEffect(() => {
    if (!onWeb || !ready || !enabled) return;
    if (!webPushPermitted()) {
      // Notifications were blocked in the browser since it was switched on.
      setWebPush(false);
      return;
    }
    const id = setTimeout(() => {
      void pushSchedule(want, { title: "APEX", body: t.reminders.fallbackBody });
    }, 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, signature]);

  useEffect(() => {
    if (!available() || !ready) return;
    let cancelled = false;
    (async () => {
      if (enabled && !(await hasPermission())) {
        // Permission was revoked in system settings since it was switched on.
        if (!cancelled) saveProfile({ reminders: false });
        return;
      }
      if (!cancelled) await reschedule(want, enabled);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, signature]);

  const canOpen = ready && state.profile.onboarded && legalCurrent();
  useEffect(() => {
    if (!canOpen) return;
    return onReminderTap((url) => router.push(url as never));
  }, [canOpen, router]);

  return null;
}

/** The settings switch, and what the next reminder will be. */
export function useReminders() {
  const { t } = useI18n();
  const { state, saveProfile, setWebPush } = useStore();
  const copy = useCopy();
  const tick = useForegroundTick();
  const [denied, setDenied] = useState(false);
  const [webResult, setWebResult] = useState<EnableResult | null>(null);
  const [busy, setBusy] = useState(false);
  const webSupport = onWeb ? webPushSupport() : "no";
  const enabled = onWeb ? state.webPush === true : state.profile.reminders === true;

  const next = useMemo(() => {
    if (!enabled) return null;
    const now = new Date();
    const first = datedReminders(state, copy, now)[0];
    if (!first) return null;
    return {
      title: first.title,
      when: whenLabel(first.at, now, {
        today: t.reminders.today,
        tomorrow: t.reminders.tomorrow,
        weekdays: t.calendar.weekdays,
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, state, copy, t, tick]);

  const toggle = useCallback(async () => {
    if (onWeb) {
      if (enabled) {
        setWebPush(false);
        setWebResult(null);
        void disableWebPush();
        return;
      }
      // Straight from the tap: Safari only shows its prompt to a gesture.
      setBusy(true);
      const result = await enableWebPush();
      setBusy(false);
      setWebResult(result);
      setDenied(result === "denied");
      if (result === "ok") setWebPush(true);
      return;
    }
    if (enabled) {
      saveProfile({ reminders: false });
      return;
    }
    const granted = await requestPermission();
    setDenied(!granted);
    if (granted) saveProfile({ reminders: true });
  }, [enabled, saveProfile, setWebPush]);

  return {
    enabled,
    next,
    denied,
    busy,
    /** On the web: the last attempt went wrong in a way worth saying. */
    failed: webResult === "failed" || webResult === "unavailable",
    supported: onWeb ? webSupport === "ok" : available(),
    /** An iPhone browser tab: reminders need the app on the home screen first. */
    needsInstall: onWeb && webSupport === "install",
    web: onWeb,
    toggle,
  };
}
