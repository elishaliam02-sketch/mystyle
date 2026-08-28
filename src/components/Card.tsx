import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label?: string;
  title?: string;
  children?: ReactNode;
  tone?: "default" | "accent";
};

export function Card({ label, title, children, tone = "default" }: Props) {
  const { colors, space, radius, type } = useTheme();
  const background = tone === "accent" ? colors.accentWash : colors.surface;

  return (
    <View
      style={{
        backgroundColor: background,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: tone === "accent" ? "transparent" : colors.rule,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      {label ? (
        <Text
          style={[
            type.label,
            { color: colors.accent, textTransform: "uppercase" },
          ]}
        >
          {label}
        </Text>
      ) : null}
      {title ? (
        <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}
