import { Platform } from "react-native";

/**
 * Small buttons get a finger-sized hit area on the web, as they already do in
 * the app.
 *
 * Icon buttons (the ✕ that closes a sheet, the bin beside a weigh-in, the star
 * on a recipe) are drawn 18–30 px and rely on `hitSlop` to be tappable. The
 * native app honours hitSlop; a browser does not, so on an iPhone using the
 * web app those buttons needed a fingertip landing within a few pixels. This
 * finds every button smaller than 44 px (Apple's minimum) and extends its hit
 * area with an invisible ::after — nothing moves, nothing changes colour.
 */
const MIN = 44;
const MAX_PAD = 14;
const SELECTOR = '[role="button"],[role="checkbox"],[role="switch"],[role="tab"],[role="link"],a[href],button';

let installed = false;

export function installTapTargets(): void {
  if (installed || Platform.OS !== "web" || typeof document === "undefined") return;
  installed = true;

  const style = document.createElement("style");
  // No position rule: every React Native Web view is already positioned
  // (relative, or absolute for a corner button), so the ::after anchors to it
  // and nothing about the layout changes.
  style.textContent =
    "[data-tap]::after{content:'';position:absolute;top:calc(var(--tap-y) * -1);bottom:calc(var(--tap-y) * -1);" +
    "left:calc(var(--tap-x) * -1);right:calc(var(--tap-x) * -1)}";
  document.head.appendChild(style);

  let queued = false;
  const pass = () => {
    queued = false;
    for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const x = Math.min(MAX_PAD, Math.max(0, Math.ceil((MIN - r.width) / 2)));
      const y = Math.min(MAX_PAD, Math.max(0, Math.ceil((MIN - r.height) / 2)));
      if (x === 0 && y === 0) {
        if (el.hasAttribute("data-tap")) el.removeAttribute("data-tap");
        continue;
      }
      el.setAttribute("data-tap", "");
      el.style.setProperty("--tap-x", `${x}px`);
      el.style.setProperty("--tap-y", `${y}px`);
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(pass);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  schedule();
}
