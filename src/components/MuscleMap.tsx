import { View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import type { Muscle } from "@/workout/exercises";
import { useTheme } from "@/theme";

/**
 * A body with the worked muscles lit up.
 *
 * The tile this replaced was a coloured square with a dumbbell on it: pretty
 * enough, and it answered nothing. The one thing a person wants from a picture
 * beside an exercise they do not recognise is *what does this work* — so that
 * is what the picture says. Drawn rather than photographed, because it has to
 * be right for two hundred moves, work offline, cost nothing, stay crisp from
 * a 44px row to a full card, and belong to us.
 *
 * The figure is deliberately plain. Anatomical drawing at 44px is mud; a
 * silhouette with a lit region reads instantly at any size, which is the whole
 * job.
 */

/** The body, drawn once. Everything is in a 100 x 130 box. */
const HEAD = { cx: 50, cy: 13, r: 8.5 };
const TORSO = "M38 25 L62 25 L66 31 L64 47 L60 63 L40 63 L36 47 L34 31 Z";
const ARM_L = "M35 27 L29 31 L25 51 L23 67 L29 68 L32 51 L37 33 Z";
const ARM_R = "M65 27 L71 31 L75 51 L77 67 L71 68 L68 51 L63 33 Z";
const LEG_L = "M40 63 L48 63 L47 96 L46 125 L39 125 L40 96 Z";
const LEG_R = "M52 63 L60 63 L61 96 L60 125 L53 125 L52 96 Z";

type Shape =
  | { k: "e"; cx: number; cy: number; rx: number; ry: number }
  | { k: "p"; d: string };

const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ k: "e", cx, cy, rx, ry });

/**
 * Where each muscle lives, per view. A muscle with no shapes in a view simply
 * is not visible from there — the caller picks the view that shows it.
 */
const REGIONS: Record<"front" | "back", Partial<Record<Muscle, Shape[]>>> = {
  front: {
    shoulders: [e(35, 29, 6, 5.5), e(65, 29, 6, 5.5)],
    chest: [e(44, 35, 7, 6), e(56, 35, 7, 6)],
    arms: [e(29.5, 41, 4.6, 9), e(70.5, 41, 4.6, 9)],
    forearms: [e(25.5, 59, 4, 9.5), e(74.5, 59, 4, 9.5)],
    core: [e(50, 52, 8, 11)],
    legs: [e(43.5, 80, 6.5, 16), e(56.5, 80, 6.5, 16), e(43, 107, 5, 10), e(57, 107, 5, 10)],
    // a whole-body move lights the trunk and the legs rather than every part,
    // which would just be a solid figure and say nothing
    fullbody: [e(50, 44, 12, 18), e(43.5, 82, 6.5, 17), e(56.5, 82, 6.5, 17)],
    cardio: [e(43.5, 82, 6.5, 17), e(56.5, 82, 6.5, 17), e(50, 44, 9, 12)],
  },
  back: {
    back: [e(50, 38, 13, 12), e(50, 52, 9, 8)],
    shoulders: [e(35, 29, 6, 5.5), e(65, 29, 6, 5.5)],
    glutes: [e(44, 66, 6.5, 6.5), e(56, 66, 6.5, 6.5)],
    arms: [e(29.5, 41, 4.6, 9), e(70.5, 41, 4.6, 9)],
    forearms: [e(25.5, 59, 4, 9.5), e(74.5, 59, 4, 9.5)],
    legs: [e(43.5, 82, 6.5, 15), e(56.5, 82, 6.5, 15), e(43, 107, 5, 10), e(57, 107, 5, 10)],
    core: [e(50, 52, 8, 11)],
    fullbody: [e(50, 44, 12, 18), e(43.5, 82, 6.5, 17), e(56.5, 82, 6.5, 17)],
    cardio: [e(43.5, 82, 6.5, 17), e(56.5, 82, 6.5, 17), e(50, 44, 9, 12)],
  },
};

function paint(shapes: Shape[] | undefined, fill: string, opacity: number, key: string) {
  if (!shapes) return null;
  return shapes.map((s, i) =>
    s.k === "e" ? (
      <Ellipse key={`${key}-${i}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} opacity={opacity} />
    ) : (
      <Path key={`${key}-${i}`} d={s.d} fill={fill} opacity={opacity} />
    ),
  );
}

export function MuscleMap({
  primary,
  secondary = [],
  view = "front",
  size = 52,
  /** Draw for a dark or coloured surface instead of a card. */
  onHero = false,
}: {
  primary: Muscle;
  secondary?: Muscle[];
  view?: "front" | "back";
  size?: number;
  onHero?: boolean;
}) {
  const { colors } = useTheme();
  const regions = REGIONS[view];

  // On a colour tile the silhouette goes dark and the worked muscle stays
  // white: a pale body under a white muscle is the same picture twice and, at
  // 44px, no picture at all.
  const body = onHero ? "rgba(0,0,0,0.34)" : colors.rule;
  const lit = onHero ? "#FFFFFF" : colors.accent;
  const helper = onHero ? "rgba(255,255,255,0.58)" : colors.accentDeep;

  // 100 x 130 is the drawing; the box is square so a row of these lines up.
  const h = Math.round(size * 1.3);

  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 100 130">
        {/* the body itself, so a lit region reads as part of a person */}
        <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={body} />
        <Path d={TORSO} fill={body} />
        <Path d={ARM_L} fill={body} />
        <Path d={ARM_R} fill={body} />
        <Path d={LEG_L} fill={body} />
        <Path d={LEG_R} fill={body} />

        {/* the muscles that share the work, under the one that does most of it */}
        {secondary.map((m) => paint(regions[m], helper, 0.55, `s-${m}`))}
        {paint(regions[primary], lit, 1, "p")}
      </Svg>
    </View>
  );
}
