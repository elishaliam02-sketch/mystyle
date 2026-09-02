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
  /** The two ends of the band's gradient — a crimson-black that bleeds into
   * near-black, so the header reads as lit rather than flat. */
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
 * APEX palette — red and black. A near-black band crowns every screen, with a
 * bold red as the accent: strength, intensity, the colour of effort. Black
 * carries the weight; red is the one thing that moves. Every ink/ground pairing
 * still clears the accessible-contrast bar in both themes.
 */
export const palette: Record<"light" | "dark", Colors> = {
  light: {
    ground: "#F4F4F5",
    surface: "#FFFFFF",
    surfaceAlt: "#ECECEE",
    band: "#141416",
    bandTop: "#3A0E15",
    bandBottom: "#0E0E10",
    bandInk: "#FFFFFF",
    bandInkSoft: "#B6A9AB",
    bandRule: "#2C2A2E",
    ink: "#151517",
    inkSoft: "#5B595C",
    inkFaint: "#8E8C90",
    rule: "#E4E3E5",
    ruleStrong: "#CCCACE",
    accent: "#D62330",
    accentDeep: "#A81722",
    accentWash: "#FBE1E3",
    onAccent: "#FFFFFF",
    amber: "#B26A12",
    amberWash: "#FBECD8",
    signal: "#8A5A0E",
    signalWash: "#F6EEDC",
    alert: "#B3261E",
    shadow: "#141416",
  },
  dark: {
    ground: "#0B0B0C",
    surface: "#161618",
    surfaceAlt: "#202023",
    band: "#0E0E10",
    bandTop: "#320B12",
    bandBottom: "#08080A",
    bandInk: "#F4F2F2",
    bandInkSoft: "#B49CA0",
    bandRule: "#2A2126",
    ink: "#ECEAEA",
    inkSoft: "#A09A9C",
    inkFaint: "#77716F",
    rule: "#29292C",
    ruleStrong: "#3D3B3F",
    accent: "#F04350",
    accentDeep: "#FF6B75",
    accentWash: "#2B1417",
    onAccent: "#FFFFFF",
    amber: "#EEB35A",
    amberWash: "#2A2416",
    signal: "#D8A94A",
    signalWash: "#2A2417",
    alert: "#FF8A8A",
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
