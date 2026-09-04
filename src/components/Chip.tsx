import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

/**
 * A single-choice chip. The selected one wears the same red gradient and glow
 * as the main buttons — so which option is live reads at a glance and the
 * filters feel of a piece with the call-to-action, rather than a flat red box
 * sitting next to a lit one.
 */
export function Chip({ label, selected, onPress }: Props) {
  const { colors, space, radius, type } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        {
          overflow: "hidden",
          backgroundColor: selected ? colors.accent : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.rule,
          borderRadius: radius.pill,
          paddingVertical: space.sm + 2,
          paddingHorizontal: space.lg,
          opacity: pressed ? 0.75 : 1,
        },
        selected
          ? {
              shadowColor: colors.accent,
              shadowOpacity: 0.32,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }
          : null,
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
      <Text
        style={[type.small, { color: selected ? colors.onAccent : colors.ink, fontWeight: "600" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
