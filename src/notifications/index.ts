import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { AppState } from "@/store/types";
import { planReminders, type ReminderCopy } from "./plan";

/**
 * Local reminders. Not push: everything is scheduled on the device from the
 * user's own habits, so it needs no server and costs nothing.
 *
 * Web cannot schedule these, so every function is a no-op there — the settings
 * screen reads `available()` and says so rather than offering a dead switch.
 */

export const available = () => Platform.OS !== "web";

export function configure() {
  if (!available()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Asks once. Returns whether reminders may be scheduled. */
export async function requestPermission(): Promise<boolean> {
  if (!available()) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function hasPermission(): Promise<boolean> {
  if (!available()) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Rebuilds the whole schedule from the current state. Called after any change
 * to habits or the setting — cancelling everything first is what stops a
 * removed habit, or a feature someone stopped using, from going on firing.
 */
export async function reschedule(state: AppState, copy: ReminderCopy, enabled: boolean) {
  if (!available()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;

    for (const r of planReminders(state, copy)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger:
          r.weekday === undefined
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: r.hour,
                minute: r.minute,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: r.weekday,
                hour: r.hour,
                minute: r.minute,
              },
      });
    }
  } catch {
    // A device that refuses to schedule is not a reason to break the screen.
  }
}

/** How many reminders are currently set — shown in settings so it is checkable. */
export async function scheduledCount(): Promise<number> {
  if (!available()) return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
