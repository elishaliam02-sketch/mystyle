import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

type Props = {
  /** Small label above the title — the date, a section name. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Sits inside the tinted band beside the title — a ring, a figure. */
  aside?: ReactNode;
  /** Rendered inside the band, under the title. */
  banner?: ReactNode;
  children: ReactNode;
};

/**
 * Every screen opens with a tinted band carrying the title. It gives the page
 * a top edge and a horizon line, which a flat list of cards never has.
 */
export function Screen({ eyebrow, title, subtitle, aside, banner, children }: Props) {
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.ground }]}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          backgroundColor: colors.band,
          paddingTop: insets.top + space.xxl,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          borderBottomStartRadius: radius.xl,
          borderBottomEndRadius: radius.xl,
          gap: space.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <View style={{ flex: 1, gap: space.xs }}>
            {eyebrow ? (
              <Text style={[type.label, { color: colors.bandInkSoft }]}>{eyebrow}</Text>
            ) : null}
            <Text style={[type.hero, { color: colors.bandInk }]}>{title}</Text>
            {subtitle ? (
              <Text style={[type.smallStrong, { color: colors.bandInkSoft }]}>{subtitle}</Text>
            ) : null}
          </View>
          {aside}
        </View>
        {banner}
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg }}>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
