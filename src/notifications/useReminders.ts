import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useStore } from "@/store";
import { available, hasPermission, requestPermission, reschedule, scheduledCount } from ".";

/**
 * Keeps the device's reminder schedule in step with what the person actually
 * uses. Any change to a habit — or the first time they log water, food, steps,
 * a measurement or a training plan — rebuilds the schedule, so a removed habit
 * stops reminding straight away rather than at the end of the week, and a
 * feature nobody touches never sends anything at all.
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
  };

  const refresh = useCallback(async () => {
    setCount(await scheduledCount());
  }, []);

  // The habit signature — not the array identity — is what should rebuild it.
  // What the schedule actually depends on: the habits, and whether each of the
  // other features has been used at all. Rebuilding on every state change would
  // re-register the whole schedule after every tick of a checkbox.
  const signature = [
    habits.filter((h) => !h.archived).map((h) => `${h.id}:${h.slot ?? ""}:${h.title}`).join("|"),
    Object.keys(state.intake ?? {}).length > 0 ? "food" : "",
    Object.keys({ ...state.water, ...state.waterMl }).length > 0 ? "water" : "",
    state.training ? "train" : "",
    Object.keys(state.steps ?? {}).length > 0 ? "steps" : "",
    Object.keys(state.measurements ?? {}).length > 0 ? "measure" : "",
    state.weighIns.length > 0 || state.profile.goalKg ? "weigh" : "",
  ].join("#");

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
      await reschedule(state, copy, enabled);
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
