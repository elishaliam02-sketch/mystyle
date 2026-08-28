import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * Today's completion, as a ring. A number on its own reads as a score; a ring
 * that fills reads as a day in progress, which is what this actually is.
 */
export function Ring({
  done,
  total,
  size = 84,
  /** "band" renders for the dark header; "page" for a light surface. */
  on = "band",
}: {
  done: number;
  total: number;
  size?: number;
  on?: "band" | "page";
}) {
  const { colors, type } = useTheme();
  const stroke = 9;
  const track = on === "band" ? colors.bandRule : colors.rule;
  const fill = on === "band" ? colors.bandInk : colors.accent;
  const doneColor = on === "band" ? colors.amber : colors.amber;
  const labelColor = on === "band" ? colors.bandInk : colors.ink;
  const subColor = on === "band" ? colors.bandInkSoft : colors.inkFaint;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} / ${total}`}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={complete ? doneColor : fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          // Start the arc at the top rather than at three o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[type.title, { color: labelColor }]}>
        {done}
        <Text style={[type.small, { color: subColor }]}>/{total}</Text>
      </Text>
    </View>
  );
}
