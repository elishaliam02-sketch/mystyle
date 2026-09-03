import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * APEX — the mark is a summit: a bold "A" whose sharp peak reads as the top of
 * a mountain, with a level crossbar. Built from three clean strokes with a
 * vertical red gradient (lit at the peak, deep at the base), so it stays crisp
 * and premium at any size and never depends on rendered anatomy. The wordmark
 * is set in the app's display face with wide tracking for a confident lockup.
 */
export function BrandLogo({
  size = 120,
  onBand = true,
  withWordmark = true,
}: {
  size?: number;
  onBand?: boolean;
  withWordmark?: boolean;
}) {
  const { colors, font } = useTheme();
  const mark = size;

  return (
    <View style={{ alignItems: "center", gap: size * 0.11 }}>
      <Svg width={mark} height={mark} viewBox="0 0 100 100">
        <Defs>
          {/* userSpaceOnUse so the vertical gradient is defined over the whole
              mark — a horizontal stroke has a zero-height box and would lose an
              objectBoundingBox gradient entirely (the crossbar would vanish). */}
          <LinearGradient
            id="apexGrad"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="15"
            x2="0"
            y2="87"
          >
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.accentDeep} />
          </LinearGradient>
        </Defs>
        {/* the peak: two legs meeting at a sharp apex */}
        <Path
          d="M13 87 L50 15 L87 87"
          fill="none"
          stroke="url(#apexGrad)"
          strokeWidth={15}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* the crossbar of the A */}
        <Path
          d="M33 60 L67 60"
          fill="none"
          stroke="url(#apexGrad)"
          strokeWidth={13}
          strokeLinecap="round"
        />
      </Svg>
      {withWordmark ? (
        <Text
          style={{
            fontFamily: font.display,
            fontSize: size * 0.3,
            letterSpacing: size * 0.055,
            color: onBand ? colors.bandInk : colors.ink,
            // The tracking adds trailing space; nudge back so it stays centred.
            marginRight: -size * 0.055,
          }}
        >
          APEX
        </Text>
      ) : null}
    </View>
  );
}
