import { useMemo } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import type { Food, Shape } from "@/kitchen";
import { useTheme } from "@/theme";

/**
 * The picture for a meal — drawn, not fetched.
 *
 * There is no photo bank and no image API (and no bill, and no licence to
 * honour). Each plate is composed on the spot from the meal's own ingredients:
 * every food knows a shape and a colour, and this lays them out. So the image
 * is literally made of what the dish is made of — change the ingredients and
 * the picture changes with them.
 *
 * The first version of this drew flat shapes on a flat disc and read as a
 * diagram. Food does not look like that. What separates the two is almost
 * entirely light and contact: real ingredients sit *in* a plate, cast small
 * shadows onto it, catch a highlight on the side facing the window, and
 * overlap each other instead of sitting in a tidy row. All of that is here,
 * and none of it costs a network request.
 *
 * Three rules keep it honest:
 *
 * - Light comes from the top-left, for everything, always. One inconsistent
 *   highlight is what makes a drawing look wrong without anyone knowing why.
 * - The arrangement is random-looking but deterministic, seeded off the food
 *   ids, so the same dish is the same picture every time it is rendered.
 * - Ingredients the person does not have are drawn faded, so the plate doubles
 *   as a shopping list at a glance.
 *
 * The food colours themselves live in the kitchen's data rather than the
 * palette: a picture of food has to look like food, and a tomato drawn in the
 * brand's violet is not a tomato.
 */

type Props = {
  /** The meal's ingredients, in order. */
  foods: Food[];
  /** Ids the person already has — drawn vivid; the rest are faded. */
  haveIds: Set<string>;
  width?: number;
  height?: number;
};

/** Deterministic pseudo-random in 0..1 from a string and an index. */
function jitter(seed: string, n: number): number {
  let h = 2166136261;
  const text = `${seed}#${n}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 1000) / 1000;
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

/**
 * Soup or a bowl of grains does not go on a flat plate. Decided from the
 * shapes rather than from new data: a dish that is mostly grains and liquid is
 * a bowl dish, and the ingredients already say which it is.
 */
function isBowlDish(foods: Food[]): boolean {
  if (foods.length === 0) return false;
  // A single loose ingredient is enough when it leads the dish: lentils with
  // carrot and onion is a bowl of soup, not three things on a plate, and the
  // first ingredient is the one the meal is named after.
  const loose = (f: Food) => f.shape === "grain" || f.shape === "drop";
  if (foods[0] && loose(foods[0])) return true;
  return foods.filter(loose).length / foods.length >= 0.5;
}

export function MealImage({ foods, haveIds, width = 320, height = 150 }: Props) {
  const { colors } = useTheme();
  // Cap what we draw so a busy plate stays readable; the lead ingredients win.
  const shown = useMemo(() => foods.slice(0, 5), [foods]);
  const seed = useMemo(() => shown.map((f) => f.id).join("-"), [shown]);
  const bowl = useMemo(() => isBowlDish(shown), [shown]);

  const cx = width / 2;
  const cy = height / 2 + 6;
  const plateR = Math.min(width, height * 1.7) / 2 - 10;
  const ry = plateR * (bowl ? 0.52 : 0.6);

  return (
    <View accessible accessibilityLabel="meal" style={{ borderRadius: 18, overflow: "hidden" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {/* the table: a soft pool of light behind the plate, so the dish is
              lit from somewhere rather than floating on a flat card */}
          <RadialGradient id="table" cx="38%" cy="22%" r="85%">
            <Stop offset="0" stopColor={colors.surface} />
            <Stop offset="1" stopColor={colors.surfaceAlt} />
          </RadialGradient>
          {/* the plate itself, lit from the top-left like everything else */}
          <RadialGradient id="plate" cx="35%" cy="28%" r="78%">
            <Stop offset="0" stopColor={shade(colors.surface, 4)} />
            <Stop offset="0.72" stopColor={colors.surface} />
            <Stop offset="1" stopColor={colors.rule} />
          </RadialGradient>
          {/* the inside of a bowl is in its own shadow toward the bottom */}
          <LinearGradient id="bowl" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.rule} />
            <Stop offset="0.45" stopColor={colors.surface} />
            <Stop offset="1" stopColor={colors.ruleStrong} />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#table)" />

        {/* the shadow the plate casts on the table — offset down-right, away
            from the light, and never a hard edge */}
        <Ellipse
          cx={cx + 5}
          cy={cy + 7}
          rx={plateR * 1.02}
          ry={ry * 1.02}
          fill={colors.shadow}
          opacity={0.1}
        />
        <Ellipse
          cx={cx + 2}
          cy={cy + 3}
          rx={plateR}
          ry={ry}
          fill={colors.shadow}
          opacity={0.07}
        />

        {/* the vessel */}
        <Ellipse cx={cx} cy={cy} rx={plateR} ry={ry} fill={bowl ? "url(#bowl)" : "url(#plate)"} />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={plateR}
          ry={ry}
          fill="none"
          stroke={colors.ruleStrong}
          strokeWidth={1.5}
          opacity={0.8}
        />
        {/* the well: a plate has a rim, a bowl has a wall */}
        <Ellipse
          cx={cx}
          cy={cy + (bowl ? 2 : 0)}
          rx={plateR * (bowl ? 0.82 : 0.76)}
          ry={ry * (bowl ? 0.82 : 0.74)}
          fill="none"
          stroke={colors.rule}
          strokeWidth={bowl ? 2.5 : 1.5}
        />
        {/* the highlight along the top-left rim */}
        <Path
          d={`M ${cx - plateR * 0.82} ${cy - ry * 0.34} A ${plateR} ${ry} 0 0 1 ${cx + plateR * 0.1} ${cy - ry * 0.94}`}
          stroke={shade(colors.surface, 12)}
          strokeWidth={2.5}
          fill="none"
          opacity={0.9}
        />

        {/* A bowl dish gets a base: the lead ingredient's colour filling the
            well, so soup looks like soup. Without it a stew reads as three
            separate objects sitting in an empty dish, which is exactly what
            the first attempt looked like and no amount of shading fixes. */}
        {bowl && shown[0] ? (
          <G opacity={haveIds.has(shown[0].id) ? 0.92 : 0.3}>
            <Ellipse
              cx={cx}
              cy={cy + 3}
              rx={plateR * 0.78}
              ry={ry * 0.74}
              fill={shade(shown[0].color, -10)}
            />
            {/* the surface catches the window, like any liquid */}
            <Ellipse
              cx={cx - plateR * 0.24}
              cy={cy - ry * 0.22}
              rx={plateR * 0.3}
              ry={ry * 0.18}
              fill="#FFFFFF"
              opacity={0.14}
            />
          </G>
        ) : null}

        {/* the food, back to front so the overlaps read correctly */}
        {shown.map((food, i) => {
          const n = shown.length;
          // A loose cluster rather than a row: angle around the centre with a
          // seeded wobble, tighter as the plate fills up.
          const angle = (i / Math.max(n, 1)) * Math.PI * 2 + jitter(seed, i) * 0.9;
          // Tight enough to read as a served portion. Spread wide and drawn
          // small, the same shapes read as a diagram of ingredients with a
          // plate behind them — which is what the first attempt looked like.
          const spread = n === 1 ? 0 : plateR * (0.14 + 0.09 * Math.min(n, 4));
          const px = cx + Math.cos(angle) * spread * 0.58;
          const py = cy + Math.sin(angle) * spread * 0.3 - (bowl ? 1 : 4);
          const size = plateR * (n <= 2 ? 0.78 : n === 3 ? 0.62 : n === 4 ? 0.54 : 0.48) *
            (0.9 + jitter(seed, i + 50) * 0.2);
          const vivid = haveIds.has(food.id);

          return (
            <G key={food.id} opacity={vivid ? 1 : 0.3}>
              {/* what makes food sit *in* a plate rather than on top of a
                  drawing: a small contact shadow under each piece */}
              <Ellipse
                cx={px + size * 0.08}
                cy={py + size * 0.32}
                rx={size * 0.44}
                ry={size * 0.14}
                fill={colors.shadow}
                opacity={0.16}
              />
              {renderShape(food.shape, px, py, size, food.color, i, seed)}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * One ingredient. Every shape is lit from the top-left, carries a darker edge
 * away from the light, and has at least one highlight — those three things are
 * most of the difference between "a coloured circle" and "a tomato".
 */
function renderShape(
  shape: Shape,
  x: number,
  y: number,
  s: number,
  color: string,
  index: number,
  seed: string,
) {
  const dark = shade(color, -20);
  const darker = shade(color, -32);
  const light = shade(color, 16);
  const spin = jitter(seed, index + 10) * 40 - 20;

  switch (shape) {
    case "round":
      return (
        <G>
          {/* body, with the shaded side away from the light */}
          <Circle cx={x} cy={y} r={s * 0.5} fill={dark} />
          <Circle cx={x - s * 0.04} cy={y - s * 0.04} r={s * 0.46} fill={color} />
          <Circle cx={x - s * 0.12} cy={y - s * 0.12} r={s * 0.32} fill={light} opacity={0.5} />
          {/* specular: small, offset, and never centred */}
          <Ellipse
            cx={x - s * 0.2}
            cy={y - s * 0.22}
            rx={s * 0.13}
            ry={s * 0.09}
            fill="#FFFFFF"
            opacity={0.55}
            rotation={-30}
            origin={`${x - s * 0.2}, ${y - s * 0.22}`}
          />
        </G>
      );

    case "long":
      // Tapered rather than a rounded bar: a carrot, a fillet and a courgette
      // are all wider at one end, and a straight capsule reads as a pill.
      return (
        <G rotation={-26 + spin} origin={`${x}, ${y}`}>
          <Path
            d={`M ${x - s * 0.2} ${y - s * 0.5} C ${x + s * 0.24} ${y - s * 0.46}, ${x + s * 0.2} ${y + s * 0.2}, ${x + s * 0.06} ${y + s * 0.52} C ${x - s * 0.12} ${y + s * 0.56}, ${x - s * 0.26} ${y + s * 0.1}, ${x - s * 0.2} ${y - s * 0.5} Z`}
            fill={color}
          />
          <Path
            d={`M ${x - s * 0.12} ${y - s * 0.42} C ${x + s * 0.04} ${y - s * 0.2}, ${x + s * 0.02} ${y + s * 0.12}, ${x - s * 0.04} ${y + s * 0.38}`}
            stroke="#FFFFFF"
            strokeWidth={s * 0.07}
            strokeLinecap="round"
            fill="none"
            opacity={0.35}
          />
          <Path
            d={`M ${x + s * 0.12} ${y - s * 0.3} C ${x + s * 0.2} ${y}, ${x + s * 0.14} ${y + s * 0.28}, ${x + s * 0.04} ${y + s * 0.48}`}
            stroke={dark}
            strokeWidth={s * 0.06}
            fill="none"
            opacity={0.7}
          />
        </G>
      );

    case "leaf":
      return (
        <G rotation={spin} origin={`${x}, ${y}`}>
          <Path
            d={`M ${x} ${y - s * 0.56} C ${x + s * 0.46} ${y - s * 0.3}, ${x + s * 0.52} ${y + s * 0.22}, ${x + s * 0.06} ${y + s * 0.56} C ${x - s * 0.4} ${y + s * 0.3}, ${x - s * 0.5} ${y - s * 0.24}, ${x} ${y - s * 0.56} Z`}
            fill={color}
          />
          {/* a curled edge catching the light — leaves are never flat */}
          <Path
            d={`M ${x} ${y - s * 0.5} C ${x + s * 0.36} ${y - s * 0.26}, ${x + s * 0.42} ${y + s * 0.16}, ${x + s * 0.04} ${y + s * 0.46}`}
            stroke={light}
            strokeWidth={s * 0.08}
            fill="none"
            opacity={0.75}
          />
          <Path
            d={`M ${x - s * 0.02} ${y - s * 0.46} C ${x} ${y - s * 0.1}, ${x + s * 0.02} ${y + s * 0.2}, ${x + s * 0.04} ${y + s * 0.48}`}
            stroke={darker}
            strokeWidth={s * 0.05}
            fill="none"
            opacity={0.8}
          />
          {[-0.22, 0, 0.22].map((t, k) => (
            <Path
              key={k}
              d={`M ${x} ${y + t * s} L ${x + s * 0.26} ${y + t * s - s * 0.12}`}
              stroke={darker}
              strokeWidth={s * 0.03}
              opacity={0.5}
            />
          ))}
        </G>
      );

    case "grain": {
      // A heap, not a row of dots: grains pile up, and the ones underneath are
      // in shadow. Fifteen beats six — a handful of rice is many small things.
      const grains = Array.from({ length: 15 }, (_, k) => {
        const a = jitter(seed, index * 31 + k) * Math.PI * 2;
        const r = Math.sqrt(jitter(seed, index * 31 + k + 100)) * s * 0.42;
        return {
          gx: x + Math.cos(a) * r,
          gy: y + Math.sin(a) * r * 0.62,
          rot: jitter(seed, index * 31 + k + 200) * 180,
          depth: Math.sin(a),
        };
      }).sort((a, b) => a.gy - b.gy);

      return (
        <G>
          {/* the mound underneath, so the heap has volume */}
          <Ellipse cx={x} cy={y + s * 0.1} rx={s * 0.46} ry={s * 0.28} fill={dark} opacity={0.85} />
          {grains.map((g, k) => (
            <Ellipse
              key={k}
              cx={g.gx}
              cy={g.gy}
              rx={s * 0.13}
              ry={s * 0.075}
              fill={g.depth < 0 ? light : k % 3 === 0 ? color : shade(color, 6)}
              rotation={g.rot}
              origin={`${g.gx}, ${g.gy}`}
            />
          ))}
        </G>
      );
    }

    case "slice":
      return (
        <G rotation={spin * 0.4} origin={`${x}, ${y}`}>
          {/* the cut face, with a crust ring around it */}
          <Path
            d={`M ${x - s * 0.5} ${y + s * 0.4} L ${x - s * 0.5} ${y - s * 0.08} C ${x - s * 0.5} ${y - s * 0.58}, ${x + s * 0.5} ${y - s * 0.58}, ${x + s * 0.5} ${y - s * 0.08} L ${x + s * 0.5} ${y + s * 0.4} Z`}
            fill={dark}
          />
          <Path
            d={`M ${x - s * 0.42} ${y + s * 0.34} L ${x - s * 0.42} ${y - s * 0.06} C ${x - s * 0.42} ${y - s * 0.48}, ${x + s * 0.42} ${y - s * 0.48}, ${x + s * 0.42} ${y - s * 0.06} L ${x + s * 0.42} ${y + s * 0.34} Z`}
            fill={light}
          />
          <Ellipse cx={x - s * 0.14} cy={y - s * 0.04} rx={s * 0.1} ry={s * 0.07} fill={color} opacity={0.6} />
          <Ellipse cx={x + s * 0.16} cy={y + s * 0.14} rx={s * 0.08} ry={s * 0.06} fill={color} opacity={0.5} />
        </G>
      );

    case "blob":
      // A soft mound — cottage cheese, hummus, a spoonful of anything. Uneven
      // on purpose: a symmetrical blob reads as a logo.
      return (
        <G>
          <Path
            d={`M ${x - s * 0.48} ${y + s * 0.06} C ${x - s * 0.54} ${y - s * 0.34}, ${x - s * 0.08} ${y - s * 0.5}, ${x + s * 0.22} ${y - s * 0.4} C ${x + s * 0.56} ${y - s * 0.28}, ${x + s * 0.56} ${y + s * 0.24}, ${x + s * 0.2} ${y + s * 0.42} C ${x - s * 0.16} ${y + s * 0.56}, ${x - s * 0.44} ${y + s * 0.34}, ${x - s * 0.48} ${y + s * 0.06} Z`}
            fill={color}
          />
          <Path
            d={`M ${x - s * 0.3} ${y + s * 0.18} C ${x - s * 0.1} ${y + s * 0.42}, ${x + s * 0.2} ${y + s * 0.4}, ${x + s * 0.34} ${y + s * 0.2}`}
            stroke={dark}
            strokeWidth={s * 0.07}
            fill="none"
            opacity={0.55}
          />
          <Ellipse
            cx={x - s * 0.14}
            cy={y - s * 0.18}
            rx={s * 0.18}
            ry={s * 0.11}
            fill="#FFFFFF"
            opacity={0.42}
            rotation={-25}
            origin={`${x - s * 0.14}, ${y - s * 0.18}`}
          />
        </G>
      );

    case "drop":
      return (
        <G>
          <Path
            d={`M ${x} ${y - s * 0.5} C ${x + s * 0.44} ${y - s * 0.02}, ${x + s * 0.3} ${y + s * 0.52}, ${x} ${y + s * 0.52} C ${x - s * 0.3} ${y + s * 0.52}, ${x - s * 0.44} ${y - s * 0.02}, ${x} ${y - s * 0.5} Z`}
            fill={color}
          />
          <Path
            d={`M ${x - s * 0.12} ${y + s * 0.06} C ${x - s * 0.22} ${y + s * 0.3}, ${x - s * 0.04} ${y + s * 0.42}, ${x + s * 0.06} ${y + s * 0.36}`}
            stroke="#FFFFFF"
            strokeWidth={s * 0.08}
            strokeLinecap="round"
            fill="none"
            opacity={0.5}
          />
        </G>
      );
  }
}
