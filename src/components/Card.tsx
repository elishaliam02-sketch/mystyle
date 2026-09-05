import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  const borderColor =
    tone === "accent" ? colors.accent : tone === "amber" ? colors.amber : colors.rule;

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.sm,
          // A hairline keeps every card crisp against the paper; the coloured
          // tones wear a slightly stronger edge so they read as highlighted.
          borderWidth: tone === "default" ? StyleSheet.hairlineWidth : 1.5,
          borderColor,
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
