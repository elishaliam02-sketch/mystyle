import { Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { Equipment, Exercise, Muscle } from "@/workout/exercises";
import { useStore } from "@/store";
import { ON_HERO, useTheme, type Colors } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * A picture for every exercise — the thing that makes a plan read like Hevy
 * rather than a spreadsheet.
 *
 * When the exact demo video has already been resolved for this move, its
 * YouTube still is the picture: it is the real lift, and it costs nothing extra
 * because the id is already cached on the device. Until then (and offline, and
 * for a move the person invented themselves) the tile is drawn instead — a
 * colour keyed to the muscle group with the equipment's own icon over it. Drawn
 * instantly, never a blank grey box and never a spinner.
 */

/**
 * A tile per muscle group, drawn from the four colours and nothing else.
 * Ten groups over three hues, so the hue carries the region — orange for the
 * pushing muscles, blue for the pulling ones, lime for the lower body — and a
 * second weight of the same hue tells the members of a family apart. The
 * equipment glyph on top does the rest; this is a picture, not a readout, so
 * it never needs a colour the palette does not have.
 */
type Tile = { from: string; to: string; ink: string };

function muscleColors(colors: Colors): Record<Muscle, Tile> {
  const light = { ink: ON_HERO };
  // Neon lime is far too bright to carry a white glyph — charcoal rides on it.
  const dark = { ink: colors.onLime };
  return {
    // push — orange
    chest: { from: colors.orange, to: colors.alert, ...light },
    shoulders: { from: colors.alert, to: colors.alertDeep, ...light },
    arms: { from: colors.orange, to: colors.alertDeep, ...light },
    // pull — electric blue
    back: { from: colors.accent, to: colors.accentDeep, ...light },
    forearms: { from: colors.accentDeep, to: colors.bandTop, ...light },
    cardio: { from: colors.accent, to: colors.bandTop, ...light },
    // lower body — neon lime
    legs: { from: colors.lime, to: colors.limeDeep, ...dark },
    glutes: { from: colors.limeDeep, to: colors.band, ...light },
    core: { from: colors.lime, to: colors.band, ...dark },
    // everything at once — charcoal
    fullbody: { from: colors.bandTop, to: colors.band, ...light },
  };
}

/** The icon that reads most like the kit the move is done with. */
const EQUIPMENT_ICONS: Record<Equipment, IconName> = {
  barbell: "barbell",
  dumbbell: "barbell-outline",
  machine: "cog",
  cable: "git-commit",
  bodyweight: "body",
  kettlebell: "fitness",
  smith: "grid",
  band: "infinite",
};

export function ExerciseThumb({
  ex,
  size = 56,
}: {
  ex: Exercise;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  const { state } = useStore();
  const videoId = state.videoIds?.[ex.id];
  const tiles = muscleColors(colors);
  const { from, to, ink } = tiles[ex.muscle] ?? tiles.fullbody;

  if (videoId) {
    return (
      <Image
        source={{ uri: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` }}
        style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: from }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={EQUIPMENT_ICONS[ex.equipment] ?? "barbell"}
        size={Math.round(size * 0.45)}
        color={ink}
      />
      {/* a compound lift gets a small mark, so the big lifts stand out */}
      {ex.compound ? (
        <View
          style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: ink,
            opacity: 0.9,
          }}
        />
      ) : null}
    </LinearGradient>
  );
}
