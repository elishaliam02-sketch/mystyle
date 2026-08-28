import { View } from "react-native";
import { useTheme } from "@/theme";

/** Shows how far through a flow you are, and how much is left. */
export function StepDots({
  total,
  current,
  onBand,
}: {
  total: number;
  current: number;
  /** Rendered against the dark header band rather than the page. */
  onBand?: boolean;
}) {
  const { colors, space } = useTheme();
  const done = onBand ? colors.bandInk : colors.accent;
  const todo = onBand ? colors.bandRule : colors.rule;

  return (
    <View style={{ flexDirection: "row", gap: space.xs }} accessibilityRole="progressbar">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 5,
            flex: 1,
            borderRadius: 2,
            backgroundColor: i <= current ? done : todo,
          }}
        />
      ))}
    </View>
  );
}
