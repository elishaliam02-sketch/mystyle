import { LinearGradient } from "expo-linear-gradient";
import { Children, isValidElement, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
  /** A screen of independent cards: on a wide screen they flow into two
   * columns instead of one narrow strip down the middle of a monitor. */
  columns?: boolean;
  children: ReactNode;
};

/**
 * The comfortable reading width for a column of cards. On a phone the content
 * fills the screen; on a tablet, a foldable, or the web it stops here and
 * centres, instead of stretching a single column across a metre of glass.
 */
export const MAX_CONTENT = 620;

/** From this width a `columns` screen lays its cards out in two columns. */
export const WIDE = 1024;
export const MAX_WIDE = 1240;

/**
 * Every screen opens with a tinted band carrying the title. It gives the page
 * a top edge and a horizon line, which a flat list of cards never has.
 *
 * The band paints full-bleed for its colour, but its text and the body below
 * are both held to one centred column, so the layout reads the same on a phone
 * and on a desktop browser.
 */
export function Screen({ eyebrow, title, subtitle, aside, banner, columns = false, children }: Props) {
  const { colors, space } = useTheme();
  const { width } = useWindowDimensions();
  const wide = columns && width >= WIDE;

  const centered = { width: "100%" as const, maxWidth: wide ? MAX_WIDE : MAX_CONTENT, alignSelf: "center" as const };

  // Two columns, filled in turn — the first card leads the first column (the
  // right one, in Hebrew), the second leads the other, and so on, so what
  // matters most still sits at the top on either side.
  let body: ReactNode = children;
  if (wide) {
    const items = Children.toArray(children).filter(isValidElement);
    const cols: ReactNode[][] = [[], []];
    items.forEach((child, i) => cols[i % 2]!.push(child));
    body = (
      <View style={{ flexDirection: "row", gap: space.lg, alignItems: "flex-start" }}>
        {cols.map((col, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0, gap: space.lg }}>
            {col}
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.ground }]}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenBand eyebrow={eyebrow} title={title} subtitle={subtitle} aside={aside} banner={banner} wide={wide} />

      <View
        style={[
          centered,
          { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg },
        ]}
      >
        {body}
      </View>
    </ScrollView>
  );
}

/**
 * The screen's heading band on its own, for a screen whose body is a
 * virtualized list rather than a scroll view (the recipe book): the list
 * scrolls the band away with it, exactly as Screen does.
 */
export function ScreenBand({
  eyebrow,
  title,
  subtitle,
  aside,
  banner,
  wide = false,
}: Pick<Props, "eyebrow" | "title" | "subtitle" | "aside" | "banner"> & { wide?: boolean }) {
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const centered = { width: "100%" as const, maxWidth: wide ? MAX_WIDE : MAX_CONTENT, alignSelf: "center" as const };
  return (
    <LinearGradient
      colors={[colors.bandTop, colors.bandBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + space.xxl,
        paddingBottom: space.xxl,
        paddingHorizontal: space.lg,
        borderBottomStartRadius: radius.xl,
        borderBottomEndRadius: radius.xl,
        gap: space.md,
      }}
    >
      <View style={[centered, { gap: space.md }]}>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
