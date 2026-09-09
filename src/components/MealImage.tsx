import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { Food, Shape } from "@/kitchen";
import { useTheme } from "@/theme";

/**
 * The picture for a meal — drawn, not fetched.
 *
 * There is no photo bank and no image API (and no bill). Each plate is composed
 * on the spot from the meal's own ingredients: every food knows a shape and a
 * colour, and this lays them out around a plate. So the image is literally made
 * of what the dish is made of — change the ingredients and the picture changes.
 * Ingredients the person has are drawn in full; the ones still to buy sit
 * faded, so the plate doubles as a shopping hint.
 *
 * Deterministic: the same meal always draws the same plate, because layout is a
 * function of ingredient count and index, never of randomness.
 */

type Props = {
  /** The meal's ingredients, in order. */
  foods: Food[];
  /** Ids the person already has — drawn vivid; the rest are faded. */
  haveIds: Set<string>;
  width?: number;
  height?: number;
};

/**
 * The plate is drawn on the app's own paper — charcoal thinned, never a warm
 * beige of its own. The ingredients keep their real colours: a picture of food
 * has to look like food, so those live in the kitchen's data, not in the UI
 * palette.
 */

export function MealImage({ foods, haveIds, width = 320, height = 150 }: Props) {
  const { colors } = useTheme();
  // Cap what we draw so a busy plate stays readable; the lead ingredients win.
  const shown = useMemo(() => foods.slice(0, 5), [foods]);
  const cx = width / 2;
  const cy = height / 2 + 4;
  const plateR = Math.min(width, height * 1.7) / 2 - 12;

  return (
    <View accessible accessibilityLabel="meal" style={{ borderRadius: 18, overflow: "hidden" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surfaceAlt} />
            <Stop offset="1" stopColor={colors.rule} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />

        {/* the plate */}
        <Ellipse cx={cx} cy={cy} rx={plateR} ry={plateR * 0.62} fill={colors.surface} />
        <Ellipse cx={cx} cy={cy} rx={plateR} ry={plateR * 0.62} fill="none" stroke={colors.ruleStrong} strokeWidth={2} />
        <Ellipse cx={cx} cy={cy} rx={plateR * 0.74} ry={plateR * 0.46} fill="none" stroke={colors.rule} strokeWidth={1.5} />

        {shown.map((food, i) => {
          // Fan the ingredients across the plate, tighter as the count grows.
          const n = shown.length;
          const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2; // -1..1
          const px = cx + spread * plateR * 0.52;
          const py = cy + Math.cos((i / Math.max(n - 1, 1)) * Math.PI) * plateR * 0.12 - 2;
          const size = plateR * (n <= 2 ? 0.5 : n === 3 ? 0.42 : 0.36);
          const vivid = haveIds.has(food.id);
          return (
            <G key={food.id} opacity={vivid ? 1 : 0.35}>
              {renderShape(food.shape, px, py, size, food.color, i)}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/** One ingredient, drawn as its shape at a point. `seed` varies clustered ones. */
function renderShape(shape: Shape, x: number, y: number, s: number, color: string, seed: number) {
  const dark = shade(color, -18);
  switch (shape) {
    case "round":
      return (
        <G>
          <Circle cx={x} cy={y} r={s * 0.5} fill={color} />
          <Circle cx={x - s * 0.16} cy={y - s * 0.16} r={s * 0.12} fill="#FFFFFF" opacity={0.35} />
        </G>
      );
    case "long":
      return (
        <G rotation={-28} origin={`${x}, ${y}`}>
          <Rect x={x - s * 0.18} y={y - s * 0.5} width={s * 0.36} height={s} rx={s * 0.18} fill={color} />
          <Rect x={x - s * 0.06} y={y - s * 0.4} width={s * 0.06} height={s * 0.8} rx={2} fill="#FFFFFF" opacity={0.25} />
        </G>
      );
    case "leaf":
      return (
        <G>
          <Path
            d={`M ${x} ${y - s * 0.55} C ${x + s * 0.5} ${y - s * 0.3}, ${x + s * 0.5} ${y + s * 0.3}, ${x} ${y + s * 0.55} C ${x - s * 0.5} ${y + s * 0.3}, ${x - s * 0.5} ${y - s * 0.3}, ${x} ${y - s * 0.55} Z`}
            fill={color}
          />
          <Path d={`M ${x} ${y - s * 0.45} L ${x} ${y + s * 0.45}`} stroke={dark} strokeWidth={1.4} />
        </G>
      );
    case "grain": {
      // A little pile of grains.
      const dots = [
        [0, 0], [-0.28, 0.12], [0.28, 0.1], [-0.14, -0.2], [0.16, -0.18], [0, 0.26],
      ];
      return (
        <G>
          {dots.map(([dx, dy], k) => (
            <Ellipse
              key={k}
              cx={x + dx * s}
              cy={y + dy * s}
              rx={s * 0.16}
              ry={s * 0.1}
              fill={k % 2 ? shade(color, 8) : color}
              rotation={(seed * 20 + k * 35) % 360}
              origin={`${x + dx * s}, ${y + dy * s}`}
            />
          ))}
        </G>
      );
    }
    case "slice":
      return (
        <G>
          <Path
            d={`M ${x - s * 0.5} ${y + s * 0.4} L ${x - s * 0.5} ${y - s * 0.1} C ${x - s * 0.5} ${y - s * 0.55}, ${x + s * 0.5} ${y - s * 0.55}, ${x + s * 0.5} ${y - s * 0.1} L ${x + s * 0.5} ${y + s * 0.4} Z`}
            fill={color}
          />
          <Rect x={x - s * 0.34} y={y - s * 0.1} width={s * 0.68} height={s * 0.34} rx={4} fill={shade(color, 18)} />
        </G>
      );
    case "blob":
      return (
        <G>
          <Path
            d={`M ${x - s * 0.5} ${y} C ${x - s * 0.5} ${y - s * 0.4}, ${x + s * 0.5} ${y - s * 0.45}, ${x + s * 0.5} ${y - s * 0.02} C ${x + s * 0.55} ${y + s * 0.4}, ${x - s * 0.45} ${y + s * 0.42}, ${x - s * 0.5} ${y} Z`}
            fill={color}
          />
          <Ellipse cx={x - s * 0.12} cy={y - s * 0.12} rx={s * 0.14} ry={s * 0.09} fill="#FFFFFF" opacity={0.3} />
        </G>
      );
    case "drop":
      return (
        <Path
          d={`M ${x} ${y - s * 0.5} C ${x + s * 0.42} ${y}, ${x + s * 0.28} ${y + s * 0.5}, ${x} ${y + s * 0.5} C ${x - s * 0.28} ${y + s * 0.5}, ${x - s * 0.42} ${y}, ${x} ${y - s * 0.5} Z`}
          fill={color}
        />
      );
  }
}

/** Lighten (+) or darken (−) a hex colour by a percentage of full scale. */
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const amt = Math.round((pct / 100) * 255);
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
