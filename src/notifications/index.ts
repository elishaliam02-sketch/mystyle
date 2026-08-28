import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Habit } from "@/store/types";

/**
 * Local reminders. Not push: everything is scheduled on the device from the
 * user's own habits, so it needs no server and costs nothing.
 *
 * Web cannot schedule these, so every function is a no-op there — the settings
 * screen reads `available()` and says so rather than offering a dead switch.
 */

export const available = () => Platform.OS !== "web";

/** When each part of the day fires, in local time. */
const SLOT_HOUR: Record<NonNullable<Habit["slot"]>, number> = {
  morning: 8,
  noon: 13,
  evening: 19,
};
/** Habits with no time of day ride with the morning group. */
const DEFAULT_HOUR = 9;
const RECAP_HOUR = 21;
const RECAP_MINUTE = 30;

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

type Copy = {
  slotTitle: string;
  recapTitle: string;
  recapBody: string;
};

/**
 * Rebuilds the whole schedule from the current habits. Called after any change
 * to habits or the setting — cancelling everything first is what stops a
 * removed habit from going on firing for a week.
 */
export async function reschedule(habits: Habit[], copy: Copy, enabled: boolean) {
  if (!available()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;

    const active = habits.filter((h) => !h.archived);
    if (active.length === 0) return;

    // One reminder per part of the day, naming that part's habits. Three quiet
    // nudges beat one per habit, which is how an app gets muted.
    const groups = new Map<number, Habit[]>();
    for (const habit of active) {
      const hour = habit.slot ? SLOT_HOUR[habit.slot] : DEFAULT_HOUR;
      groups.set(hour, [...(groups.get(hour) ?? []), habit]);
    }

    for (const [hour, list] of groups) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.slotTitle.replace("{count}", String(list.length)),
          body: list.map((h) => h.title).join(" · ").slice(0, 140),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: { title: copy.recapTitle, body: copy.recapBody },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: RECAP_HOUR,
        minute: RECAP_MINUTE,
      },
    });
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
