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
  const { colors, space, radius, font } = useTheme();

  const background =
    tone === "primary" ? colors.accent : tone === "danger" ? colors.alert : "transparent";
  const textColor = tone === "quiet" ? colors.ink : colors.onAccent;

  // A primary button should feel like the obvious thing to press: a solid,
  // slightly larger pill that carries a coloured glow, so it lifts off the
  // page rather than sitting flat in it.
  const solid = tone !== "quiet";
  const glow = solid && !disabled
    ? {
        shadowColor: background,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }
    : null;

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
          paddingVertical: 18,
          paddingHorizontal: space.xl,
          opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        glow,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
      <Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: textColor }}>{label}</Text>
    </Pressable>
  );
}
