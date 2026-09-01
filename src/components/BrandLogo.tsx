import { View } from "react-native";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * APEX — a clean, minimal strength mark: a flexed arm (bicep), the universal
 * symbol for strong, over the APEX wordmark. Red on black. Deliberately simple
 * so it reads as designed at any size, never as a distorted figure.
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
  const { colors } = useTheme();
  const red = colors.accent;
  const line = "rgba(0,0,0,0.24)";
  void onBand;

  const vbH = withWordmark ? 132 : 96;
  const width = size;
  const height = (size * vbH) / 108;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={width} height={height} viewBox={`0 0 108 ${vbH}`}>
        {/* flexed arm */}
        <Path d="M28 70 L66 70" stroke={red} strokeWidth={30} strokeLinecap="round" />
        <Path d="M69 68 L69 26" stroke={red} strokeWidth={26} strokeLinecap="round" />
        <Path d="M32 58 C40 40 58 38 66 52 C58 60 44 62 32 58 Z" fill={red} />
        {/* definition */}
        <G stroke={line} strokeWidth={2.5} fill="none" strokeLinecap="round">
          <Path d="M58 24 L80 24" />
          <Path d="M38 55 C46 45 56 45 62 52" />
        </G>
        {withWordmark ? (
          <SvgText
            x={54}
            y={120}
            textAnchor="middle"
            fontSize={25}
            fontWeight="900"
            fill={red}
          >
            APEX
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
