import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "quiet" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, tone = "primary", icon, disabled, style }: Props) {
  const { colors, space, radius, type, elevation } = useTheme();

  const background =
    tone === "primary" ? colors.accent : tone === "danger" ? colors.alert : "transparent";
  const textColor = tone === "quiet" ? colors.ink : colors.onAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          backgroundColor: background,
          borderWidth: tone === "quiet" ? 1.5 : 0,
          borderColor: colors.ruleStrong,
          borderRadius: radius.pill,
          paddingVertical: space.lg,
          paddingHorizontal: space.xl,
          opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        tone === "primary" && !disabled ? elevation(1) : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <Text style={[type.bodyStrong, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}
