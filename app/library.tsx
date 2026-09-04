import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";
import { MUSCLES, type Equipment, type Muscle } from "@/workout/exercises";
import { countByMuscle, equipmentKinds, filterExercises } from "@/workout/library";
import { SelectTile } from "@/components/SelectTile";

/**
 * The whole exercise catalogue, browsable — the Hevy screen.
 *
 * Search alone was not enough: someone who does not know what the app calls a
 * movement has nothing to type. So the muscle and kit chips let them arrive at
 * it by narrowing instead, the count is always on screen so the library never
 * feels smaller than it is, and an empty result offers to add the move rather
 * than leaving them staring at nothing.
 */
export default function LibraryScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, addExerciseToday, todayExtras, addCustomExercise } = useStore();

  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");
  const [kit, setKit] = useState<Equipment | "all">("all");
  const [ownName, setOwnName] = useState("");
  const [ownMuscle, setOwnMuscle] = useState<Muscle>("fullbody");

  const custom = state.training?.custom ?? [];
  const chosen = todayExtras();

  const muscleLabel: Record<Muscle, string> = {
    chest: t.workout.muscleChest,
    back: t.workout.muscleBack,
    shoulders: t.workout.muscleShoulders,
    legs: t.workout.muscleLegs,
    glutes: t.workout.muscleGlutes,
    arms: t.workout.muscleArms,
    forearms: t.workout.muscleForearms,
    core: t.workout.muscleCore,
    fullbody: t.workout.muscleFullbody,
    cardio: t.workout.muscleCardio,
  };
  const kitLabel: Record<Equipment, string> = {
    barbell: t.library.kitBarbell,
    dumbbell: t.library.kitDumbbell,
    machine: t.library.kitMachine,
    cable: t.library.kitCable,
    bodyweight: t.library.kitBodyweight,
    kettlebell: t.library.kitKettlebell,
    smith: t.library.kitSmith,
    band: t.library.kitBand,
  };

  const counts = useMemo(() => countByMuscle(custom), [custom]);
  const kits = useMemo(() => equipmentKinds(custom), [custom]);
  const rows = useMemo(
    () => filterExercises({ query, muscle, equipment: kit, custom }, muscleLabel),
    // muscleLabel is rebuilt each render; the locale is what actually changes it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, muscle, kit, custom, locale],
  );
  const total = useMemo(() => filterExercises({ custom }).length, [custom]);

  function addOwn() {
    const name = ownName.trim();
    if (!name) return;
    // A stable id from the name, so adding the same move twice is a no-op
    // rather than a second identical row in the library.
    const id = `own-${name.replace(/\s+/g, "-").toLowerCase()}`;
    addCustomExercise({
      id,
      he: name,
      en: name,
      muscle: ownMuscle,
      equipment: "bodyweight",
      compound: false,
      howHe: [t.library.ownHow],
      howEn: [t.library.ownHow],
      yt: `${ownMuscle} exercise form`,
    });
    addExerciseToday(id);
    setOwnName("");
    setQuery("");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen
        eyebrow={fill(t.library.count, { n: total })}
        title={t.library.heading}
        subtitle={t.library.body}
        aside={
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: colors.bandRule,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={20} color={colors.bandInk} />
          </Pressable>
        }
      >
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t.library.search}
        />

        {/* narrow by muscle */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          <Chip
            label={t.library.allMuscles}
            on={muscle === "all"}
            onPress={() => setMuscle("all")}
          />
          {MUSCLES.map((m) => (
            <Chip
              key={m}
              label={`${muscleLabel[m]} ${counts[m] ?? 0}`}
              on={muscle === m}
              onPress={() => setMuscle(muscle === m ? "all" : m)}
            />
          ))}
        </View>

        {/* narrow by kit */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          <Chip label={t.library.allKit} on={kit === "all"} onPress={() => setKit("all")} />
          {kits.map((k) => (
            <Chip
              key={k}
              label={kitLabel[k]}
              on={kit === k}
              onPress={() => setKit(kit === k ? "all" : k)}
            />
          ))}
        </View>

        <Text style={[type.small, { color: colors.inkFaint }]}>
          {fill(t.library.showing, { n: rows.length })}
        </Text>

        {rows.length === 0 ? (
          <Card tone="amber">
            <Text style={[type.body, { color: colors.ink }]}>{t.library.none}</Text>
          </Card>
        ) : (
          <View style={{ gap: 6 }}>
            {rows.map((ex) => {
              const already = chosen.includes(ex.id);
              return (
                <Pressable
                  key={ex.id}
                  disabled={already}
                  accessibilityRole="button"
                  accessibilityLabel={locale === "he" ? ex.he : ex.en}
                  accessibilityState={{ selected: already }}
                  onPress={() => addExerciseToday(ex.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: 11,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: already ? colors.accent : colors.rule,
                    opacity: already ? 0.6 : 1,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                      {locale === "he" ? ex.he : ex.en}
                    </Text>
                    <Text style={[type.small, { color: colors.inkFaint }]}>
                      {muscleLabel[ex.muscle]} · {kitLabel[ex.equipment]}
                      {ex.custom ? ` · ${t.library.mine}` : ""}
                    </Text>
                  </View>
                  <Text style={[type.title, { color: colors.accent }]}>
                    {already ? "✓" : "+"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* the escape hatch: it is not here, so put it here */}
        <Card label={t.library.ownTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.library.ownBody}</Text>
          <View style={{ marginTop: space.sm }}>
            <TextField
              value={ownName}
              onChangeText={setOwnName}
              placeholder={t.library.ownPlaceholder}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm }}>
            {MUSCLES.map((m) => (
              <Chip
                key={m}
                label={muscleLabel[m]}
                on={ownMuscle === m}
                onPress={() => setOwnMuscle(m)}
              />
            ))}
          </View>
          <Button
            icon="add"
            label={t.library.ownAdd}
            onPress={addOwn}
            disabled={!ownName.trim()}
            style={{ marginTop: space.md }}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors, radius, type, space } = useTheme();
  return (
    <SelectTile
      selected={on}
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
      }}
    >
      <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>
        {label}
      </Text>
    </SelectTile>
  );
}
