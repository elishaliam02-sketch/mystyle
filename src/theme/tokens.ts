import type { TextStyle } from "react-native";

/**
 * One palette, two grounds. Every colour used in the app comes from here —
 * a literal hex anywhere else is a bug, because it will only work in one theme.
 * Typing the record against Colors means a token added to light and forgotten
 * in dark fails the typecheck instead of shipping.
 */
export type Colors = {
  ground: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accentWash: string;
  onAccent: string;
  signal: string;
  signalWash: string;
  alert: string;
};

export const palette: Record<"light" | "dark", Colors> = {
  light: {
    ground: "#F1F4F1",
    surface: "#FFFFFF",
    surfaceAlt: "#E8EDE9",
    ink: "#15201B",
    inkSoft: "#576A61",
    inkFaint: "#869890",
    rule: "#D6DED8",
    ruleStrong: "#B9C5BD",
    accent: "#1E5C4B",
    accentWash: "#E1EDE6",
    onAccent: "#FFFFFF",
    signal: "#8A5A0E",
    signalWash: "#F5EBD8",
    alert: "#8E3A2E",
  },
  dark: {
    ground: "#0E1412",
    surface: "#161E1A",
    surfaceAlt: "#1E2823",
    ink: "#E4EDE7",
    inkSoft: "#9CADA4",
    inkFaint: "#71827A",
    rule: "#28332E",
    ruleStrong: "#3A4842",
    accent: "#69C0A1",
    accentWash: "#1A2C25",
    onAccent: "#0E1412",
    signal: "#D5A344",
    signalWash: "#2B2418",
    alert: "#E2857A",
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
  sm: 6,
  md: 10,
  lg: 18,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: "700" },
  title: { fontSize: 21, lineHeight: 28, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 1.1 },
} satisfies Record<string, TextStyle>;
