import type { Colors } from "./tokens";

/**
 * The whole palette, drained of colour.
 *
 * This is focus mode. An app cannot turn a phone greyscale — that is a system
 * display setting and no app may touch it — but it can turn *itself* grey, and
 * because every colour in this app comes from one file, that is a transform
 * over a single object rather than a rewrite of ninety screens. The convention
 * that looked like bookkeeping (`a hex literal in a component is a bug`) is
 * what makes this a twenty-line file.
 *
 * Why bother: colour is what pulls attention. A violet button and a lime tick
 * are doing their job all day, and during the forty minutes somebody is
 * actually training they are doing it *against* the person — every glance at
 * the rest timer is an invitation to notice five other things. Grey removes
 * the invitation without removing the function.
 *
 * Luminance-preserving, so contrast survives: what was readable stays
 * readable, and the accessible-contrast suite is run against the grey palette
 * as well as the coloured one.
 */

/** The Rec. 709 luma weights — the same ones the contrast maths uses. */
function grey(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  // Weighted in linear light rather than on the raw bytes: averaging sRGB
  // directly darkens greens and lightens blues, which would quietly break the
  // contrast pairs this palette is built on.
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const back = y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055;
  const v = Math.max(0, Math.min(255, Math.round(back * 255)));
  const hexPair = v.toString(16).padStart(2, "0");
  return `#${hexPair}${hexPair}${hexPair}`;
}

/** Every token, greyed. Non-colour fields are left exactly as they are. */
export function desaturate(colors: Colors): Colors {
  const out = {} as Record<string, string>;
  for (const [key, value] of Object.entries(colors)) {
    out[key] = typeof value === "string" && value.startsWith("#") ? grey(value) : value;
  }
  return out as Colors;
}

/** Exposed for the suite, which checks the maths rather than trusting it. */
export { grey as greyOf };
