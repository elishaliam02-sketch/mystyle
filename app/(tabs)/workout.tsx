import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { SelectTile } from "@/components/SelectTile";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { MuscleMap } from "@/components/MuscleMap";
import { view, worked } from "@/workout/muscles";
import { HeroCard } from "@/components/HeroCard";
import { ProGate } from "@/components/ProGate";
import { Card } from "@/components/Card";
import { FocusCard } from "@/components/FocusCard";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import type { Goal } from "@/kitchen";
import { useStore } from "@/store";
import { metricFill, metricInk, onMetric, ON_HERO, ON_HERO_SOFT, useTheme } from "@/theme";
import {
  EXERCISES,
  MUSCLES,
  type Exercise,
  type Muscle,
} from "@/workout/exercises";
import { applyDayEdits, buildPlan, type DayType } from "@/workout/plan";
import { clampKg, clampReps, progress, typedNumber, typedValue, MAX_SETS } from "@/workout/sets";
import { cardioPlan } from "@/workout/cardio";
import { bestLift, lastLift, MAX_KG, MIN_KG } from "@/workout/lifts";

const GOALS: Goal[] = ["cut", "recomp", "maintain", "bulk"];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];
const EQUIP = ["gym", "home", "bodyweight"] as const;

export default function WorkoutScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const { state, goal: goalOf, configureTraining, regeneratePlan, planSeed, isExerciseDone, addCustomExercise, completeSession,
    addExerciseToday, todayExtras, addToDay, removeFromDay, setTrainingMode } = useStore();

  const training = state.training;
  // Default to the app-wide goal, so the plan starts on the goal the person
  // already chose in the kitchen or on the Today screen.
  const [goal, setGoal] = useState<Goal>(training?.goal ?? goalOf());
  const [days, setDays] = useState<number>(training?.days ?? 3);
  const [minutes, setMinutes] = useState<number>(training?.minutes ?? 45);
  const [equipment, setEquipment] = useState<string>(training?.equipment ?? "gym");
  // Weak muscles the person wants the generated plan to lead with.
  const [focus, setFocus] = useState<Muscle[]>((training?.focus as Muscle[]) ?? []);
  // How the plan is made: the app builds it, or the person builds each day.
  const [mode, setMode] = useState<"auto" | "custom">((training?.mode as "auto" | "custom") ?? "auto");
  // Show the setup form whenever there is no plan yet, or when the person
  // explicitly reopened it. Deriving from `training` rather than a snapshot
  // taken at mount means a plan loaded from storage after the first render
  // still lands on the plan view, not stuck on setup.
  const [forceSetup, setForceSetup] = useState(false);
  const setup = !training || forceSetup;

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
    forearms: t.workout.muscleForearms,
    core: t.workout.muscleCore,
    fullbody: t.workout.muscleFullbody,
    cardio: t.workout.muscleCardio,
  };

  const seed = planSeed();
  const plan = useMemo(
    () =>
      training
        ? buildPlan(training.goal, training.days, training.minutes, training.equipment, {
            seed,
            focus: (training.focus as Muscle[]) ?? [],
          })
        : null,
    [training, seed],
  );

  // Every move the app knows about — the library plus the person's own — so a
  // day's hand-picked additions resolve to real exercises.
  const byId = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const e of [...EXERCISES, ...(training?.custom ?? [])]) map.set(e.id, e);
    return (id: string) => map.get(id);
  }, [training?.custom]);

  // The plan the person actually sees: the generated sessions (or empty days,
  // when they chose to build it themselves) with their own per-day add/remove
  // edits applied on top. This is the Hevy-style "my plan" layer.
  const sessions = useMemo(() => {
    if (!plan || !training) return [];
    const isCustom = training.mode === "custom";
    return plan.sessions.map((s, i) => ({
      ...s,
      exercises: applyDayEdits(isCustom ? [] : s.exercises, training.planEdits?.[i], byId),
    }));
  }, [plan, training, byId]);


  function build() {
    configureTraining(goal, days, minutes, equipment, focus, mode);
    setForceSetup(false);
  }

  function reopenSetup() {
    if (training) {
      setGoal(training.goal);
      setDays(training.days);
      setMinutes(training.minutes ?? 45);
      setEquipment(training.equipment ?? "gym");
      setFocus((training.focus as Muscle[]) ?? []);
      setMode((training.mode as "auto" | "custom") ?? "auto");
    }
    setForceSetup(true);
  }

  // ---- setup form: pick a goal and weekly frequency ----
  if (setup || !training || !plan) {
    return (
      <Screen title={t.workout.heading} subtitle={t.workout.body}>
        {/* The choice and the action, both above the fold. The build button used
            to sit under six cards of options, so people scrolled, gave up, and
            concluded the app could not build a plan at all. */}
        <HeroCard>
          <Text style={[type.display, { color: ON_HERO, fontSize: 22, lineHeight: 28 }]}>
            {t.workout.modeTitle}
          </Text>

          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {(["auto", "custom"] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    gap: 3,
                    paddingVertical: space.md,
                    paddingHorizontal: space.sm,
                    borderRadius: radius.lg,
                    backgroundColor: on ? "#FFFFFF" : pressed ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: on ? "#FFFFFF" : "rgba(255,255,255,0.22)",
                  })}
                >
                  <Text style={[type.bodyStrong, { color: on ? colors.accent : ON_HERO }]}>
                    {m === "auto" ? t.workout.modeAuto : t.workout.modeCustom}
                  </Text>
                  <Text
                    style={[
                      type.small,
                      { color: on ? colors.inkSoft : ON_HERO_SOFT, textAlign: "center" },
                    ]}
                  >
                    {m === "auto" ? t.workout.modeAutoHint : t.workout.modeCustomHint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={build}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 54,
              marginTop: space.sm,
              borderRadius: radius.pill,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: pressed ? 0.9 : 1,
              shadowColor: "#000000",
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 5,
            })}
          >
            <Ionicons name="barbell" size={20} color={colors.accent} />
            <Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: colors.accent }}>
              {mode === "custom" ? t.workout.buildCustom : t.workout.build}
            </Text>
          </Pressable>

          <Text style={[type.small, { color: ON_HERO_SOFT, marginTop: 2 }]}>
            {mode === "custom" ? t.workout.setupNoteCustom : t.workout.setupNoteAuto}
          </Text>
        </HeroCard>

        <Card label={t.workout.goalTitle}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {GOALS.map((g) => {
              const on = goal === g;
              return (
                <SelectTile
                  key={g}
                  selected={on}
                  onPress={() => setGoal(g)}
                  style={{
                    flexGrow: 1,
                    flexBasis: "47%",
                    alignItems: "center",
                    paddingVertical: space.md,
                    borderRadius: radius.lg,
                  }}
                >
                  <Text style={[type.bodyStrong, { color: on ? colors.onAccent : colors.ink }]}>
                    {goalLabel[g]}
                  </Text>
                </SelectTile>
              );
            })}
          </View>
        </Card>

        <Card label={t.workout.daysTitle}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {DAYS.map((d) => {
              const on = days === d;
              return (
                <SelectTile
                  key={d}
                  selected={on}
                  onPress={() => setDays(d)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: space.md,
                    borderRadius: radius.md,
                  }}
                >
                  <Text style={[type.title, { color: on ? colors.onAccent : colors.ink }]}>{d}</Text>
                </SelectTile>
              );
            })}
          </View>
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
            {t.workout.daysUnit}
          </Text>
        </Card>

        <Card label={t.workout.timeTitle}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {MINUTES.map((m) => {
              const on = minutes === m;
              return (
                <SelectTile
                  key={m}
                  selected={on}
                  onPress={() => setMinutes(m)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: space.md,
                    borderRadius: radius.md,
                  }}
                >
                  <Text style={[type.bodyStrong, { color: on ? colors.onAccent : colors.ink }]}>{m}</Text>
                </SelectTile>
              );
            })}
          </View>
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
            {t.workout.timeUnit}
          </Text>
        </Card>

        <Card label={t.workout.equipTitle}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {EQUIP.map((e) => {
              const on = equipment === e;
              const label =
                e === "gym" ? t.workout.equipGym : e === "home" ? t.workout.equipHome : t.workout.equipBody;
              return (
                <SelectTile
                  key={e}
                  selected={on}
                  onPress={() => setEquipment(e)}
                  style={{
                    flexGrow: 1,
                    flexBasis: "30%",
                    alignItems: "center",
                    paddingVertical: space.md,
                    paddingHorizontal: space.xs,
                    borderRadius: radius.lg,
                  }}
                >
                  <Text
                    style={[type.smallStrong, { color: on ? colors.onAccent : colors.ink, textAlign: "center" }]}
                  >
                    {label}
                  </Text>
                </SelectTile>
              );
            })}
          </View>
        </Card>

        {/* weak-muscle focus — the generated plan leads with these */}
        <Card label={t.workout.focusTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.workout.focusHint}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm }}>
            {FOCUS_MUSCLES.map((m) => {
              const on = focus.includes(m);
              return (
                <SelectTile
                  key={m}
                  selected={on}
                  onPress={() =>
                    setFocus((f) => (f.includes(m) ? f.filter((x) => x !== m) : [...f, m]))
                  }
                  style={{ borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}
                >
                  <Text style={[type.small, { color: on ? colors.onAccent : colors.inkSoft, fontWeight: "700" }]}>
                    {muscleLabel[m]}
                  </Text>
                </SelectTile>
              );
            })}
          </View>
        </Card>

        {/* W-9: reopening the form used to be a one-way door — the only exit
            was rebuilding, which silently discards every hand-picked exercise
            whenever the number of days changes. Now the way out is on screen,
            and the cost of going forward is stated before it is paid. */}
        {training ? (
          <>
            {days !== training.days && Object.keys(training.planEdits ?? {}).length > 0 ? (
              <Card tone="orange">
                <Text style={[type.small, { color: colors.ink }]}>{t.workout.daysResetWarn}</Text>
              </Card>
            ) : null}
            <Button
              icon="arrow-undo"
              label={t.workout.cancelSetup}
              tone="quiet"
              onPress={() => setForceSetup(false)}
            />
          </>
        ) : (
          <Button
            icon="barbell"
            label={mode === "custom" ? t.workout.buildCustom : t.workout.build}
            onPress={build}
          />
        )}

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.workout.videoNote}
        </Text>
      </Screen>
    );
  }

  // ---- the built plan ----
  const custom = training.custom;
  const focusList = ((training.focus as Muscle[]) ?? []).map((m) => muscleLabel[m]);
  const focusNote = focusList.length ? fill(t.workout.focusNote, { muscles: focusList.join(", ") }) : null;

  // Exercises pulled in from the library for today, shown on the first session.
  const extraIds = todayExtras();
  const extraExercises = [...EXERCISES, ...custom].filter((e) => extraIds.includes(e.id));

  // Lifetime and this-week training figures, straight from the log.
  const log = training.log;
  const workoutDays = Object.values(log).filter((ids) => ids.length > 0).length;
  const exercisesDone = Object.values(log).reduce((n, ids) => n + ids.length, 0);
  const weekCutoff = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const thisWeek = Object.entries(log)
    .filter(([date]) => date >= weekCutoff)
    .reduce((n, [, ids]) => n + ids.length, 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen
        title={t.workout.heading}
        subtitle={t.workout.bodyPlan}
      >
        <HeroCard>
          <Text style={[type.display, { color: ON_HERO, fontSize: 22, lineHeight: 28 }]}>
            {goalLabel[plan.goal]} · {fill(t.workout.planFor, { days: plan.days })}
          </Text>
          <Text style={[type.body, { color: ON_HERO_SOFT, marginTop: 2 }]}>
            {fill(t.workout.setsReps, { sets: plan.sets, reps: plan.reps })}
            {plan.minutes ? ` · ${fill(t.workout.session, { min: plan.minutes })}` : ""}
          </Text>
          {focusNote ? (
            <Text style={[type.small, { color: ON_HERO, fontWeight: "700", marginTop: 4 }]}>
              {focusNote}
            </Text>
          ) : null}
          {/* both ways of having a plan, switchable at any time and without
              losing either: the generated days stay generated, the person's own
              picks stay theirs, and flipping back returns exactly what was there */}
          <View style={{ flexDirection: "row", gap: space.xs, marginTop: space.md }}>
            {(["auto", "custom"] as const).map((m) => {
              const on = (training.mode ?? "auto") === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setTrainingMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: space.sm,
                    borderRadius: radius.pill,
                    backgroundColor: on
                      ? "#FFFFFF"
                      : pressed
                        ? "rgba(255,255,255,0.26)"
                        : "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: on ? "#FFFFFF" : "rgba(255,255,255,0.22)",
                  })}
                >
                  <Text style={[type.smallStrong, { color: on ? colors.accent : ON_HERO }]}>
                    {m === "auto" ? t.workout.modeAuto : t.workout.modeCustom}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            {(
              [
                ["options" as const, t.workout.change, reopenSetup],
                ["shuffle" as const, t.workout.regenerate, regeneratePlan],
              ] as const
            ).map(([icon, label, onPress]) => (
              <Pressable
                key={label}
                onPress={onPress}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1,
                  height: 46,
                  borderRadius: radius.pill,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: pressed ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.16)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.22)",
                })}
              >
                <Ionicons name={icon} size={17} color={ON_HERO} />
                <Text style={[type.smallStrong, { color: ON_HERO }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </HeroCard>


        {sessions.map((session, i) => {
          const dayExercises = [...session.exercises, ...(i === 0 ? extraExercises : [])];
          const done = dayExercises.filter((e) => isExerciseDone(e.id)).length;
          const total = dayExercises.length;
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
                <Text style={[type.smallStrong, { color: metricInk(colors, "ticks") }]}>
                  {fill(t.workout.doneCount, { done, total })}
                </Text>
              </View>
              {dayExercises.length === 0 ? (
                <View style={{ gap: space.sm }}>
                  <Text style={[type.small, { color: colors.inkFaint }]}>{t.workout.dayEmpty}</Text>
                  {/* even a self-built plan can borrow a ready-made day, so the
                      two ways of building live side by side rather than one or
                      the other */}
                  <PillButton
                    tone="soft"
                    icon="sparkles"
                    label={t.workout.fillDay}
                    onPress={() => {
                      for (const e of plan.sessions[i]?.exercises ?? []) addToDay(i, e.id);
                    }}
                    style={{ alignSelf: "flex-start" }}
                  />
                </View>
              ) : (
                dayExercises.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    ex={ex}
                    sets={plan.sets}
                    reps={plan.reps}
                    muscleLabel={muscleLabel}
                    onRemove={() => removeFromDay(i, ex.id)}
                  />
                ))
              )}

              {/* add any move to this exact day — the plan is yours to edit */}
              <DayAdder
                muscleLabel={muscleLabel}
                have={dayExercises.map((e) => e.id)}
                onPick={(id) => addToDay(i, id)}
              />

              {total > 0 ? (
                done === total ? (
                  // a finished day is a state, not a disabled control: a greyed
                  // button reads as something broken rather than something done
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      marginTop: space.md,
                      paddingVertical: 11,
                      borderRadius: radius.pill,
                      backgroundColor: colors.accentWash,
                    }}
                  >
                    <Ionicons name="checkmark-done" size={18} color={colors.accent} />
                    <Text style={[type.smallStrong, { color: colors.accent }]}>
                      {t.workout.dayDone}
                    </Text>
                  </View>
                ) : (
                  <Button
                    icon="checkmark"
                    label={t.workout.finishDay}
                    tone="quiet"
                    onPress={() => completeSession(dayExercises.map((e) => e.id))}
                    style={{ marginTop: space.md }}
                  />
                )
              ) : null}
            </Card>
          );
        })}

        {workoutDays > 0 ? (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {(
                [
                  [workoutDays, t.workout.statsDays],
                  [exercisesDone, t.workout.statsExercises],
                  [thisWeek, t.workout.statsThisWeek],
                ] as const
              ).map(([value, label], i) => (
                <View key={i} style={{ alignItems: "center", flex: 1 }}>
                  <Text style={[type.figure, { color: metricInk(colors, "ticks") }]}>{value}</Text>
                  <Text style={[type.small, { color: colors.inkFaint, textAlign: "center" }]}>{label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <FocusCard />

        <RestTimer />

        <CardioCard goal={training.goal} seed={seed} />

        {custom.length > 0 ? (
          <Card label={t.workout.myExercises}>
            {custom.map((ex) => (
              <ExerciseRow
                key={ex.id}
                ex={ex}
                sets={plan.sets}
                reps={plan.reps}
                muscleLabel={muscleLabel}
              />
            ))}
          </Card>
        ) : null}

        <LibraryPicker
          muscleLabel={muscleLabel}
          chosen={extraIds}
          onPick={addExerciseToday}
        />

        <AddExercise muscleLabel={muscleLabel} onAdd={addCustomExercise} />

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.workout.videoNote}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * One box in the set table.
 *
 * The value lives here as text while it is being typed and only reaches the
 * store when it reads as a whole number, because pushing every keystroke
 * through the clamp and rendering the result back is what made "62.5"
 * impossible to enter: the dot was stripped the instant it was typed. On blur
 * the draft is dropped and the box goes back to showing the stored number, so
 * whatever the store settled on is always what is finally displayed.
 */
function SetField({
  value,
  decimals,
  onCommit,
  placeholder,
  accessibilityLabel,
  ink,
}: {
  value: number;
  decimals: boolean;
  onCommit: (n: number) => void;
  placeholder: string;
  accessibilityLabel: string;
  /** The metric's own colour — load and reps are different numbers. */
  ink: string;
}) {
  const { colors, radius, font } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);

  const shown = draft ?? (value ? String(value) : "");

  return (
    <TextInput
      value={shown}
      onChangeText={(raw) => {
        const text = typedNumber(raw, decimals);
        setDraft(text);
        const n = typedValue(text);
        // "62." is a real thing to have typed and not yet a number: leave the
        // stored value alone rather than committing a half-finished one.
        if (n !== null) onCommit(n);
        else if (text === "") onCommit(0);
      }}
      onBlur={() => setDraft(null)}
      keyboardType={decimals ? "decimal-pad" : "number-pad"}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      accessibilityLabel={accessibilityLabel}
      style={{
        flex: 1,
        // A web <input> carries an intrinsic width that flex will not shrink
        // past unless min-width is cleared — without this the set row runs off
        // the card and takes the tick box with it.
        minWidth: 0,
        textAlign: "center",
        paddingVertical: 7,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        color: ink,
        fontFamily: font.bodyMedium,
        fontSize: 15,
      }}
    />
  );
}

const REST_PRESETS = [60, 90, 120];

/**
 * The cardio card — conditioning tailored to the goal and rolled from the same
 * per-device seed as the plan, so it truly differs between a cut and a bulk and
 * between one person and the next. Each row opens its own demo video.
 */
function CardioCard({ goal, seed }: { goal: Goal; seed: string }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { demoFor } = useStore();
  const [loading, setLoading] = useState<string | null>(null);

  const plan = useMemo(() => cardioPlan(goal, seed), [goal, seed]);
  if (plan.sessions.length === 0) return null;

  const openDemo = async (exerciseId: string) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    setLoading(exerciseId);
    try {
      Linking.openURL(await demoFor(ex));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card label={t.workout.cardioTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>
        {fill(t.workout.cardioPerWeek, { n: plan.perWeek })} · {locale === "he" ? plan.he : plan.en}
      </Text>
      <View style={{ gap: 6, marginTop: space.md }}>
        {plan.sessions.map((s, i) => (
          <View
            key={`${s.exerciseId}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              paddingVertical: 9,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Ionicons
              name={s.style === "interval" ? "flash" : "walk"}
              size={18}
              color={s.style === "interval" ? metricInk(colors, "duration") : colors.inkSoft}
            />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                {locale === "he" ? s.he : s.en}
              </Text>
              <Text style={[type.small, { color: colors.inkFaint }]}>
                {s.style === "interval" ? t.workout.cardioInterval : t.workout.cardioSteady} ·{" "}
                <Text style={{ color: metricInk(colors, "duration") }}>
                  {fill(t.workout.cardioMin, { min: s.minutes })}
                </Text>
              </Text>
            </View>
            <PillButton
              tone="soft"
              icon="play"
              label={loading === s.exerciseId ? t.workout.watchLoading : t.workout.watch}
              onPress={() => openDemo(s.exerciseId)}
              disabled={loading === s.exerciseId}
              accessibilityLabel={t.workout.watch}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

/** The muscles a person can flag as weak — the everyday ones, not "full body". */
const FOCUS_MUSCLES: Muscle[] = ["chest", "back", "shoulders", "legs", "glutes", "arms", "core"];

function RestTimer() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const running = left > 0;

  // One ticking interval lives only while the clock is counting; it tears down
  // the moment it hits zero or the screen leaves.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(left / 60)).padStart(1, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = total > 0 ? Math.round((left / total) * 100) : 0;

  return (
    <Card label={t.workout.rest}>
      {running ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {/* the clock is the one number read from across the room */}
            <Text style={[type.figure, { color: metricInk(colors, "rest") }]}>
              {mm}:{ss}
            </Text>
            <Pressable
              onPress={() => setLeft(0)}
              accessibilityRole="button"
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.pill,
                paddingVertical: 8,
                paddingHorizontal: 14,
              }}
            >
              <Ionicons name="play-skip-forward" size={16} color={colors.ink} />
              <Text style={[type.smallStrong, { color: colors.ink }]}>{t.workout.restSkip}</Text>
            </Pressable>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
            <View
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 4,
                backgroundColor: metricFill(colors, "rest"),
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {REST_PRESETS.map((sec) => (
            <Pressable
              key={sec}
              onPress={() => {
                setTotal(sec);
                setLeft(sec);
              }}
              accessibilityRole="button"
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Text style={[type.title, { color: colors.ink }]}>{sec}</Text>
              <Text style={[type.small, { color: colors.inkFaint }]}>{t.workout.restSec}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

type RowProps = {
  ex: Exercise;
  sets: number;
  reps: string;
  muscleLabel: Record<Muscle, string>;
  /** When set, a × removes this exercise from the day (Hevy-style editing). */
  onRemove?: () => void;
};

/**
 * One exercise, logged set by set — the way a lifting app has to work. Each row
 * carries its own weight and reps and its own tick, with what you did last time
 * beside it so you know the number to beat. The exercise counts as done for the
 * day as soon as any set is ticked.
 */
function ExerciseRow({ ex, sets, reps, muscleLabel, onRemove }: RowProps) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const { setsFor, updateSet, addSet, removeSet, lastSession, demoFor } = useStore();
  const [open, setOpen] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoNote, setVideoNote] = useState<string | null>(null);

  // Looking up the exact video takes one round trip the first time, so the
  // button says so rather than appearing to do nothing. It always ends in an
  // open — the resolver falls back to the search page when it cannot find the
  // clip — so there is no failure branch to show.
  const openDemo = async () => {
    setLoadingVideo(true);
    setVideoNote(null);
    try {
      // demoFor always resolves — it degrades to the search page — but opening
      // it can still fail: no handler for the URL, or a blocked popup on web.
      await Linking.openURL(await demoFor(ex));
    } catch {
      setVideoNote(t.workout.videoFailed);
    } finally {
      setLoadingVideo(false);
    }
  };

  const name = locale === "he" ? ex.he : ex.en;
  const how = locale === "he" ? ex.howHe : ex.howEn;
  const w = worked(ex);
  const rows = setsFor(ex.id, sets);
  const prev = lastSession(ex.id);
  const doneCount = rows.filter((r) => r.done).length;
  const prog = progress(rows, prev);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.rule,
        paddingVertical: space.sm,
        gap: space.xs,
      }}
    >
      {/* title line */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {/* the picture is the most tappable thing in the row, so it opens the
            demo rather than doing nothing */}
        <Pressable
          onPress={openDemo}
          disabled={loadingVideo}
          accessibilityRole="button"
          accessibilityLabel={t.workout.watch}
        >
          <ExerciseThumb ex={ex} size={52} />
        </Pressable>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${name} — ${t.workout.howToggle}`}
          accessibilityState={{ expanded: open }}
          style={{ flex: 1 }}
        >
          <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={2}>
            {name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
              {muscleLabel[ex.muscle]} · {t.workout.target} {reps} · {doneCount}/{rows.length}
            </Text>
            {/* the only sign the row opens at all */}
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={13}
              color={colors.inkFaint}
            />
          </View>
        </Pressable>

        {/* the demo is a badge, not a bar: the exercise name needs the width
            more than the word "watch" does */}
        <Pressable
          onPress={openDemo}
          disabled={loadingVideo}
          accessibilityRole="button"
          accessibilityLabel={t.workout.watch}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentWash,
            opacity: loadingVideo ? 0.45 : pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name={loadingVideo ? "hourglass" : "play"} size={18} color={colors.accent} />
        </Pressable>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={t.workout.removeExercise}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle" size={22} color={colors.inkFaint} />
          </Pressable>
        ) : null}
      </View>

      {videoNote ? (
        <Text style={[type.small, { color: colors.orangeInk }]}>{videoNote}</Text>
      ) : null}

      {open ? (
        <View style={{ gap: 4, marginTop: space.sm }}>
          {/* the same diagram as the row's tile, at a size where the lit
              muscles are actually readable, and named in words beside it for
              anyone who would rather read than look */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <MuscleMap
              primary={w.primary}
              secondary={w.secondary}
              view={view(ex.muscle)}
              size={78}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
                {t.workout.worksTitle}
              </Text>
              <Text style={[type.bodyStrong, { color: colors.ink }]}>
                {muscleLabel[w.primary]}
              </Text>
              {w.secondary.length > 0 ? (
                <Text style={[type.small, { color: colors.inkSoft }]}>
                  {t.workout.worksAlso} {w.secondary.map((m) => muscleLabel[m]).join(", ")}
                </Text>
              ) : null}
              <Text style={[type.small, { color: colors.inkFaint }]}>
                {view(ex.muscle) === "front" ? t.workout.viewFront : t.workout.viewBack}
              </Text>
            </View>
          </View>

          <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase", marginTop: space.sm }]}>
            {t.workout.howTitle}
          </Text>
          {how.map((step, i) => (
            <Text key={i} style={[type.small, { color: colors.inkSoft }]}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}

      {/* set table */}
      <View style={{ gap: 4, marginTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[type.label, { color: colors.inkFaint, width: 26, textAlign: "center" }]}>
            {t.workout.setCol}
          </Text>
          <Text style={[type.label, { color: colors.inkFaint, width: 62, textAlign: "center" }]}>
            {t.workout.prevCol}
          </Text>
          {/* the two columns that get read between breaths: load is blue,
              reps are lime, everywhere in the app and forever */}
          <Text style={[type.label, { color: metricInk(colors, "load"), flex: 1, textAlign: "center" }]}>
            {t.workout.kgCol}
          </Text>
          <Text style={[type.label, { color: metricInk(colors, "reps"), flex: 1, textAlign: "center" }]}>
            {t.workout.repsCol}
          </Text>
          <View style={{ width: 30 }} />
        </View>

        {rows.map((row, i) => {
          const p = prev?.[i];
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={[type.smallStrong, { color: colors.inkSoft, width: 26, textAlign: "center" }]}
              >
                {i + 1}
              </Text>
              <Text style={[type.small, { color: colors.inkFaint, width: 62, textAlign: "center" }]}>
                {p && p.kg > 0 ? `${p.kg}×${p.reps}` : "—"}
              </Text>

              <SetField
                value={row.kg}
                decimals
                onCommit={(n) => updateSet(ex.id, i, { kg: clampKg(n) }, sets)}
                placeholder={p && p.kg > 0 ? String(p.kg) : "0"}
                accessibilityLabel={`${name} ${t.workout.kgCol} ${i + 1}`}
                ink={metricInk(colors, "load")}
              />
              <SetField
                value={row.reps}
                decimals={false}
                onCommit={(n) => updateSet(ex.id, i, { reps: clampReps(n) }, sets)}
                placeholder={p && p.reps > 0 ? String(p.reps) : "0"}
                accessibilityLabel={`${name} ${t.workout.repsCol} ${i + 1}`}
                ink={metricInk(colors, "reps")}
              />

              <Pressable
                onPress={() => updateSet(ex.id, i, { done: !row.done }, sets)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.done }}
                accessibilityLabel={`${name} ${t.workout.setCol} ${i + 1}`}
                hitSlop={6}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: row.done ? metricFill(colors, "sets") : colors.ruleStrong,
                  backgroundColor: row.done ? metricFill(colors, "sets") : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {row.done ? (
                  <Text style={{ color: onMetric(colors, "sets"), fontWeight: "900" }}>✓</Text>
                ) : null}
              </Pressable>
            </View>
          );
        })}

        <View style={{ flexDirection: "row", gap: space.sm, marginTop: 4 }}>
          <PillButton
            tone="soft"
            icon="add"
            label={t.workout.addSet}
            onPress={() => addSet(ex.id, sets)}
            disabled={rows.length >= MAX_SETS}
            style={{ flex: 1 }}
          />
          {rows.length > 1 ? (
            <Pressable
              onPress={() => removeSet(ex.id)}
              accessibilityRole="button"
              style={{
                paddingVertical: 9,
                paddingHorizontal: space.lg,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Text style={[type.smallStrong, { color: colors.inkSoft }]}>
                {t.workout.removeSet}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {rows.length >= MAX_SETS ? (
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.workout.setCap}</Text>
        ) : null}
      </View>

      {/* today against last time — the whole point of writing sets down */}
      {prog.volume > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          <Text style={[type.smallStrong, { color: metricInk(colors, "volume") }]}>
            {fill(t.workout.volume, { kg: prog.volume.toLocaleString() })}
          </Text>
          {prog.deltaPct !== null ? (
            <Text
              style={[
                type.smallStrong,
                { color: prog.deltaPct >= 0 ? metricInk(colors, "volume") : colors.inkFaint },
              ]}
            >
              {fill(t.workout.vsLast, {
                delta: `${prog.deltaPct > 0 ? "+" : ""}${prog.deltaPct}`,
              })}
            </Text>
          ) : null}
          {prog.personalBest ? (
            <Text style={[type.smallStrong, { color: metricInk(colors, "personalBest") }]}>
              {t.workout.pr}
            </Text>
          ) : null}
          {prog.oneRepMax > 0 ? (
            <Text style={[type.small, { color: metricInk(colors, "oneRm") }]}>
              {fill(t.workout.oneRm, { kg: prog.oneRepMax.toLocaleString() })}
            </Text>
          ) : null}
        </View>
      ) : null}

    </View>
  );
}

/**
 * Add any move to one specific plan day, for good — the Hevy way of shaping a
 * plan into yours. Collapsed to a single button until tapped, so a day that is
 * already right stays tidy; open it and any of the library's moves is a search
 * and a tap away, added permanently to this day (a re-roll keeps it).
 */
function DayAdder({
  muscleLabel,
  have,
  onPick,
}: {
  muscleLabel: Record<Muscle, string>;
  have: string[];
  onPick: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return EXERCISES.filter((e) => {
      const hay = `${e.he} ${e.en} ${muscleLabel[e.muscle]}`.toLowerCase();
      return hay.includes(term);
    }).slice(0, 8);
  }, [q, muscleLabel]);

  if (!open) {
    return (
      <PillButton
        tone="soft"
        icon="add"
        label={t.workout.dayAdd}
        onPress={() => setOpen(true)}
        style={{ marginTop: space.md, alignSelf: "flex-start" }}
      />
    );
  }

  return (
    <View style={{ marginTop: space.md, gap: space.sm }}>
      <TextField value={q} onChangeText={setQ} placeholder={t.workout.librarySearch} />
      {q.trim().length > 0 ? (
        hits.length === 0 ? (
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.workout.libraryNone}</Text>
        ) : (
          hits.map((e) => {
            const already = have.includes(e.id);
            return (
              <Pressable
                key={e.id}
                disabled={already}
                accessibilityRole="button"
                accessibilityLabel={locale === "he" ? e.he : e.en}
                onPress={() => {
                  onPick(e.id);
                  setQ("");
                  setOpen(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  paddingVertical: 9,
                  paddingHorizontal: 10,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceAlt,
                  opacity: already ? 0.5 : 1,
                }}
              >
                <ExerciseThumb ex={e} size={38} />
                <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                  {locale === "he" ? e.he : e.en}
                </Text>
                <Text style={[type.small, { color: colors.inkFaint }]}>{muscleLabel[e.muscle]}</Text>
                <Text style={[type.smallStrong, { color: colors.accent }]}>{already ? "✓" : "+"}</Text>
              </Pressable>
            );
          })
        )
      ) : null}
      <Pressable onPress={() => { setOpen(false); setQ(""); }} accessibilityRole="button" hitSlop={6}>
        <Text style={[type.smallStrong, { color: colors.inkFaint }]}>{t.common.cancel}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Pull any move out of the exercise library into today's session — the
 * everyday case the plan cannot predict ("the squat rack is taken, I'll do leg
 * press"). Searching by name or muscle keeps it to a couple of taps.
 */
function LibraryPicker({
  muscleLabel,
  chosen,
  onPick,
}: {
  muscleLabel: Record<Muscle, string>;
  chosen: string[];
  onPick: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState("");

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return EXERCISES.filter((e) => {
      const hay = `${e.he} ${e.en} ${muscleLabel[e.muscle]}`.toLowerCase();
      return hay.includes(term);
    }).slice(0, 8);
  }, [q, muscleLabel]);

  return (
    <Card label={t.workout.libraryTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.workout.libraryHint}</Text>
      <Button
        icon="list"
        label={t.workout.libraryBrowse}
        tone="quiet"
        onPress={() => router.push("/library")}
        style={{ marginTop: space.sm }}
      />
      <View style={{ marginTop: space.sm }}>
        <TextField value={q} onChangeText={setQ} placeholder={t.workout.librarySearch} />
      </View>
      {chosen.length > 0 ? (
        <Text style={[type.smallStrong, { color: colors.accent, marginTop: space.sm }]}>
          {t.workout.addedToDay}
        </Text>
      ) : null}
      {q.trim().length > 0 ? (
        hits.length === 0 ? (
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
            {t.workout.libraryNone}
          </Text>
        ) : (
          <View style={{ gap: 6, marginTop: space.sm }}>
            {hits.map((e) => {
              const already = chosen.includes(e.id);
              return (
                <Pressable
                  key={e.id}
                  disabled={already}
                  accessibilityRole="button"
                  accessibilityLabel={locale === "he" ? e.he : e.en}
                  onPress={() => onPick(e.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceAlt,
                    opacity: already ? 0.5 : 1,
                  }}
                >
                  <ExerciseThumb ex={e} size={38} />
                  <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                    {locale === "he" ? e.he : e.en}
                  </Text>
                  <Text style={[type.small, { color: colors.inkFaint }]}>
                    {muscleLabel[e.muscle]}
                  </Text>
                  <Text style={[type.smallStrong, { color: colors.accent }]}>
                    {already ? "✓" : "+"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}
    </Card>
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
  const { allowance } = useStore();
  const [name, setName] = useState("");
  const [yt, setYt] = useState("");
  const [muscle, setMuscle] = useState<Muscle>("core");
  const [added, setAdded] = useState<string | null>(null);

  // The same ceiling the library's "add your own" is under — two doors, one
  // limit — and it stops only the next move, not the ones already saved.
  const canAdd = allowance("customExercises").ok;

  function add() {
    const clean = name.trim();
    if (!clean) return;
    if (!canAdd) return;
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
    // W-7: the form used to blank itself and put the new move in a card
    // rendered *above* this one, so from where the person was looking nothing
    // happened at all.
    setAdded(clean);
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
            <SelectTile
              key={m}
              selected={on}
              onPress={() => setMuscle(m)}
              style={{
                borderRadius: radius.pill,
                paddingVertical: 6,
                paddingHorizontal: 12,
              }}
            >
              <Text style={[type.small, { color: on ? colors.onAccent : colors.inkSoft, fontWeight: "700" }]}>
                {muscleLabel[m]}
              </Text>
            </SelectTile>
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
      <View style={{ marginTop: space.md }}>
        {canAdd ? (
          <Button icon="add" label={t.workout.addSave} onPress={add} disabled={!name.trim()} />
        ) : (
          <ProGate feature="customExercises" />
        )}
      </View>
      {added ? (
        <Text style={[type.smallStrong, { color: colors.accent, marginTop: space.sm }]}>
          {added} · {t.common.savedOk}
        </Text>
      ) : null}
    </Card>
  );
}
