import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palette, radius, space, type, type Colors } from "./tokens";

type Theme = {
  colors: Colors;
  scheme: "light" | "dark";
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const value = useMemo<Theme>(
    () => ({ colors: palette[scheme], scheme, space, radius, type }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return theme;
}

export { palette, radius, space, type };
export type { Colors };
