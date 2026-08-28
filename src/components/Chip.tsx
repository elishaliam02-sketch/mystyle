import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function Chip({ label, selected, onPress }: Props) {
  const { colors, space, radius, type } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.rule,
        borderRadius: radius.pill,
        paddingVertical: space.sm + 2,
        paddingHorizontal: space.lg,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={[type.small, { color: selected ? colors.onAccent : colors.ink, fontWeight: "600" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
