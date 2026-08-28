import { Pressable, Text, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "quiet" | "danger";
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, tone = "primary", disabled, style }: Props) {
  const { colors, space, radius, type } = useTheme();

  const background =
    tone === "primary" ? colors.accent : tone === "danger" ? colors.alert : "transparent";
  const text =
    tone === "quiet" ? colors.ink : colors.onAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderWidth: tone === "quiet" ? 1 : 0,
          borderColor: colors.rule,
          borderRadius: radius.pill,
          paddingVertical: space.md + 2,
          paddingHorizontal: space.xl,
          alignItems: "center",
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={[type.bodyStrong, { color: text }]}>{label}</Text>
    </Pressable>
  );
}
