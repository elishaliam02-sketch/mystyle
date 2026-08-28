import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useStore } from "@/store";
import { available, hasPermission, requestPermission, reschedule, scheduledCount } from ".";

/**
 * Keeps the device's reminder schedule in step with the habits. Any change to
 * a habit rebuilds the schedule, so a removed habit stops reminding straight
 * away rather than at the end of the week.
 */
export function useReminders() {
  const { t } = useI18n();
  const { state, saveProfile } = useStore();
  const [count, setCount] = useState(0);
  const [denied, setDenied] = useState(false);

  const enabled = state.profile.reminders === true;
  const habits = state.habits;

  const copy = {
    slotTitle: t.reminders.slotTitle,
    recapTitle: t.reminders.recapTitle,
    recapBody: t.reminders.recapBody,
  };

  const refresh = useCallback(async () => {
    setCount(await scheduledCount());
  }, []);

  // The habit signature — not the array identity — is what should rebuild it.
  const signature = habits
    .filter((h) => !h.archived)
    .map((h) => `${h.id}:${h.slot ?? ""}:${h.title}`)
    .join("|");

  useEffect(() => {
    if (!available()) return;
    let cancelled = false;
    (async () => {
      if (enabled && !(await hasPermission())) {
        // Permission was revoked in system settings since it was switched on.
        if (!cancelled) {
          setDenied(true);
          saveProfile({ reminders: false });
        }
        return;
      }
      await reschedule(habits, copy, enabled);
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature]);

  const toggle = useCallback(async () => {
    if (enabled) {
      saveProfile({ reminders: false });
      return;
    }
    const granted = await requestPermission();
    setDenied(!granted);
    if (granted) saveProfile({ reminders: true });
  }, [enabled, saveProfile]);

  return { enabled, count, denied, supported: available(), toggle };
}
