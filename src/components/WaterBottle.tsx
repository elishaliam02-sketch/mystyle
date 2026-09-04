import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  /** 0..1 — how full to draw. */
  fill: number;
  met: boolean;
  width?: number;
  height?: number;
};

/**
 * A bottle that fills with the day's water. The water level rises with a spring
 * of easing when a cup is added, so the tap has a little life to it, and turns
 * from red-accent to a calmer "done" fill once the goal is met. Drawn in SVG so
 * it stays crisp at any size and needs no image to download.
 */
export function WaterBottle({ fill, met, width = 74, height = 150 }: Props) {
  const { colors } = useTheme();
  const level = useRef(new Animated.Value(fill)).current;

  useEffect(() => {
    Animated.timing(level, {
      toValue: fill,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      // SVG attributes cannot run on the native driver.
      useNativeDriver: false,
    }).start();
  }, [fill, level]);

  // Bottle inner cavity, in the 0..100 x 0..200 viewBox.
  const top = 34;
  const bottom = 190;
  const cavity = bottom - top;
  const waterHeight = level.interpolate({ inputRange: [0, 1], outputRange: [0, cavity] });
  const waterY = level.interpolate({ inputRange: [0, 1], outputRange: [bottom, top] });
  const waterColor = met ? colors.accentDeep : colors.accent;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 100 200">
        <Defs>
          <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={waterColor} stopOpacity="0.95" />
            <Stop offset="1" stopColor={waterColor} stopOpacity="0.65" />
          </LinearGradient>
          {/* the bottle silhouette, used to clip the water to its shape */}
          <clipPath id="bottle">
            <Path d="M35 8 h30 v10 c0 4 6 8 8 14 c4 8 5 16 5 26 v112 c0 12 -8 20 -20 20 h-16 c-12 0 -20 -8 -20 -20 V58 c0 -10 1 -18 5 -26 c2 -6 8 -10 8 -14 Z" />
          </clipPath>
        </Defs>

        {/* the fill, clipped to the bottle */}
        <AnimatedRect
          x={16}
          width={68}
          y={waterY as unknown as number}
          height={waterHeight as unknown as number}
          fill="url(#water)"
          clipPath="url(#bottle)"
        />

        {/* the glass outline over the top */}
        <Path
          d="M35 8 h30 v10 c0 4 6 8 8 14 c4 8 5 16 5 26 v112 c0 12 -8 20 -20 20 h-16 c-12 0 -20 -8 -20 -20 V58 c0 -10 1 -18 5 -26 c2 -6 8 -10 8 -14 Z"
          fill="none"
          stroke={colors.ruleStrong}
          strokeWidth={3}
        />
        {/* cap */}
        <Rect x={38} y={2} width={24} height={10} rx={3} fill={colors.ruleStrong} />
      </Svg>
    </View>
  );
}
