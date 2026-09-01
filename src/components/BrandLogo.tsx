import { Text, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * APEX — the brand mark, drawn in code so it is crisp at any size and themed
 * with the palette.
 *
 * A muscular figure mid double-biceps flex — the classic strongman pose: head,
 * flexed arms with biceps, a V-taper torso lined with pec and ab definition.
 * It stands over the wordmark, presenting the name. Red on black, the brand's
 * two colours. Built from thick round-capped limbs, a traps mass and a tapered
 * torso so the joints connect and it reads as a body, not an abstract shape.
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
  const red = colors.accent;
  const line = "rgba(0,0,0,0.34)"; // muscle definition — a sketched shadow

  const arm = (sx: number, sy: number, ex: number, ey: number, fx: number, fy: number) => (
    <G>
      <Path d={`M${sx} ${sy} L${ex} ${ey}`} stroke={red} strokeWidth={20} strokeLinecap="round" />
      <Path d={`M${ex} ${ey} L${fx} ${fy}`} stroke={red} strokeWidth={16} strokeLinecap="round" />
      <Circle cx={ex} cy={ey} r={10} fill={red} />
      <Circle cx={sx * 0.35 + ex * 0.65} cy={sy * 0.35 + ey * 0.65 - 7} r={10.5} fill={red} />
      <Circle cx={fx} cy={fy} r={8.5} fill={red} />
    </G>
  );

  return (
    <View style={{ alignItems: "center", gap: size * 0.14 }}>
      <Svg width={size} height={size} viewBox="0 0 140 122">
        {/* traps + shoulders */}
        <Path
          d="M46 60 C48 50 60 46 70 46 C80 46 92 50 94 60 C96 68 92 72 84 72 L56 72 C48 72 44 68 46 60 Z"
          fill={red}
        />
        {/* torso */}
        <Path
          d="M50 58 C48 74 52 90 63 104 L77 104 C88 90 92 74 90 58 C80 52 60 52 50 58 Z"
          fill={red}
        />
        {arm(84, 58, 114, 46, 95, 22)}
        <G transform="translate(140,0) scale(-1,1)">{arm(84, 58, 114, 46, 95, 22)}</G>
        <Rect x={63} y={32} width={14} height={14} rx={5} fill={red} />
        <Circle cx={70} cy={23} r={12.5} fill={red} />
        {/* definition */}
        <G stroke={line} strokeWidth={2.6} fill="none" strokeLinecap="round">
          <Path d="M70 54 L70 100" />
          <Path d="M70 62 C62 64 57 67 55 73" />
          <Path d="M70 62 C78 64 83 67 85 73" />
          <Path d="M61 82 L79 82 M62 90 L78 90 M64 98 L76 98" />
        </G>
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
