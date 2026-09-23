import type { TextStyle } from "react-native";

/**
 * One palette, two grounds. Every colour used in the app comes from here —
 * a literal hex anywhere else is a bug, because it will only work in one theme.
 * Typing the record against Colors means a token added to light and forgotten
 * in dark fails the typecheck instead of shipping.
 *
 * THE FOUR COLOURS. The whole app is drawn with electric blue, vibrant orange,
 * neon lime and deep charcoal — nothing else. Greys are charcoal thinned or
 * lifted, so even the paper and the rules belong to the family. Each hue ships
 * in two weights: a `fill` value (the vivid one, for solid blocks) and an
 * `ink` value (the same hue, darkened or lifted until it clears 4.5:1 as text
 * on that theme's paper). Neon lime on white is unreadable at 1.3:1, which is
 * why `limeInk` exists — the hue survives, the legibility is not negotiable.
 * `src/theme/themetest.ts` measures every pairing and every hue, so a colour
 * that drifts out of the family or under the contrast bar fails a test.
 */
export type Colors = {
  ground: string;
  surface: string;
  surfaceAlt: string;
  /** The saturated block behind the top of a screen — the app's one strong
   * colour. Everything below it is quiet paper, so this is what makes the
   * page read as designed rather than as a list of boxes. */
  band: string;
  /** The two ends of the band's gradient — electric blue sunk into charcoal,
   * so the header reads as lit rather than flat. */
  bandTop: string;
  bandBottom: string;
  bandInk: string;
  bandInkSoft: string;
  bandRule: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  /** Electric blue — the primary action, and the colour of load: kilos on the
   * bar, volume, bodyweight, water. */
  accent: string;
  accentDeep: string;
  accentWash: string;
  /** A chart bar that is not the highlighted one. The wash is a background
   * tint and all but vanished on a dark card — a chart you cannot read. */
  chartBar: string;
  onAccent: string;
  /** Vibrant orange — time and intensity: the rest clock, session minutes,
   * pace, streaks, a personal best, calories. `orange` fills, `orangeInk`
   * writes. */
  /** The effort family: time and cost. It is not the brand — that is crimson —
   * so it needs a hue of its own, far from both. */
  azure: string;
  azureInk: string;
  azureWash: string;
  onAzure: string;
  orange: string;
  orangeInk: string;
  orangeWash: string;
  onOrange: string;
  /** Neon lime — counts and completion: reps, sets, steps, ticks, the day
   * score. Neon lime is a colour for dark ground: at 1.2:1 on white paper it
   * is a highlighter, not a mark. So `lime` fills only the charcoal surfaces
   * (the band, the hero, the dark theme); on paper the same hue appears as
   * `limeInk`, which both writes and fills, and carries `onLime`. */
  lime: string;
  limeInk: string;
  /** A third weight of lime, for the drawn tiles that need two stops of the
   * same hue without dropping all the way to charcoal. */
  limeDeep: string;
  /** Lime for a *mark* rather than for type: the logo stroke, an icon glyph.
   * A graphic clears the bar at 3:1 where text needs 4.5:1, so this sits a
   * step brighter than `limeInk` — which on paper is a text weight so dark it
   * reads as olive beside the violet, and made the lockup look muddy. */
  limeMark: string;
  limeWash: string;
  /** The ink that rides on a lime block — white on the paper-safe weight,
   * charcoal on the neon one. */
  onLime: string;
  /** Destructive. Orange carries it — there is no red in this app. */
  alert: string;
  alertDeep: string;
  /** The two ends of the hero gradient. Fixed deep blues rather than the
   * theme accent, because white sits on them in both themes. */
  heroFrom: string;
  heroTo: string;
  shadow: string;
};

/**
 * VOLT palette — electric blue, vibrant orange, neon lime, deep charcoal.
 * Charcoal carries the weight and the type; the three brights are spent only
 * on numbers that have to land in a glance, mid-set, at arm's length. Because
 * each metric family owns one hue for the life of the app (see
 * `src/theme/metrics.ts`), colour alone tells you what a figure is before you
 * have read its label.
 */
export const palette: Record<"light" | "dark", Colors> = {
  light: {
    ground: "#F4F3F8",
    surface: "#FFFFFF",
    surfaceAlt: "#E9E7F1",
    band: "#12121A",
    bandTop: "#2A0E6B",
    bandBottom: "#0B0B12",
    bandInk: "#FFFFFF",
    bandInkSoft: "#B3ADC8",
    bandRule: "#2E2A44",
    ink: "#13121A",
    inkSoft: "#565270",
    inkFaint: "#6E6A85",
    rule: "#E4E1EE",
    ruleStrong: "#C9C4DC",
    accent: "#6E2BFF",
    accentDeep: "#4A17C4",
    accentWash: "#EDE7FF",
    chartBar: "#C9B6FF",
    onAccent: "#FFFFFF",
    azure: "#0063C0",
    azureInk: "#0063C0",
    azureWash: "#E3F3FF",
    onAzure: "#FFFFFF",
    orange: "#FF5A1F",
    orangeInk: "#C23B00",
    orangeWash: "#FFEADF",
    onOrange: "#12121A",
    lime: "#C6FF3D",
    limeInk: "#4C7A00",
    limeDeep: "#3F6A00",
    limeMark: "#5E9400",
    limeWash: "#EEFFD2",
    onLime: "#FFFFFF",
    alert: "#C23B00",
    alertDeep: "#8A2900",
    heroFrom: "#7A3BFF",
    heroTo: "#3A0FA8",
    shadow: "#12121A",
  },
  dark: {
    ground: "#0B0B12",
    surface: "#15141F",
    surfaceAlt: "#1F1D2E",
    band: "#0B0B12",
    bandTop: "#2A0E6B",
    bandBottom: "#08080D",
    bandInk: "#F5F3FA",
    bandInkSoft: "#ADA6C4",
    bandRule: "#272338",
    ink: "#EDEAF6",
    inkSoft: "#A09AB8",
    inkFaint: "#837C9C",
    rule: "#262336",
    ruleStrong: "#3C3752",
    accent: "#9B6BFF",
    accentDeep: "#C3A6FF",
    accentWash: "#1B1338",
    chartBar: "#4B3A86",
    // Charcoal on a lifted violet, not white: a violet bright enough to read
    // on a black ground is too bright to carry white type.
    onAccent: "#08080D",
    azure: "#4FB2FF",
    azureInk: "#7CC6FF",
    azureWash: "#0A2236",
    onAzure: "#06131F",
    orange: "#FF8248",
    orangeInk: "#FFA275",
    orangeWash: "#2C1710",
    onOrange: "#12121A",
    lime: "#C6FF3D",
    limeInk: "#C6FF3D",
    limeDeep: "#7CB000",
    limeMark: "#C6FF3D",
    limeWash: "#182609",
    onLime: "#0B0B12",
    alert: "#FF7A44",
    alertDeep: "#E0621B",
    heroFrom: "#6A2BE0",
    heroTo: "#2E0B8A",
    shadow: "#000000",
  },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/**
 * Font families, not weights. Custom faces are loaded one file per weight, so
 * `fontWeight` does nothing here — the family name carries it.
 */
export const font = {
  display: "FrankRuhlLibre_800ExtraBold",
  displayMedium: "FrankRuhlLibre_500Medium",
  body: "Heebo_400Regular",
  bodyMedium: "Heebo_500Medium",
  bodyBold: "Heebo_700Bold",
  bodyBlack: "Heebo_800ExtraBold",
} as const;

export const type = {
  hero: { fontFamily: font.display, fontSize: 34, lineHeight: 42 },
  display: { fontFamily: font.display, fontSize: 26, lineHeight: 34 },
  title: { fontFamily: font.bodyBold, fontSize: 19, lineHeight: 26 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 25 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 16, lineHeight: 25 },
  small: { fontFamily: font.body, fontSize: 14, lineHeight: 21 },
  smallStrong: { fontFamily: font.bodyMedium, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  /** Big figures: weights, counts, percentages. */
  figure: { fontFamily: font.display, fontSize: 40, lineHeight: 46 },
} satisfies Record<string, TextStyle>;

/** Soft, low elevation. Cards should feel like paper, not like glass panels. */
export function elevation(colors: Colors, level: 1 | 2 = 1) {
  return {
    shadowColor: colors.shadow,
    shadowOpacity: level === 1 ? 0.08 : 0.14,
    shadowRadius: level === 1 ? 16 : 30,
    shadowOffset: { width: 0, height: level === 1 ? 6 : 14 },
    elevation: level === 1 ? 3 : 8,
  };
}

/** The one accent gradient the whole app leans on — crimson, lit-to-deep. */
export function accentGradient(colors: Colors): [string, string] {
  return [colors.accent, colors.accentDeep];
}

/**
 * The signature "hero" surface: crimson bleeding into charcoal, lit from one
 * corner. This is the app's one loud gesture — the day score, an intro, a
 * result. White text sits on it, and a red glow underneath lifts it clear off
 * the paper so a hero card feels like the front of a product, not a box.
 */
export function heroGradient(colors: Colors): [string, string, string] {
  return [colors.heroFrom, colors.heroTo, colors.bandBottom];
}

export function heroGlow(colors: Colors) {
  return {
    shadowColor: colors.heroFrom,
    shadowOpacity: 0.45,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  };
}
