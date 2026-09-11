import { Linking, Platform } from "react-native";

/**
 * Focus mode — and an honest account of what an app is allowed to do.
 *
 * What was asked for: block distracting apps, and turn the phone greyscale
 * during a workout. Neither is something an app may do to a phone.
 *
 * - **Blocking other apps** is reserved by both platforms. iOS puts it behind
 *   the Screen Time entitlement, which Apple grants to parental-control
 *   products after review; Android needs accessibility or usage-access
 *   permissions that Google Play restricts to apps whose core purpose is
 *   exactly that, and rejects for anything else. An app that claimed to do it
 *   would either be lying or be removed from the store.
 * - **System greyscale** is a display setting. No public API sets it.
 *
 * What is real, and what this does instead:
 *
 * - The app turns *itself* grey (`desaturate` in `src/theme/grayscale.ts`), so
 *   the thing in your hand during a set stops competing for attention.
 * - It opens the phone's own Do Not Disturb settings, which is the switch that
 *   actually silences the distracting apps — one tap, and it is the person's
 *   own decision rather than software taking their phone away.
 * - It points at the system colour filter for anyone who wants the whole
 *   screen grey, with the exact path, because it is four levels deep in
 *   Settings and nobody finds it by accident.
 */

/** After this long, a forgotten focus session reads as over. */
export const FOCUS_MAX_MS = 4 * 60 * 60 * 1000;

/** Whether this platform has settings worth linking to. */
export const canOpenPhoneSettings = Platform.OS !== "web";

/**
 * The phone's Do Not Disturb settings — the real "block the distractions"
 * switch, owned by the person rather than by this app.
 */
export async function openDoNotDisturb(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.ZEN_MODE_SETTINGS");
      return;
    }
    // iOS has no public URL for Focus settings; the schemes that circulate are
    // private API and a documented rejection reason. The app's own settings
    // page is the nearest legitimate door.
    await Linking.openSettings();
  } catch {
    // A locked-down device can refuse. Nothing useful to say about it.
  }
}

/** The accessibility screen, where the system-wide colour filter lives. */
export async function openColourFilters(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS");
      return;
    }
    await Linking.openSettings();
  } catch {
    // As above.
  }
}
