import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import type { Goal } from "@/kitchen";
import { useStore } from "@/store";
import { useTheme } from "@/theme";
import {
  MUSCLES,
  demoUrl,
  type Exercise,
  type Muscle,
} from "@/workout/exercises";
import { buildPlan, type DayType } from "@/workout/plan";

const GOALS: Goal[] = ["cut", "recomp", "maintain", "bulk"];
const DAYS = [2, 3, 4, 5, 6];

export default function WorkoutScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, configureTraining, toggleExerciseDone, isExerciseDone, addCustomExercise } =
    useStore();

  const training = state.training;
  const [goal, setGoal] = useState<Goal>(training?.goal ?? "recomp");
  const [days, setDays] = useState<number>(training?.days ?? 3);
  const [setup, setSetup] = useState(!training);

  const goalLabel: Record<Goal, string> = {
    cut: t.workout.goalCut,
    recomp: t.workout.goalRecomp,
    maintain: t.workout.goalMaintain,
    bulk: t.workout.goalBulk,
  };
  const dayLabel: Record<DayType, string> = {
    push: t.workout.dayPush,
    pull: t.workout.dayPull,
    legs: t.workout.dayLegs,
    upper: t.workout.dayUpper,
    lower: t.workout.dayLower,
    fullA: t.workout.dayFullA,
    fullB: t.workout.dayFullB,
  };
  const muscleLabel: Record<Muscle, string> = {
    chest: t.workout.muscleChest,
    back: t.workout.muscleBack,
    shoulders: t.workout.muscleShoulders,
    legs: t.workout.muscleLegs,
    glutes: t.workout.muscleGlutes,
    arms: t.workout.muscleArms,
    core: t.workout.muscleCore,
    fullbody: t.workout.muscleFullbody,
    cardio: t.workout.muscleCardio,
  };

  const plan = useMemo(
    () => (training ? buildPlan(training.goal, training.days) : null),
    [training],
  );

  function build() {
    configureTraining(goal, days);
    setSetup(false);
  }

  // ---- setup form: pick a goal and weekly frequency ----
  if (setup || !training || !plan) {
    return (
      <Screen title={t.workout.heading} subtitle={t.workout.body}>
        <Card label={t.workout.goalTitle}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {GOALS.map((g) => {
              const on = goal === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGoal(g)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexGrow: 1,
                    flexBasis: "47%",
                    alignItems: "center",
                    paddingVertical: space.md,
                    borderRadius: radius.lg,
                    backgroundColor: on ? colors.accent : colors.surfaceAlt,
                  }}
                >
                  <Text style={[type.bodyStrong, { color: on ? colors.onAccent : colors.ink }]}>
                    {goalLabel[g]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card label={t.workout.daysTitle}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {DAYS.map((d) => {
              const on = days === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDays(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: space.md,
                    borderRadius: radius.md,
                    backgroundColor: on ? colors.accent : colors.surfaceAlt,
                  }}
                >
                  <Text style={[type.title, { color: on ? colors.onAccent : colors.ink }]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
            {t.workout.daysUnit}
          </Text>
        </Card>

        <Button icon="barbell" label={t.workout.build} onPress={build} />

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.workout.videoNote}
        </Text>
      </Screen>
    );
  }

  // ---- the built plan ----
  const custom = training.custom;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.workout.heading} subtitle={t.workout.body}>
        <Card tone="accent">
          <Text style={[type.title, { color: colors.ink }]}>
            {goalLabel[plan.goal]} · {fill(t.workout.planFor, { days: plan.days })}
          </Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]}>
            {fill(t.workout.setsReps, { sets: plan.sets, reps: plan.reps })}
          </Text>
          <Button
            label={t.workout.change}
            tone="quiet"
            onPress={() => {
              setGoal(plan.goal);
              setDays(plan.days);
              setSetup(true);
            }}
            style={{ marginTop: space.md }}
          />
        </Card>

        {plan.sessions.map((session, i) => {
          const done = session.exercises.filter((e) => isExerciseDone(e.id)).length;
          return (
            <Card key={`${session.type}-${i}`} label={fill(t.workout.day, { n: i + 1 })}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: space.sm,
                }}
              >
                <Text style={[type.title, { color: colors.ink }]}>{dayLabel[session.type]}</Text>
                <Text style={[type.smallStrong, { color: colors.accent }]}>
                  {fill(t.workout.doneCount, { done, total: session.exercises.length })}
                </Text>
              </View>
              {session.exercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  sets={plan.sets}
                  reps={plan.reps}
                  muscleLabel={muscleLabel}
                  done={isExerciseDone(ex.id)}
                  onToggle={() => toggleExerciseDone(ex.id)}
                />
              ))}
            </Card>
          );
        })}

        {custom.length > 0 ? (
          <Card label={t.workout.myExercises}>
            {custom.map((ex) => (
              <ExerciseRow
                key={ex.id}
                ex={ex}
                sets={plan.sets}
                reps={plan.reps}
                muscleLabel={muscleLabel}
                done={isExerciseDone(ex.id)}
                onToggle={() => toggleExerciseDone(ex.id)}
              />
            ))}
          </Card>
        ) : null}

        <AddExercise muscleLabel={muscleLabel} onAdd={addCustomExercise} />

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.workout.videoNote}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

type RowProps = {
  ex: Exercise;
  sets: number;
  reps: string;
  muscleLabel: Record<Muscle, string>;
  done: boolean;
  onToggle: () => void;
};

function ExerciseRow({ ex, sets, reps, muscleLabel, done, onToggle }: RowProps) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [open, setOpen] = useState(false);
  const name = locale === "he" ? ex.he : ex.en;
  const how = locale === "he" ? ex.howHe : ex.howEn;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.rule,
        paddingVertical: space.sm,
        gap: space.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          hitSlop={8}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: done ? colors.accent : colors.ruleStrong,
            backgroundColor: done ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {done ? <Text style={{ color: colors.onAccent, fontWeight: "900" }}>✓</Text> : null}
        </Pressable>

        <Pressable onPress={() => setOpen((v) => !v)} style={{ flex: 1 }}>
          <Text
            style={[
              type.bodyStrong,
              { color: colors.ink, textDecorationLine: done ? "line-through" : "none" },
            ]}
          >
            {name}
          </Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>
            {muscleLabel[ex.muscle]} · {sets}×{reps}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL(demoUrl(ex))}
          accessibilityRole="link"
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.accentWash,
            borderRadius: radius.pill,
            paddingVertical: 5,
            paddingHorizontal: 10,
          }}
        >
          <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>▶</Text>
          <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
            {t.workout.watch}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <View style={{ gap: 4, marginTop: 2, paddingStart: 34 }}>
          <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
            {t.workout.howTitle}
          </Text>
          {how.map((step, i) => (
            <Text key={i} style={[type.small, { color: colors.inkSoft }]}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AddExercise({
  muscleLabel,
  onAdd,
}: {
  muscleLabel: Record<Muscle, string>;
  onAdd: (ex: Omit<Exercise, "custom">) => void;
}) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [name, setName] = useState("");
  const [yt, setYt] = useState("");
  const [muscle, setMuscle] = useState<Muscle>("core");

  function add() {
    const clean = name.trim();
    if (!clean) return;
    const id = `custom-${Date.now().toString(36)}`;
    onAdd({
      id,
      he: clean,
      en: clean,
      muscle,
      equipment: "bodyweight",
      compound: false,
      howHe: [],
      howEn: [],
      // Fall back to the name itself so the demo link still opens something useful.
      yt: (yt.trim() || clean) + " exercise form",
    });
    setName("");
    setYt("");
  }

  return (
    <Card label={t.workout.addTitle}>
      <TextField
        value={name}
        onChangeText={setName}
        label={t.workout.addName}
        placeholder={t.workout.addNamePlaceholder}
      />
      <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase", marginTop: space.md }]}>
        {t.workout.addMuscle}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs }}>
        {MUSCLES.map((m) => {
          const on = muscle === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMuscle(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                borderRadius: radius.pill,
                paddingVertical: 6,
                paddingHorizontal: 12,
                backgroundColor: on ? colors.accent : colors.surfaceAlt,
              }}
            >
              <Text style={[type.small, { color: on ? colors.onAccent : colors.inkSoft, fontWeight: "700" }]}>
                {muscleLabel[m]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: space.md }}>
        <TextField
          value={yt}
          onChangeText={setYt}
          label={t.workout.addYt}
          placeholder="squat form"
        />
      </View>
      <Button
        icon="add"
        label={t.workout.addSave}
        onPress={add}
        disabled={!name.trim()}
        style={{ marginTop: space.md }}
      />
    </Card>
  );
}
