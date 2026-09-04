import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/**
 * A selectable panel — a goal, a day count, a piece of kit. Picked, it wears
 * the red gradient and glow of the main buttons instead of a flat red fill, so
 * "this is the one I chose" carries the same weight everywhere in the app. The
 * caller styles the box (padding, radius, width); this owns only the fill, the
 * border and the lift.
 */
export function SelectTile({ selected, onPress, children, style, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          overflow: "hidden",
          backgroundColor: selected ? colors.accent : colors.surfaceAlt,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        selected
          ? {
              shadowColor: colors.accent,
              shadowOpacity: 0.3,
              shadowRadius: 11,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }
          : null,
        style,
      ]}
    >
      {selected ? (
        <LinearGradient
          colors={[colors.accent, colors.accentDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={{ position: "relative" }}>{children}</View>
    </Pressable>
  );
}
