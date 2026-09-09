import { Alert, Platform } from "react-native";

/**
 * "Are you sure?", on every platform the app runs on.
 *
 * React Native's `Alert` has no implementation on web: the call does nothing,
 * no dialog appears, and — worse than an error — the confirmed action never
 * runs, so deleting a habit in a browser looked like a bug in the delete
 * button. The browser has its own modal confirm, which is the honest thing to
 * use there, so this picks the right one and gives both the same shape.
 *
 * `onConfirm` runs only when the person says yes. There is no "onCancel": a
 * cancel is the absence of the action, and every caller wanted it that way.
 */
export function confirm({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Colours the confirm red on iOS; on web there is nothing to colour. */
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS === "web") {
    // `window` is guarded because the same bundle is what server-renders the
    // static web export, where there is no window to ask.
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(message ? `${title}\n\n${message}` : title)
        : true;
    if (ok) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

/**
 * A one-button notice. Same reasoning as `confirm` — on web an `Alert.alert`
 * that says "restart the app to switch language" simply never appeared.
 */
export function notify(title: string, message?: string, okLabel = "OK"): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message, [{ text: okLabel }]);
}
