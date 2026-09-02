import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
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

  const solid = tone !== "quiet";
  const base = tone === "danger" ? colors.alert : colors.accent;
  const textColor = tone === "quiet" ? colors.ink : colors.onAccent;

  // A primary button should feel like the obvious thing to press: a solid pill
  // with a red gradient and a coloured glow, so it lifts off the page rather
  // than sitting flat in it. The gradient runs light-to-deep for a lit edge.
  const gradient: [string, string] =
    tone === "danger" ? [colors.alert, "#7E140F"] : [colors.accent, colors.accentDeep];
  const glow =
    solid && !disabled
      ? {
          shadowColor: base,
          shadowOpacity: 0.4,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 7 },
          elevation: 7,
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
          borderRadius: radius.pill,
          overflow: "hidden",
          borderWidth: tone === "quiet" ? 1.5 : 0,
          borderColor: colors.ruleStrong,
          backgroundColor: tone === "quiet" ? "transparent" : base,
          opacity: disabled ? 0.4 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        glow,
        style,
      ]}
    >
      {solid ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          paddingVertical: 18,
          paddingHorizontal: space.xl,
        }}
      >
        {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
        <Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: textColor }}>{label}</Text>
      </View>
    </Pressable>
  );
}
