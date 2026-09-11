import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import {
  MARK_PEAK,
  MARK_PEAK_WIDTH,
  MARK_STEP,
  MARK_STEP_WIDTH,
  MARK_VIEWBOX,
} from "@/theme/mark";
import { useTheme } from "@/theme";

/**
 * APEX — a climb in two strokes. The geometry and the reasoning behind it live
 * in `src/theme/mark.ts`, shared with the icon generator so the mark on the
 * home screen is the same mark as the one in the app.
 *
 * The step is neon lime on a dark ground and `limeMark` on paper — the same
 * hue at the weight a graphic needs, rather than the darker weight type needs,
 * which read as olive next to the violet and made the lockup look muddy. The
 * wordmark is set in the display face with wide tracking for a confident
 * lockup, and can be dropped for the places that only want the glyph.
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
  const step = onBand ? colors.lime : colors.limeMark;

  return (
    <View style={{ alignItems: "center", gap: size * 0.11 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
        <Defs>
          {/* userSpaceOnUse so the gradient is defined over the whole mark — a
              stroke has no area of its own, and an objectBoundingBox gradient
              on one would collapse. */}
          <LinearGradient id="apexPeak" gradientUnits="userSpaceOnUse" x1="16" y1="18" x2="84" y2="58">
            <Stop offset="0" stopColor={onBand ? colors.accentDeep : colors.accent} />
            <Stop offset="1" stopColor={onBand ? colors.accent : colors.accentDeep} />
          </LinearGradient>
        </Defs>

        {/* the summit */}
        <Path
          d={MARK_PEAK}
          fill="none"
          stroke="url(#apexPeak)"
          strokeWidth={MARK_PEAK_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* the step taken today */}
        <Path
          d={MARK_STEP}
          fill="none"
          stroke={step}
          strokeWidth={MARK_STEP_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
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
