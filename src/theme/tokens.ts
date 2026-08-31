import type { TextStyle } from "react-native";

/**
 * One palette, two grounds. Every colour used in the app comes from here —
 * a literal hex anywhere else is a bug, because it will only work in one theme.
 * Typing the record against Colors means a token added to light and forgotten
 * in dark fails the typecheck instead of shipping.
 *
 * The ground is warm paper rather than cold grey: this is a page someone
 * returns to every morning, not a dashboard.
 */
export type Colors = {
  ground: string;
  surface: string;
  surfaceAlt: string;
  /** The saturated block behind the top of a screen — the app's one strong
   * colour. Everything below it is quiet paper, so this is what makes the
   * page read as designed rather than as a list of boxes. */
  band: string;
  bandInk: string;
  bandInkSoft: string;
  bandRule: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accentDeep: string;
  accentWash: string;
  onAccent: string;
  /** Streaks, energy, "this is going well". */
  amber: string;
  amberWash: string;
  signal: string;
  signalWash: string;
  alert: string;
  shadow: string;
};

/**
 * APEX palette. A premium graphite-navy band carries the top of each screen —
 * the one deep, confident colour — with a vivid emerald as the accent (energy,
 * health, "go") and amber for streaks and momentum. Navy paired with emerald
 * reads as strong and modern rather than clinical, and every ink/ground pairing
 * clears the accessible-contrast bar in both themes.
 */
export const palette: Record<"light" | "dark", Colors> = {
  light: {
    ground: "#F4F6F8",
    surface: "#FFFFFF",
    surfaceAlt: "#E9EEF2",
    band: "#0E1622",
    bandInk: "#FFFFFF",
    bandInkSoft: "#9FB3C9",
    bandRule: "#213043",
    ink: "#111820",
    inkSoft: "#54606C",
    inkFaint: "#8A95A1",
    rule: "#E3E8EC",
    ruleStrong: "#CBD3DA",
    accent: "#0B8F65",
    accentDeep: "#08704F",
    accentWash: "#D7F1E8",
    onAccent: "#FFFFFF",
    amber: "#B26A12",
    amberWash: "#FBECD8",
    signal: "#8A5A0E",
    signalWash: "#F6EEDC",
    alert: "#C4362A",
    shadow: "#0E1622",
  },
  dark: {
    ground: "#0A0E0D",
    surface: "#131917",
    surfaceAlt: "#1B221F",
    band: "#0C1310",
    bandInk: "#EFF4F1",
    bandInkSoft: "#93A9A0",
    bandRule: "#20302A",
    ink: "#E9EFEB",
    inkSoft: "#98A49E",
    inkFaint: "#6F7B75",
    rule: "#262F2B",
    ruleStrong: "#39433D",
    accent: "#2FD69B",
    accentDeep: "#66E7B9",
    accentWash: "#123028",
    onAccent: "#04130D",
    amber: "#EEB35A",
    amberWash: "#2A2416",
    signal: "#D8A94A",
    signalWash: "#2A2417",
    alert: "#EF9389",
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
    shadowOpacity: level === 1 ? 0.06 : 0.1,
    shadowRadius: level === 1 ? 12 : 22,
    shadowOffset: { width: 0, height: level === 1 ? 3 : 8 },
    elevation: level === 1 ? 2 : 5,
  };
}
