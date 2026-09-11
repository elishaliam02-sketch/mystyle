/**
 * The palette, measured rather than eyeballed.
 *
 * Two promises are made about colour in this app and both are cheap to break
 * by hand: that every colour belongs to one of the four brand hues, and that
 * anything written on anything else clears the WCAG AA bar (4.5:1 for text,
 * 3:1 for a mark or a rule). This suite measures the shipped tokens, so a
 * "just this once" hex or a bright that has drifted out of contrast fails a
 * test instead of shipping.
 */

import { palette, type Colors } from "./tokens";
import { desaturate } from "./grayscale";
import { METRIC_FAMILY, metricFill, metricInk, metricWash, onMetric, type Metric } from "./metrics";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

type Rgb = { r: number; g: number; b: number };

function rgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const { r, g, b } = rgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Hue in degrees, and HSL saturation — enough to place a colour in a family. */
function hsl(hex: string): { hue: number; sat: number; light: number } {
  const { r, g, b } = rgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const light = (max + min) / 2;
  if (d === 0) return { hue: 0, sat: 0, light };
  const sat = d / (1 - Math.abs(2 * light - 1));
  let hue: number;
  if (max === rn) hue = 60 * (((gn - bn) / d + 6) % 6);
  else if (max === gn) hue = 60 * ((bn - rn) / d + 2);
  else hue = 60 * ((rn - gn) / d + 4);
  return { hue, sat, light };
}

/**
 * The four colours, as bands rather than points: a hue may be darkened for
 * legibility or thinned into a wash, but it may not wander into a new hue.
 * Charcoal is the neutral, so anything desaturated counts as charcoal.
 */
const HUE_BANDS: [string, number, number][] = [
  ["electric violet", 232, 278],
  ["azure", 195, 231],
  ["volt lime", 70, 95],
  ["hot orange", 12, 42],
];

function family(hex: string): string | null {
  const { hue, sat } = hsl(hex);
  if (sat < 0.1) return "deep charcoal";
  for (const [name, lo, hi] of HUE_BANDS) if (hue >= lo && hue <= hi) return name;
  return null;
}

for (const scheme of ["light", "dark"] as const) {
  const c = palette[scheme];

  // Every token is one of the four colours — no fifth hue, ever.
  {
    const strays = (Object.entries(c) as [keyof Colors, string][])
      .filter(([, hex]) => family(hex) === null)
      .map(([k, hex]) => `${k}=${hex} (${Math.round(hsl(hex).hue)}°)`);
    check(`${scheme}: every token belongs to a named hue`, strays.length === 0, strays.join(", "));
  }

  // Each bright is present, and is the hue it claims to be.
  check(`${scheme}: accent is electric violet`, family(c.accent) === "electric violet", c.accent);
  check(`${scheme}: azure is azure`, family(c.azure) === "azure", c.azure);
  check(`${scheme}: orange is hot orange`, family(c.orange) === "hot orange", c.orange);
  check(`${scheme}: lime is volt lime`, family(c.lime) === "volt lime", c.lime);
  // Charcoal is judged by chroma, not saturation: a near-white ink reads as
  // highly "saturated" in HSL while carrying almost no colour at all.
  const chroma = (hex: string) => {
    const { r, g, b } = rgb(hex);
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  };
  check(`${scheme}: ink is deep charcoal`, chroma(c.ink) < 0.06, c.ink);

  // Body text on every ground it can land on.
  const TEXT: [string, string, string][] = [
    ["ink on ground", c.ink, c.ground],
    ["ink on surface", c.ink, c.surface],
    ["ink on surfaceAlt", c.ink, c.surfaceAlt],
    ["inkSoft on ground", c.inkSoft, c.ground],
    ["inkSoft on surface", c.inkSoft, c.surface],
    ["inkFaint on surface", c.inkFaint, c.surface],
    ["bandInk on band", c.bandInk, c.band],
    ["bandInk on bandTop", c.bandInk, c.bandTop],
    ["bandInkSoft on band", c.bandInkSoft, c.band],
    ["onAccent on accent", c.onAccent, c.accent],
    ["onAccent on accentDeep", c.onAccent, c.accentDeep],
    ["onAccent on alert", c.onAccent, c.alert],
    ["onOrange on orange", c.onOrange, c.orange],
    ["onLime on limeInk", c.onLime, c.limeInk],
    ["accent on surface", c.accent, c.surface],
    ["accent on ground", c.accent, c.ground],
    ["accent on accentWash", c.accent, c.accentWash],
    ["orangeInk on surface", c.orangeInk, c.surface],
    ["orangeInk on ground", c.orangeInk, c.ground],
    ["orangeInk on orangeWash", c.orangeInk, c.orangeWash],
    ["limeInk on surface", c.limeInk, c.surface],
    ["limeInk on ground", c.limeInk, c.ground],
    ["limeInk on limeWash", c.limeInk, c.limeWash],
    ["alert on surface", c.alert, c.surface],
  ];
  for (const [name, fg, bg] of TEXT) {
    const ratio = contrast(fg, bg);
    check(`${scheme}: ${name} clears 4.5:1`, ratio >= 4.5, ratio.toFixed(2));
  }

  // Marks and rules: a filled bar, a ring, a dot — 3:1 is the bar for those.
  // Marks and rules: a filled bar, a ring, a dot. Neon lime is deliberately
  // absent from the paper list — it is a colour for charcoal ground, which is
  // why `metricFill` hands out `limeInk` on a light theme instead. Hairlines
  // and dividers are decoration and carry no contrast requirement.
  const MARKS: [string, string, string][] = [
    ["limeInk fill on surface", c.limeInk, c.surface],
    // The logo's lime, which is a graphic and not type.
    ["limeMark on surface", c.limeMark, c.surface],
    ["limeMark on ground", c.limeMark, c.ground],
    ["limeInk fill on ground", c.limeInk, c.ground],
    ["orange fill on surface", c.orange, c.surface],
    ["accent fill on surface", c.accent, c.surface],
    ["lime on band", c.lime, c.band],
    ["lime on bandBottom", c.lime, c.bandBottom],
    ["orange on band", c.orange, c.band],
    ["accent on band", c.accent, c.band],
  ];
  for (const [name, fg, bg] of MARKS) {
    const ratio = contrast(fg, bg);
    check(`${scheme}: ${name} clears 3:1`, ratio >= 3, ratio.toFixed(2));
  }

  // White is what the hero gradient carries, at both ends.
  for (const stop of [c.heroFrom, c.heroTo, c.bandBottom]) {
    const ratio = contrast("#FFFFFF", stop);
    check(`${scheme}: white on hero stop ${stop}`, ratio >= 4.5, ratio.toFixed(2));
  }

  // The three metric families must be told apart at a glance: no two of them
  // may resolve to near-identical inks.
  const inks = ["load", "reps", "duration"].map((m) => metricInk(c, m as Metric));
  for (let i = 0; i < inks.length; i++) {
    for (let j = i + 1; j < inks.length; j++) {
      const { hue: h1 } = hsl(inks[i]);
      const { hue: h2 } = hsl(inks[j]);
      const apart = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      check(`${scheme}: metric inks ${inks[i]} / ${inks[j]} are hues apart`, apart >= 40, String(Math.round(apart)));
    }
  }

  // Every metric, whichever family it belongs to, is legible on paper and on
  // its own fill — the whole point of the mapping.
  for (const metric of Object.keys(METRIC_FAMILY) as Metric[]) {
    const onPaper = contrast(metricInk(c, metric), c.surface);
    check(`${scheme}: ${metric} ink reads on paper`, onPaper >= 4.5, onPaper.toFixed(2));
    const onFill = contrast(onMetric(c, metric), metricFill(c, metric));
    check(`${scheme}: ${metric} fill carries its ink`, onFill >= 4.5, onFill.toFixed(2));
    const onWash = contrast(metricInk(c, metric), metricWash(c, metric));
    check(`${scheme}: ${metric} ink reads on its wash`, onWash >= 4.5, onWash.toFixed(2));
  }
}

// --- focus mode: the same palette with the colour taken out
//
// Grey that cannot be read is worse than colour, so the accessible-contrast
// bar applies to the drained palette exactly as it does to the real one. The
// conversion is luminance-preserving for this reason: what was readable has
// to stay readable, and three hues collapsing onto the same grey would make
// the metric families indistinguishable rather than merely quiet.
for (const scheme of ["light", "dark"] as const) {
  const c = desaturate(palette[scheme]);

  check(`${scheme} focus: every token is a true grey`,
    (Object.values(c) as string[]).every((hex) => {
      if (!hex.startsWith("#") || hex.length !== 7) return true;
      return hex[1] === hex[3] && hex[3] === hex[5] && hex[2] === hex[4] && hex[4] === hex[6];
    }),
    (Object.entries(c) as [string, string][]) 
      .filter(([, hex]) => hex.startsWith("#") && hex.length === 7 && !(hex[1] === hex[3] && hex[3] === hex[5]))
      .map(([k]) => k).join(","));

  const FOCUS_TEXT: [string, string, string][] = [
    ["ink on ground", c.ink, c.ground],
    ["ink on surface", c.ink, c.surface],
    ["inkSoft on surface", c.inkSoft, c.surface],
    ["inkFaint on surface", c.inkFaint, c.surface],
    ["bandInk on band", c.bandInk, c.band],
    ["onAccent on accent", c.onAccent, c.accent],
    ["onLime on limeInk", c.onLime, c.limeInk],
    ["onOrange on orange", c.onOrange, c.orange],
    ["onAzure on azure", c.onAzure, c.azure],
  ];
  for (const [name, fg, bg] of FOCUS_TEXT) {
    const ratio = contrast(fg, bg);
    check(`${scheme} focus: ${name} still clears 4.5:1`, ratio >= 4.5, ratio.toFixed(2));
  }

  // Grey drains the hue but must not flatten the levels: a filled bar has to
  // stay visible against the surface it sits on.
  for (const [name, fill] of [["accent", c.accent], ["orange", c.orange], ["limeInk", c.limeInk]] as const) {
    const ratio = contrast(fill, c.surface);
    check(`${scheme} focus: a ${name} fill is still visible`, ratio >= 3, ratio.toFixed(2));
  }
}

// Light and dark are the same contract: a token added to one and forgotten in
// the other is a typecheck failure, but a *renamed* one would slip through.
{
  const l = Object.keys(palette.light).sort().join(",");
  const d = Object.keys(palette.dark).sort().join(",");
  check("light and dark carry the same tokens", l === d);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
