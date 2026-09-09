import { Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { Equipment, Exercise, Muscle } from "@/workout/exercises";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

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

/** A distinct colour per muscle group, so a session reads at a glance. */
const MUSCLE_COLORS: Record<Muscle, [string, string]> = {
  chest: ["#E4572E", "#B3391C"],
  back: ["#2E86AB", "#1B5A75"],
  shoulders: ["#F2A65A", "#C97B29"],
  legs: ["#5B8C5A", "#375C36"],
  glutes: ["#A05195", "#6E3266"],
  arms: ["#D7263D", "#96182A"],
  forearms: ["#B56576", "#7E4150"],
  core: ["#E9C46A", "#B8933F"],
  fullbody: ["#4D5D75", "#2E3A4B"],
  cardio: ["#EF476F", "#B32E4E"],
};

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

/**
 * A deterministic little shift per exercise, so two chest presses never draw
 * the identical tile. The muscle colour still carries the meaning — this only
 * moves the shade and the light direction, by a fixed amount derived from the
 * exercise's own id, so a move looks the same on every phone and on every
 * render.
 */
function hash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // avalanche, so neighbouring ids land far apart
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  return h >>> 0;
}

/** Nudge a #rrggbb hex by a signed amount per channel, clamped. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, c + amount)),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const ANGLES: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [
  { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
];

export function ExerciseThumb({
  ex,
  size = 56,
}: {
  ex: Exercise;
  size?: number;
}) {
  const { radius } = useTheme();
  const { state } = useStore();
  const videoId = state.videoIds?.[ex.id];
  const [baseFrom, baseTo] = MUSCLE_COLORS[ex.muscle] ?? MUSCLE_COLORS.fullbody;
  const h = hash(ex.id);
  const lift = ((h >>> 3) % 5) * 9 - 18; // −18…+18 per channel
  const from = shade(baseFrom, lift);
  const to = shade(baseTo, lift);
  const angle = ANGLES[h % ANGLES.length]!;

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
      start={angle.start}
      end={angle.end}
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
        color="#FFFFFF"
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
            backgroundColor: "#FFFFFF",
            opacity: 0.9,
          }}
        />
      ) : null}
    </LinearGradient>
  );
}
