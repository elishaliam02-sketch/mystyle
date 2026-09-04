import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** "solid" is the gradient+glow pill; "soft" is the tinted, quieter one. */
  tone?: "solid" | "soft";
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/**
 * The small sibling of Button: the same red gradient and coloured glow that
 * makes the primary action feel liftable, at the size of an inline chip. Every
 * ad-hoc accent pill scattered across the screens was a flat rectangle that did
 * not match the main call-to-action; this is the one shape they all became, so
 * a tap target looks the same wherever it appears.
 */
export function PillButton({
  label,
  onPress,
  icon,
  tone = "solid",
  disabled,
  style,
  accessibilityLabel,
}: Props) {
  const { colors, radius, font } = useTheme();
  const solid = tone === "solid";
  const textColor = solid ? colors.onAccent : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          borderRadius: radius.pill,
          overflow: "hidden",
          backgroundColor: solid ? colors.accent : colors.accentWash,
          opacity: disabled ? 0.4 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
        },
        solid && !disabled
          ? {
              shadowColor: colors.accent,
              shadowOpacity: 0.38,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 },
              elevation: 5,
            }
          : null,
        style,
      ]}
    >
      {solid ? (
        <LinearGradient
          colors={[colors.accent, colors.accentDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 9,
          paddingHorizontal: 16,
        }}
      >
        {icon ? <Ionicons name={icon} size={16} color={textColor} /> : null}
        <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: textColor }}>{label}</Text>
      </View>
    </Pressable>
  );
}
