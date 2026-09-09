import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { accentGradient, elevation, font, heroGlow, heroGradient, palette, radius, space, type, type Colors } from "./tokens";
import { METRIC_FAMILY, metricFill, metricInk, metricWash, onMetric, type Metric, type MetricFamily } from "./metrics";

type Theme = {
  colors: Colors;
  scheme: "light" | "dark";
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  font: typeof font;
  /** Shadow style for a raised surface, already themed. */
  elevation: (level?: 1 | 2) => ReturnType<typeof elevation>;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const value = useMemo<Theme>(
    () => ({
      colors: palette[scheme],
      scheme,
      space,
      radius,
      type,
      font,
      elevation: (level: 1 | 2 = 1) => elevation(palette[scheme], level),
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const ON_HERO = "#FFFFFF";
export const ON_HERO_SOFT = "rgba(255,255,255,0.72)";

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return theme;
}

export {
  accentGradient,
  elevation,
  font,
  heroGlow,
  heroGradient,
  METRIC_FAMILY,
  metricFill,
  metricInk,
  metricWash,
  onMetric,
  palette,
  radius,
  space,
  type,
};
export type { Colors, Metric, MetricFamily };
