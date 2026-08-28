import { View } from "react-native";
import { useTheme } from "@/theme";

/** Shows how far through a flow you are, and how much is left. */
export function StepDots({ total, current }: { total: number; current: number }) {
  const { colors, space } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: space.xs }} accessibilityRole="progressbar">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            backgroundColor: i <= current ? colors.accent : colors.rule,
          }}
        />
      ))}
    </View>
  );
}
