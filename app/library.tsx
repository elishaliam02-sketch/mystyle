import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { ProGate } from "@/components/ProGate";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";
import { MUSCLES, type Equipment, type Muscle } from "@/workout/exercises";
import { countByMuscle, equipmentKinds, filterExercises } from "@/workout/library";
import { difficulty } from "@/workout/difficulty";
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
  const { state, addExerciseToday, removeExerciseToday, todayExtras, addCustomExercise, allowance } =
    useStore();

  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");
  const [kit, setKit] = useState<Equipment | "all">("all");
  const [ownName, setOwnName] = useState("");
  const [ownMuscle, setOwnMuscle] = useState<Muscle>("fullbody");
  const [ownNote, setOwnNote] = useState<{ text: string; ok: boolean } | null>(null);

  const custom = state.training?.custom ?? [];
  const chosen = todayExtras();
  // Only adding the next one is limited: every move already in `custom` stays
  // in the list above, searchable and addable to today's session as before.
  const canAddOwn = allowance("customExercises").ok;

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
    if (!canAddOwn) return;
    // A stable id from the name, so adding the same move twice is a no-op
    // rather than a second identical row in the library.
    const id = `own-${name.replace(/\s+/g, "-").toLowerCase()}`;
    // The store drops the duplicate silently, which read as the form clearing
    // itself and nothing else happening.
    if (custom.some((c) => c.id === id)) {
      setOwnNote({ text: t.library.alreadyMine, ok: false });
      return;
    }
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
    // Filter down to the new move, or it lands somewhere in a hundred rows
    // the person never scrolls to.
    setQuery(name);
    setOwnNote({ text: t.library.addedOwn, ok: true });
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
          <FilterChip
            label={t.library.allMuscles}
            on={muscle === "all"}
            onPress={() => setMuscle("all")}
          />
          {MUSCLES.map((m) => (
            <FilterChip
              key={m}
              label={`${muscleLabel[m]} ${counts[m] ?? 0}`}
              on={muscle === m}
              onPress={() => setMuscle(muscle === m ? "all" : m)}
            />
          ))}
        </View>

        {/* narrow by kit */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          <FilterChip label={t.library.allKit} on={kit === "all"} onPress={() => setKit("all")} />
          {kits.map((k) => (
            <FilterChip
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
          <Card tone="orange">
            <Text style={[type.body, { color: colors.ink }]}>{t.library.none}</Text>
          </Card>
        ) : (
          <View style={{ gap: 6 }}>
            {rows.map((ex) => {
              const already = chosen.includes(ex.id);
              const name = locale === "he" ? ex.he : ex.en;
              return (
                <Pressable
                  key={ex.id}
                  accessibilityRole="button"
                  // A mis-tap used to be undoable only from the Workout tab, so
                  // the tick is a switch now and says which way it goes.
                  accessibilityLabel={already ? `${name} · ${t.library.removeToday}` : name}
                  accessibilityState={{ selected: already }}
                  onPress={() => (already ? removeExerciseToday(ex.id) : addExerciseToday(ex.id))}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: 11,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    backgroundColor: already ? colors.accentWash : colors.surface,
                    borderWidth: 1,
                    borderColor: already ? colors.accent : colors.rule,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <ExerciseThumb ex={ex} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[type.small, { color: colors.inkFaint }]}>
                      {muscleLabel[ex.muscle]} · {kitLabel[ex.equipment]}
                      {ex.custom
                        ? ` · ${t.library.mine}`
                        : ` · ${[t.workout.levelBeginner, t.workout.levelIntermediate, t.workout.levelAdvanced][difficulty(ex.id) - 1]}`}
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
              onChangeText={(next) => {
                setOwnName(next);
                setOwnNote(null);
              }}
              placeholder={t.library.ownPlaceholder}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm }}>
            {MUSCLES.map((m) => (
              <FilterChip
                key={m}
                label={muscleLabel[m]}
                on={ownMuscle === m}
                onPress={() => setOwnMuscle(m)}
              />
            ))}
          </View>
          <View style={{ marginTop: space.md }}>
            {canAddOwn ? (
              <Button
                icon="add"
                label={t.library.ownAdd}
                onPress={addOwn}
                disabled={!ownName.trim()}
              />
            ) : (
              <ProGate feature="customExercises" />
            )}
          </View>
          {ownNote ? (
            <Text
              style={[
                type.small,
                { color: ownNote.ok ? colors.accent : colors.alert, marginTop: space.sm },
              ]}
            >
              {ownNote.text}
            </Text>
          ) : null}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * A filter pill. Denser than the shared Chip — this screen carries about twenty
 * of them at once — so it stays its own component, but not under a name that
 * shadows the shared one.
 */
function FilterChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors, radius, type, space } = useTheme();
  return (
    <SelectTile
      selected={on}
      onPress={onPress}
      accessibilityLabel={label}
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
