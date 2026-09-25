import { useMemo, useState } from "react";
import { difficulty } from "@/workout/difficulty";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { MUSCLES, type Equipment, type Exercise, type Muscle } from "@/workout/exercises";
import { equipmentKinds, filterExercises } from "@/workout/library";
import { useTheme } from "@/theme";

/**
 * The Hevy "add exercise" sheet: the whole library, browsable.
 *
 * Building a plan the way people expect means seeing every move at once and
 * narrowing to it — by muscle, by kit, by name — with a picture beside each so
 * a name you do not recognise still means something. The old add-a-move box
 * was search-only: you had to already know what the app called a lift before
 * you could find it, which is the opposite of browsing. This is a real
 * catalogue you scroll, filter and pick from, and it picks several at once so
 * building a day is a few taps and not a few dozen.
 *
 * It carries its own list of what is already on the day, so a move already
 * there reads as added rather than offering to add it twice.
 */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  have,
  custom,
  muscleLabel,
  kitLabel,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called once per chosen exercise when the sheet is closed with Done. */
  onPick: (id: string) => void;
  /** Ids already on the day, shown as added and not re-addable. */
  have: string[];
  custom: Exercise[];
  muscleLabel: Record<Muscle, string>;
  kitLabel: Record<Equipment, string>;
}) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();

  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");
  const [kit, setKit] = useState<Equipment | "all">("all");
  // What was chosen this visit — committed to the day on Done, so a burst of
  // taps becomes one edit rather than one re-render fight per tap.
  const [picked, setPicked] = useState<string[]>([]);

  const kits = useMemo(() => equipmentKinds(custom), [custom]);
  const rows = useMemo(
    () => filterExercises({ query: q, muscle, equipment: kit, custom }, muscleLabel),
    [q, muscle, kit, custom, muscleLabel],
  );

  function done() {
    for (const id of picked) onPick(id);
    setPicked([]);
    setQ("");
    setMuscle("all");
    setKit("all");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={done} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.ground, paddingTop: insets.top }}>
        {/* header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
          }}
        >
          <Pressable
            onPress={done}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
          <Text style={[type.title, { color: colors.ink, flex: 1 }]}>{t.workout.pickTitle}</Text>
          {picked.length > 0 ? (
            <Text style={[type.smallStrong, { color: colors.accent }]}>
              {fill(t.workout.pickCount, { n: picked.length })}
            </Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: space.lg }}>
          <TextField value={q} onChangeText={setQ} placeholder={t.workout.pickSearch} />
        </View>

        {/* muscle chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // A row of chips, not a panel: on the web a horizontal scroller
          // grows to fill the sheet and left two results on screen.
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs, paddingVertical: space.sm, alignItems: "center" }}
        >
          {(["all", ...MUSCLES] as const).map((m) => {
            const on = muscle === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMuscle(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  backgroundColor: on ? colors.accent : colors.surfaceAlt,
                }}
              >
                <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>
                  {m === "all" ? t.workout.pickAll : muscleLabel[m]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* kit chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // A row of chips, not a panel: on the web a horizontal scroller
          // grows to fill the sheet and left two results on screen.
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs, paddingBottom: space.sm, alignItems: "center" }}
        >
          {(["all", ...kits] as const).map((k) => {
            const on = kit === k;
            return (
              <Pressable
                key={k}
                onPress={() => setKit(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  backgroundColor: on ? colors.accentWash : "transparent",
                  borderWidth: 1,
                  borderColor: on ? colors.accent : colors.rule,
                }}
              >
                <Text style={[type.small, { color: on ? colors.accent : colors.inkSoft }]}>
                  {k === "all" ? t.workout.pickAll : kitLabel[k]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* the catalogue */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: 6 }}
        >
          {rows.length === 0 ? (
            <Text style={[type.small, { color: colors.inkFaint, marginTop: space.md }]}>
              {t.workout.pickNone}
            </Text>
          ) : (
            rows.map((ex) => {
              const already = have.includes(ex.id);
              const chosen = picked.includes(ex.id);
              const on = already || chosen;
              return (
                <Pressable
                  key={ex.id}
                  disabled={already}
                  accessibilityRole="button"
                  accessibilityLabel={locale === "he" ? ex.he : ex.en}
                  accessibilityState={{ selected: on }}
                  onPress={() =>
                    setPicked((p) => (p.includes(ex.id) ? p.filter((x) => x !== ex.id) : [...p, ex.id]))
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    padding: space.sm,
                    borderRadius: radius.md,
                    backgroundColor: chosen ? colors.accentWash : colors.surface,
                    borderWidth: 1,
                    borderColor: on ? colors.accent : colors.rule,
                    opacity: already ? 0.55 : 1,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 }}
                  >
                    <ExerciseThumb ex={ex} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                        {locale === "he" ? ex.he : ex.en}
                      </Text>
                      <Text style={[type.small, { color: colors.inkFaint }]}>
                        {muscleLabel[ex.muscle]} · {kitLabel[ex.equipment]}
                        {ex.custom
                          ? ""
                          : ` · ${[t.workout.levelBeginner, t.workout.levelIntermediate, t.workout.levelAdvanced][difficulty(ex.id) - 1]}`}
                      </Text>
                    </View>
                    <Ionicons
                      name={already ? "checkmark-done" : chosen ? "checkmark-circle" : "add-circle-outline"}
                      size={24}
                      color={on ? colors.accent : colors.inkFaint}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* commit */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: Math.max(space.md, insets.bottom + space.sm),
            borderTopWidth: 1,
            borderTopColor: colors.rule,
            backgroundColor: colors.surface,
          }}
        >
          <Button
            icon="checkmark"
            label={picked.length > 0 ? fill(t.workout.pickAdd, { n: picked.length }) : t.workout.pickDone}
            onPress={done}
          />
        </View>
      </View>
    </Modal>
  );
}
