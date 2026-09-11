import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useStore } from "@/store";
import { desaturate } from "./grayscale";
import { accentGradient, elevation, font, heroGlow, heroGradient, palette, radius, space, type, type Colors } from "./tokens";
import { METRIC_FAMILY, metricFill, metricInk, metricWash, onMetric, type Metric, type MetricFamily } from "./metrics";

type Theme = {
  colors: Colors;
  scheme: "light" | "dark";
  /** True while focus mode has the app's colour switched off. */
  focus: boolean;
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
  // Focus mode drains the app's colour while somebody trains. It works as a
  // single transform because every colour in the app comes from one file —
  // the convention that looks like bookkeeping is what makes this possible at
  // all, rather than a hunt through ninety screens.
  const { focusOn } = useStore();
  const focus = focusOn();

  const value = useMemo<Theme>(
    () => ({
      colors: focus ? desaturate(palette[scheme]) : palette[scheme],
      scheme,
      space,
      radius,
      type,
      font,
      focus,
      elevation: (level: 1 | 2 = 1) =>
        elevation(focus ? desaturate(palette[scheme]) : palette[scheme], level),
    }),
    [scheme, focus],
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

export { desaturate };
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
