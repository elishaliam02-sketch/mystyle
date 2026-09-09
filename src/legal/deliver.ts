import { Platform, Share } from "react-native";

/**
 * Handing the export to the platform.
 *
 * Deliberately built with what is already installed — the web gets a real file
 * download, a phone gets the system share sheet. Reaching for
 * expo-file-system would mean a native rebuild before anyone could use the
 * feature, and a portability right that waits for a store review is not much
 * of a right.
 */

/**
 * Hands the file over. Returns false when the platform refused (a browser
 * blocking the download, a share sheet dismissed) so the screen can say
 * something rather than looking like it worked.
 */
export async function deliverExport(json: string, filename: string): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return false;
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in some browsers; a tick
      // later is enough and still leaks nothing.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const result = await Share.share({ message: json, title: filename });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
