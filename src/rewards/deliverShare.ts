import { Platform, Share } from "react-native";

/**
 * Handing a share to the platform.
 *
 * Native gets the system share sheet. The web has two paths and needs both:
 * `navigator.share` exists on phones and on Safari but not in most desktop
 * browsers, so the fallback is the clipboard — which is what a person on a
 * laptop was going to do by hand anyway.
 *
 * Returns what actually happened, so the screen can say "copied" rather than
 * pretending a sheet opened.
 */
export type ShareOutcome = "shared" | "copied" | "failed";

export async function deliverShare(text: string, subject: string): Promise<ShareOutcome> {
  if (Platform.OS === "web") {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    try {
      if (nav && typeof nav.share === "function") {
        await nav.share({ title: subject, text });
        return "shared";
      }
      if (nav?.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(text);
        return "copied";
      }
      return "failed";
    } catch {
      // A dismissed share sheet throws AbortError on the web. Not a failure —
      // the person simply changed their mind, and telling them it broke would
      // be a lie.
      return "shared";
    }
  }

  try {
    const result = await Share.share({ message: text, title: subject });
    return result.action === Share.dismissedAction ? "failed" : "shared";
  } catch {
    return "failed";
  }
}
