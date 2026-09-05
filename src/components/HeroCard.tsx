import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { heroGlow, heroGradient, useTheme } from "@/theme";

/**
 * The app's one loud surface: a lit crimson gradient that bleeds toward black,
 * floating on a red glow. Used for the moments that should feel like the front
 * of a product — the day score, a result, an invitation — not for ordinary
 * cards. White content sits on it; callers render their own text in white/soft
 * tones (there is a companion `onHero` palette on the theme for that).
 *
 * A faint diagonal sheen across the top-right sells the "lit" look and keeps it
 * from reading as a flat fill — the difference between premium and boxy.
 */
export function HeroCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors, space, radius } = useTheme();
  return (
    <View style={[{ borderRadius: radius.xl }, heroGlow(colors), style]}>
      <LinearGradient
        colors={heroGradient(colors)}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: "hidden" }}
      >
        {/* the sheen — a soft light bloom in the top corner */}
        <LinearGradient
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.3, y: 0.7 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {children}
      </LinearGradient>
    </View>
  );
}
