import { View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * APEX — the brand mark, drawn in code so it is crisp at any size and themed.
 *
 * An athletic figure in a double-biceps flex, pressing the word APEX overhead —
 * the name is the weight he lifts, and the fists grip its ends so every letter
 * stays visible. Proportional, naturally muscular; red on black, the brand's
 * two colours. The name is inside the mark, so there is no separate wordmark.
 */
export function BrandLogo({ size = 120, onBand = true }: { size?: number; onBand?: boolean }) {
  const { colors } = useTheme();
  const red = colors.accent;
  const line = "rgba(0,0,0,0.28)";
  void onBand;

  const width = size * 1.7;
  const height = (width * 186) / 200;

  // A flexed arm: upper arm (shoulder→elbow) with a bicep bump, forearm to fist.
  const arm = (sx: number, sy: number, ex: number, ey: number, fx: number, fy: number) => {
    const bx = sx * 0.45 + ex * 0.55;
    const by = sy * 0.45 + ey * 0.55 - 8;
    return (
      <G>
        <Path d={`M${sx} ${sy} L${ex} ${ey}`} stroke={red} strokeWidth={20} strokeLinecap="round" />
        <Path d={`M${ex} ${ey} L${fx} ${fy}`} stroke={red} strokeWidth={15} strokeLinecap="round" />
        <Circle cx={bx} cy={by} r={11.5} fill={red} />
        <Circle cx={ex} cy={ey} r={10} fill={red} />
        <Circle cx={fx} cy={fy} r={8} fill={red} />
      </G>
    );
  };

  const leg = (hx: number, hy: number, kx: number, ky: number, ax: number, ay: number) => (
    <G>
      <Path d={`M${hx} ${hy} L${kx} ${ky}`} stroke={red} strokeWidth={15} strokeLinecap="round" />
      <Path d={`M${kx} ${ky} L${ax} ${ay}`} stroke={red} strokeWidth={11} strokeLinecap="round" />
      <Circle cx={kx} cy={ky} r={7} fill={red} />
    </G>
  );

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={width} height={height} viewBox="0 0 200 186">
        {/* the weight = APEX, fully visible between the fists */}
        <SvgText x={100} y={47} textAnchor="middle" fontSize={31} fontWeight="900" fill={red}>
          APEX
        </SvgText>
        {/* flexed arms */}
        {arm(84, 84, 118, 70, 143, 45)}
        <G transform="translate(200,0) scale(-1,1)">{arm(84, 84, 118, 70, 143, 45)}</G>
        {/* head + neck */}
        <Rect x={95} y={70} width={10} height={12} rx={4} fill={red} />
        <Circle cx={100} cy={62} r={11.5} fill={red} />
        {/* torso */}
        <Path
          d="M82 84 C81 96 84 108 90 118 C92 122 95 124 100 124 C105 124 108 122 110 118 C116 108 119 96 118 84 C108 79 92 79 82 84 Z"
          fill={red}
        />
        {/* legs + feet */}
        {leg(94, 122, 91, 146, 89, 172)}
        {leg(106, 122, 109, 146, 111, 172)}
        <Rect x={82} y={170} width={16} height={7} rx={3} fill={red} />
        <Rect x={102} y={170} width={16} height={7} rx={3} fill={red} />
        {/* definition */}
        <G stroke={line} strokeWidth={2.2} fill="none" strokeLinecap="round">
          <Path d="M100 86 L100 122" />
          <Path d="M100 92 C94 94 90 97 88 102" />
          <Path d="M100 92 C106 94 110 97 112 102" />
          <Path d="M93 109 L107 109 M94 117 L106 117" />
        </G>
      </Svg>
    </View>
  );
}
