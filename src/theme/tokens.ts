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

export const palette: Record<"light" | "dark", Colors> = {
  light: {
    ground: "#F6F5F0",
    surface: "#FFFFFF",
    surfaceAlt: "#EDEDE5",
    band: "#0A4D37",
    bandInk: "#FFFFFF",
    bandInkSoft: "#B7D8C7",
    bandRule: "#1C6B4F",
    ink: "#14150F",
    inkSoft: "#585B4E",
    inkFaint: "#8B8E80",
    rule: "#E3E2D8",
    ruleStrong: "#C9C8BB",
    accent: "#0E6E4E",
    accentDeep: "#0A5238",
    accentWash: "#DCEFE4",
    onAccent: "#FFFFFF",
    amber: "#B9701A",
    amberWash: "#FAEBD8",
    signal: "#8A5A0E",
    signalWash: "#F7EEDC",
    alert: "#A63A2B",
    shadow: "#14150F",
  },
  dark: {
    ground: "#0E1210",
    surface: "#171C19",
    surfaceAlt: "#1F2622",
    band: "#11362A",
    bandInk: "#EFF6F1",
    bandInkSoft: "#93B8A5",
    bandRule: "#1E4A39",
    ink: "#ECEEE6",
    inkSoft: "#9FA79A",
    inkFaint: "#767E71",
    rule: "#28312B",
    ruleStrong: "#3B453E",
    accent: "#4FD69C",
    accentDeep: "#7BE7B8",
    accentWash: "#16302483",
    onAccent: "#08120D",
    amber: "#E8A94B",
    amberWash: "#2C2417",
    signal: "#D5A344",
    signalWash: "#2B2418",
    alert: "#E2857A",
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
