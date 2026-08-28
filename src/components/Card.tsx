import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label?: string;
  title?: string;
  children?: ReactNode;
  tone?: "default" | "accent" | "amber";
};

export function Card({ label, title, children, tone = "default" }: Props) {
  const { colors, space, radius, type, elevation } = useTheme();

  const background =
    tone === "accent" ? colors.accentWash : tone === "amber" ? colors.amberWash : colors.surface;
  const labelColor = tone === "amber" ? colors.amber : colors.accent;

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.sm,
        },
        tone === "default" ? elevation(1) : null,
      ]}
    >
      {label ? (
        <Text style={[type.label, { color: labelColor, textTransform: "uppercase" }]}>
          {label}
        </Text>
      ) : null}
      {title ? <Text style={[type.title, { color: colors.ink }]}>{title}</Text> : null}
      {children}
    </View>
  );
}
