import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * APEX — the brand mark, drawn in code so it is crisp at any size and themed
 * with the palette rather than a flat asset.
 *
 * The emblem is a figure mid-flex: broad shoulders, a raised double-biceps
 * pose, standing on the wordmark like a peak on its base — apex. Strength and
 * height in one shape. The wordmark is set in the display face with wide
 * tracking so it reads as a logotype, not a heading.
 */
export function BrandLogo({
  size = 84,
  onBand = true,
  showWordmark = true,
}: {
  size?: number;
  onBand?: boolean;
  showWordmark?: boolean;
}) {
  const { colors, font } = useTheme();
  const ink = onBand ? colors.bandInk : colors.ink;

  return (
    <View style={{ alignItems: "center", gap: size * 0.16 }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="apexFig" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accentDeep} />
            <Stop offset="1" stopColor={colors.accent} />
          </LinearGradient>
        </Defs>

        {/* head */}
        <Circle cx="50" cy="20" r="9" fill="url(#apexFig)" />

        {/* shoulders, torso and both flexing arms, one symmetric silhouette */}
        <Path
          fill="url(#apexFig)"
          d="
            M50 31
            C41 31 34 34 30 40
            C24 34 16 33 11 37
            C6 41 6 49 11 53
            C15 49 21 48 26 51
            C24 57 23 63 24 69
            L34 66
            C35 58 39 52 50 52
            C61 52 65 58 66 66
            L76 69
            C77 63 76 57 74 51
            C79 48 85 49 89 53
            C94 49 94 41 89 37
            C84 33 76 34 70 40
            C66 34 59 31 50 31
            Z"
        />

        {/* the base line the figure stands on — the peak's ground */}
        <Path
          d="M22 80 L78 80"
          stroke={ink}
          strokeWidth="4"
          strokeLinecap="round"
          opacity={0.85}
        />
      </Svg>

      {showWordmark ? (
        <Text
          style={{
            fontFamily: font.display,
            color: ink,
            fontSize: size * 0.34,
            letterSpacing: size * 0.06,
            marginStart: size * 0.06,
          }}
        >
          APEX
        </Text>
      ) : null}
    </View>
  );
}
