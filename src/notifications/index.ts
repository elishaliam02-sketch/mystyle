import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { diffSchedule, identifierOf, routeOf, type DatedReminder } from "./plan";

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

// One rebuild at a time, in the order asked: two overlapping diffs could each
// cancel what the other had just written.
let queue: Promise<void> = Promise.resolve();

/**
 * Brings the phone's schedule in line with `want`. Only the difference is
 * touched — ticking a habit cancels the one reminder it made pointless rather
 * than rewriting the lot — and anything pending that is not wanted goes,
 * which is what stops a removed habit, or a feature someone stopped using,
 * from going on firing.
 */
export function reschedule(want: DatedReminder[], enabled: boolean): Promise<void> {
  if (!available()) return Promise.resolve();
  queue = queue.then(async () => {
    try {
      if (!enabled) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        return;
      }
      const pending = (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
      const { cancel, add } = diffSchedule(pending, want);
      for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
      for (const r of add) {
        await Notifications.scheduleNotificationAsync({
          identifier: identifierOf(r),
          content: { title: r.title, body: r.body, data: { url: routeOf(r.id) } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
        });
      }
    } catch {
      // A device that refuses to schedule is not a reason to break the screen.
    }
  });
  return queue;
}

/**
 * Opens the screen a tapped reminder was about — the water tracker from the
 * water reminder, the recap from the recap — including when the tap is what
 * started the app. Returns the unsubscribe.
 */
export function onReminderTap(open: (url: string) => void): () => void {
  if (!available()) return () => {};
  let last = "";
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const key = `${response.notification.request.identifier}|${response.notification.date}`;
    if (key === last) return;
    last = key;
    const url = response.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) open(url);
  };
  try {
    handle(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
  } catch {
    // Older native module: the listener below still covers taps while running.
  }
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
