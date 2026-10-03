/**
 * Progress photos in the browser.
 *
 * The picker hands back a blob: link that dies with the tab, and a full-size
 * phone photo is several megabytes — more than the browser's whole storage
 * for this site once a few are kept. So the photo is redrawn small (the
 * longest side 720 px, JPEG) and kept as a data: link inside the app's own
 * saved state, on this device only, like every other progress photo.
 */

/** The longest side a stored web photo is drawn at. */
export const WEB_PHOTO_SIDE = 720;
/**
 * The most the saved state may weigh once a photo is added, in characters.
 * Browsers allow about five million per site; past this, a save of the whole
 * state could fail and take the day's ticks with it, so the photo is refused.
 */
export const WEB_STATE_BUDGET = 3_800_000;

/** The size to draw at: the same shape, the longest side at most `side`. */
export function fitWithin(width: number, height: number, side = WEB_PHOTO_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, side / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Whether a photo of this many characters still fits with the state saved. */
export function fitsBudget(stateChars: number, photoChars: number, budget = WEB_STATE_BUDGET): boolean {
  return stateChars + photoChars <= budget;
}

/** Redraws a picked image small and returns it as a JPEG data: link, or null. */
export async function shrinkPhoto(uri: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = uri;
    });
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    if (!width) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL("image/jpeg", 0.72);
    return out.startsWith("data:image/") ? out : null;
  } catch {
    return null;
  } finally {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
  }
}
