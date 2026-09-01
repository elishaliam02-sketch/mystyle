import { View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * APEX — the brand mark, drawn in code so it is crisp at any size and themed.
 *
 * An athletic figure pressing a barbell overhead, and the barbell IS the word
 * APEX: the name is the weight he lifts. Proportional, naturally muscular
 * (a V-taper torso with pec and ab definition), red on black — the brand's two
 * colours. The name lives inside the mark, so there is no separate wordmark.
 */
export function BrandLogo({ size = 120, onBand = true }: { size?: number; onBand?: boolean }) {
  const { colors } = useTheme();
  const red = colors.accent;
  const line = "rgba(0,0,0,0.28)";
  void onBand;

  const width = size * 1.7;
  const height = (width * 184) / 200;

  const limb = (
    ax: number, ay: number, bx: number, by: number, cx: number, cy: number, w1: number, w2: number,
  ) => (
    <G>
      <Path d={`M${ax} ${ay} L${bx} ${by}`} stroke={red} strokeWidth={w1} strokeLinecap="round" />
      <Path d={`M${bx} ${by} L${cx} ${cy}`} stroke={red} strokeWidth={w2} strokeLinecap="round" />
      <Circle cx={bx} cy={by} r={w1 / 2} fill={red} />
    </G>
  );

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={width} height={height} viewBox="0 0 200 184">
        {/* arms up to grip the ends of the word */}
        {limb(85, 80, 76, 56, 63, 37, 12, 10)}
        <G transform="translate(200,0) scale(-1,1)">{limb(85, 80, 76, 56, 63, 37, 12, 10)}</G>
        <Circle cx={85} cy={80} r={8} fill={red} />
        <Circle cx={115} cy={80} r={8} fill={red} />
        {/* weight plates hugging the ends of the word */}
        <Rect x={52} y={24} width={10} height={24} rx={4} fill={red} />
        <Rect x={138} y={24} width={10} height={24} rx={4} fill={red} />
        {/* THE BARBELL = the word APEX */}
        <SvgText
          x={100}
          y={45}
          textAnchor="middle"
          fontSize={34}
          fontWeight="900"
          fill={red}
        >
          APEX
        </SvgText>
        {/* head + neck */}
        <Rect x={95} y={70} width={10} height={10} rx={4} fill={red} />
        <Circle cx={100} cy={62} r={11.5} fill={red} />
        {/* torso */}
        <Path
          d="M83 80 C82 92 84 104 90 116 C92 120 95 122 100 122 C105 122 108 120 110 116 C116 104 118 92 117 80 C107 76 93 76 83 80 Z"
          fill={red}
        />
        {/* legs + feet */}
        {limb(94, 120, 91, 144, 89, 170, 15, 11)}
        {limb(106, 120, 109, 144, 111, 170, 15, 11)}
        <Rect x={82} y={168} width={16} height={7} rx={3} fill={red} />
        <Rect x={102} y={168} width={16} height={7} rx={3} fill={red} />
        {/* definition */}
        <G stroke={line} strokeWidth={2.2} fill="none" strokeLinecap="round">
          <Path d="M100 82 L100 120" />
          <Path d="M100 88 C94 90 90 93 88 98" />
          <Path d="M100 88 C106 90 110 93 112 98" />
          <Path d="M93 105 L107 105 M94 113 L106 113" />
        </G>
      </Svg>
    </View>
  );
}
