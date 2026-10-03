import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, Vibration, View, type ImageSourcePropType } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { SelectTile } from "@/components/SelectTile";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { MuscleMap } from "@/components/MuscleMap";
import { BUNDLED_EXERCISE_END, BUNDLED_EXERCISE_IMAGES } from "@/workout/exerciseImageAssets";
import { view, worked } from "@/workout/muscles";
import { HeroCard } from "@/components/HeroCard";
import { ProGate } from "@/components/ProGate";
import { Card } from "@/components/Card";
import { FocusCard } from "@/components/FocusCard";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { isolateRanges } from "@/i18n/bidi";
import { fill, formatShortDate, useI18n } from "@/i18n";
import type { Goal } from "@/kitchen";
import { useStore } from "@/store";
import { metricFill, metricInk, onMetric, ON_HERO, ON_HERO_SOFT, useTheme } from "@/theme";
import {
  EXERCISES,
  MUSCLES,
  type Equipment,
  type Exercise,
  type Muscle,
} from "@/workout/exercises";
import { applyDayEdits, buildPlan, HOLDS, nextDayIndex, repsFor, type DayType } from "@/workout/plan";
import { LEVELS, type Level } from "@/workout/difficulty";
import { clampKg, clampReps, progress, typedNumber, typedValue, MAX_SETS, type SetEntry } from "@/workout/sets";
import { historyOf, nextTarget, weekReview, type Target } from "@/workout/coach";
import {
  elapsedSec,
  formatElapsed,
  liveStats,
  MAX_WORKOUT_SEC,
  type WorkoutRecord,
} from "@/workout/session";
import { cardioPlan } from "@/workout/cardio";
import { bestLift, lastLift, MAX_KG, MIN_KG } from "@/workout/lifts";
import { ExercisePicker } from "@/components/ExercisePicker";

const GOALS: Goal[] = ["cut", "recomp", "maintain", "bulk"];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];
const EQUIP = ["gym", "home", "bodyweight"] as const;

export default function WorkoutScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const { state, goal: goalOf, configureTraining, regeneratePlan, planSeed, isExerciseDone, addCustomExercise, completeSession,
    addExerciseToday, todayExtras, addToDay, removeFromDay, setTrainingMode, todayKey,
    activeWorkout, startWorkout, finishWorkout, discardWorkout, workoutHistory } = useStore();

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
  // How experienced the person is — decides whether the plan hands them
  // machines and the basics, or deadlifts and pull-ups.
  const [level, setLevel] = useState<Level>(training?.level ?? "intermediate");
  // The day whose set tables are open; null = the next one to train.
  const [openDay, setOpenDay] = useState<number | null>(null);
  // The summary of the workout just finished, shown until closed.
  const [finished, setFinished] = useState<WorkoutRecord | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
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
  const levelLabel: Record<Level, string> = {
    beginner: t.workout.levelBeginner,
    intermediate: t.workout.levelIntermediate,
    advanced: t.workout.levelAdvanced,
  };
  const levelHint: Record<Level, string> = {
    beginner: t.workout.levelBeginnerHint,
    intermediate: t.workout.levelIntermediateHint,
    advanced: t.workout.levelAdvancedHint,
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
  // Which day's "add exercise" sheet is open, with the moves already on it.
  const [picker, setPicker] = useState<{ day: number; have: string[] } | null>(null);

  const seed = planSeed();
  const plan = useMemo(
    () =>
      training
        ? buildPlan(training.goal, training.days, training.minutes, training.equipment, {
            seed,
            focus: (training.focus as Muscle[]) ?? [],
            // No level on file (an early plan) still gets the coach-shaped
            // week, not the old draw-anything generator.
            level: training.level ?? "intermediate",
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
    configureTraining(goal, days, minutes, equipment, focus, mode, level);
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
      setLevel(training.level ?? "intermediate");
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

        {/* Experience first among the options: it decides whether the plan is
            one a person can actually do, which matters more than any other knob. */}
        <Card label={t.workout.levelTitle}>
          <View style={{ gap: space.sm }}>
            {LEVELS.map((l) => {
              const on = level === l;
              return (
                <SelectTile
                  key={l}
                  selected={on}
                  onPress={() => setLevel(l)}
                  style={{ paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.lg, gap: 2 }}
                >
                  <Text style={[type.bodyStrong, { color: on ? colors.onAccent : colors.ink }]}>{levelLabel[l]}</Text>
                  <Text style={[type.small, { color: on ? colors.onAccent : colors.inkSoft }]}>{levelHint[l]}</Text>
                </SelectTile>
              );
            })}
          </View>
        </Card>

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
  const exName = (e: { he: string; en: string }) => (locale === "he" ? e.he : e.en);
  // Each move's own range, isolated so "8–12" does not read "12–8" in Hebrew.
  const repsLabel = (ex: Exercise) => {
    const r = repsFor(ex, training.goal);
    const range = `\u2066${r.range}\u2069`;
    return r.hold ? fill(t.workout.holdSecs, { range }) : range;
  };
  // Today's plan day follows the one last trained; moves pulled in from the
  // library join that day, not always day 1.
  const todayDay = nextDayIndex(
    sessions.map((s) => s.exercises.map((e) => e.id)),
    training.log,
    todayKey(),
  );
  // A running workout owns the screen: its day is the one open and the one
  // today's library picks join.
  const active = activeWorkout();
  const trainDay = active && active.day < sessions.length ? active.day : todayDay;
  const shownDay = openDay ?? trainDay;
  const idsOf = (i: number) =>
    [...(sessions[i]?.exercises ?? []), ...(i === trainDay ? extraExercises : [])].map((e) => e.id);
  const setsDay = active ? state.training?.setLog?.[active.date] : undefined;
  const live = active ? liveStats(setsDay, idsOf(active.day), plan.sets) : null;

  function start(i: number) {
    setFinished(null);
    setConfirmDiscard(false);
    setOpenDay(i);
    startWorkout(i);
  }

  function finish() {
    if (!active) return;
    const record = finishWorkout(idsOf(active.day), sessions[active.day]?.type ?? "full");
    setConfirmDiscard(false);
    setOpenDay(null);
    if (record) setFinished(record);
  }

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
            {plan.level ? `${levelLabel[plan.level]} · ` : ""}
            {fill(t.workout.setsOnly, { sets: plan.sets })}
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

        <WeekCoach planned={plan.days} />

        {finished ? (
          <FinishedCard
            record={finished}
            bonus={Math.round(finished.kcal * 0.5 / 10) * 10}
            dayLabel={dayLabel[finished.dayType as DayType] ?? ""}
            onClose={() => setFinished(null)}
          />
        ) : null}

        {!active && sessions.length > 1 ? (
          <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{t.workout.pickDay}</Text>
        ) : null}

        {sessions.map((session, i) => {
          const dayExercises = [...session.exercises, ...(i === trainDay ? extraExercises : [])];
          const done = dayExercises.filter((e) => isExerciseDone(e.id)).length;
          const total = dayExercises.length;
          // One day open at a time — the one to train next, unless the person
          // opened another. Three days with every set table showing made a
          // screen six thousand pixels long, and today's session was lost in it.
          if (i !== shownDay) {
            return (
              <Card key={`${session.type}-${i}`} label={fill(t.workout.day, { n: i + 1 })}>
              <Pressable
                onPress={() => setOpenDay(i)}
                accessibilityRole="button"
                accessibilityState={{ expanded: false }}
              >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.title, { color: colors.ink }]}>{dayLabel[session.type]}</Text>
                      <Text style={[type.small, { color: colors.inkSoft }]} numberOfLines={2}>
                        {dayExercises.map((e) => exName(e)).join(" · ") || t.workout.dayEmpty}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={[type.smallStrong, { color: metricInk(colors, "ticks") }]}>
                        {fill(t.workout.doneCount, { done, total })}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color={colors.inkFaint} />
                    </View>
                  </View>
              </Pressable>
                {total > 0 && active?.day !== i ? (
                  <PillButton
                    tone="soft"
                    icon={active ? "swap-horizontal" : "play"}
                    label={active ? t.workout.switchHere : t.workout.startShort}
                    onPress={() => start(i)}
                    style={{ marginTop: space.sm, alignSelf: "flex-start" }}
                  />
                ) : null}
              </Card>
            );
          }
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
              {total > 0 && active?.day !== i ? (
                <Button
                  icon={active ? "swap-horizontal" : "play"}
                  label={active ? t.workout.switchHere : t.workout.start}
                  onPress={() => start(i)}
                  style={{ marginBottom: space.md }}
                />
              ) : null}
              {active?.day === i && live ? (
                <LivePanel
                  startedAt={active.startedAt}
                  sets={live.sets}
                  total={live.total}
                  volume={live.volume}
                  confirmDiscard={confirmDiscard}
                  onFinish={finish}
                  onDiscard={() => setConfirmDiscard(true)}
                  onDiscardCancel={() => setConfirmDiscard(false)}
                  onDiscardConfirm={() => {
                    discardWorkout();
                    setConfirmDiscard(false);
                  }}
                />
              ) : null}
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
                    reps={repsLabel(ex)}
                    muscleLabel={muscleLabel}
                    onRemove={() => removeFromDay(i, ex.id)}
                  />
                ))
              )}

              {/* add any move to this exact day — the whole library, browsable,
                  with a picture beside each, the way a plan is built in Hevy */}
              <PillButton
                tone="soft"
                icon="add"
                label={t.workout.dayAdd}
                onPress={() => setPicker({ day: i, have: dayExercises.map((e) => e.id) })}
                style={{ marginTop: space.md, alignSelf: "flex-start" }}
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
                ) : active?.day === i ? null : (
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

        <HistoryCard records={workoutHistory().slice(0, 6)} dayLabel={dayLabel} />

        <FocusCard />

        <RestTimer />

        <CardioCard goal={training.goal} seed={seed} level={training.level} equipment={training.equipment} />

        {custom.length > 0 ? (
          <Card label={t.workout.myExercises}>
            {custom.map((ex) => (
              <ExerciseRow
                key={ex.id}
                ex={ex}
                sets={plan.sets}
                reps={repsLabel(ex)}
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

        <ExercisePicker
          visible={picker !== null}
          onClose={() => setPicker(null)}
          have={picker?.have ?? []}
          custom={custom}
          muscleLabel={muscleLabel}
          kitLabel={kitLabel}
          onPick={(id) => {
            if (picker) addToDay(picker.day, id);
          }}
        />

        <AddExercise muscleLabel={muscleLabel} onAdd={addCustomExercise} />

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.workout.videoNote}
        </Text>
        {active ? <View style={{ height: 64 }} /> : null}
      </Screen>
      {active ? (
        <LiveBar
          startedAt={active.startedAt}
          dayName={dayLabel[sessions[active.day]?.type ?? "full"] ?? ""}
          onFinish={finish}
        />
      ) : null}
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
 * Ticking a set off starts the rest clock by itself, the way a lifting app
 * should: the row and the clock live in different cards, so they meet here.
 * The clock runs for whatever length was last chosen (90 s until then).
 */
const restListeners = new Set<() => void>();
const startRest = () => restListeners.forEach((fn) => fn());

/**
 * The cardio card — conditioning tailored to the goal and rolled from the same
 * per-device seed as the plan, so it truly differs between a cut and a bulk and
 * between one person and the next. Each row opens its own demo video.
 */
function CardioCard({ goal, seed, level, equipment }: { goal: Goal; seed: string; level?: Level; equipment?: string }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { demoFor } = useStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const plan = useMemo(() => cardioPlan(goal, seed, level, equipment), [goal, seed, level, equipment]);
  if (plan.sessions.length === 0) return null;

  const openDemo = async (exerciseId: string) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    setLoading(exerciseId);
    setFailed(null);
    try {
      await Linking.openURL(await demoFor(ex));
    } catch {
      setFailed(exerciseId);
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
                {locale === "he" ? isolateRanges(s.he) : s.en}
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
      {failed ? <Text style={[type.small, { color: colors.orangeInk }]}>{t.workout.videoFailed}</Text> : null}
    </Card>
  );
}

/** The muscles a person can flag as weak — the everyday ones, not "full body". */
const FOCUS_MUSCLES: Muscle[] = ["chest", "back", "shoulders", "legs", "glutes", "arms", "core"];

function RestTimer() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [total, setTotal] = useState(0);
  // When the rest ends, as a moment in time. Counting down by subtracting a
  // second per tick stopped whenever the screen locked or the browser put the
  // tab to sleep, so a 90-second rest could read 60 after two minutes away.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [preset, setPreset] = useState(90);
  // "Rest's over" stays up for a few seconds, so a glance at the phone
  // between breaths says it rather than showing an idle row of buttons.
  const [over, setOver] = useState(false);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const running = endsAt !== null && left > 0;

  const begin = (sec: number) => {
    setTotal(sec);
    setNow(Date.now());
    setEndsAt(Date.now() + sec * 1000);
    setOver(false);
  };

  useEffect(() => {
    const go = () => begin(preset);
    restListeners.add(go);
    return () => {
      restListeners.delete(go);
    };
  }, [preset]);

  // One ticking interval lives only while the clock is counting.
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);

  // The end is felt, not only seen: the phone is usually face down on a bench.
  useEffect(() => {
    if (endsAt === null || left > 0) return;
    setEndsAt(null);
    setOver(true);
    try {
      Vibration.vibrate([0, 300, 150, 300]);
    } catch {
      // No vibration on this device or browser — the words below still say it.
    }
  }, [endsAt, left]);

  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => setOver(false), 6000);
    return () => clearTimeout(id);
  }, [over]);

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
              onPress={() => {
                setEndsAt(null);
                setOver(false);
              }}
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
        <View style={{ gap: space.sm }}>
        {over ? (
          <Text style={[type.bodyStrong, { color: metricInk(colors, "rest") }]} accessibilityLiveRegion="polite">
            {t.workout.restOver}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {REST_PRESETS.map((sec) => (
            <Pressable
              key={sec}
              onPress={() => {
                setPreset(sec);
                begin(sec);
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
              <Text style={[type.title, { color: preset === sec ? colors.accent : colors.ink }]}>{sec}</Text>
              <Text style={[type.small, { color: colors.inkFaint }]}>{t.workout.restSec}</Text>
            </Pressable>
          ))}
        </View>
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
  const hold = HOLDS.has(ex.id);
  const { t, locale } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const { state, setsFor, updateSet, addSet, removeSet, lastSession, demoFor, todayKey } = useStore();
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
  // What to lift today, from what was lifted before (workout/coach.ts).
  const target: Target | null = hold
    ? null
    : nextTarget(historyOf(state.training?.setLog ?? {}, ex.id, todayKey()), reps.replace(/[\u2066\u2069]/g, ""), ex.compound);
  const coachLine = target ? coachText(target, reps.replace(/[\u2066\u2069]/g, ""), t) : null;

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
          <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={2}>
            {muscleLabel[ex.muscle]} · {t.workout.target} {"\u2066"}{reps}{"\u2069"} · {doneCount}/{rows.length}
          </Text>
          {/* said in words: a bare chevron did not tell anyone the row
              holds photos of the movement and how to do it */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 }}>
            <Text style={[type.smallStrong, { color: colors.accent }]}>
              {open ? t.workout.howHide : t.workout.howShow}
            </Text>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={13} color={colors.accent} />
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
          {/* the movement itself: where it starts and where it ends, side by
              side, large enough to copy — the thumbnail only shows the start */}
          {BUNDLED_EXERCISE_IMAGES[ex.id] ? (
            <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.sm }}>
              {[
                [BUNDLED_EXERCISE_IMAGES[ex.id], t.workout.frameStart],
                ...(BUNDLED_EXERCISE_END[ex.id] ? [[BUNDLED_EXERCISE_END[ex.id], t.workout.frameEnd]] : []),
              ].map(([src, label], i) => (
                <View key={i} style={{ flex: 1, gap: 4 }}>
                  <Image
                    source={src as ImageSourcePropType}
                    resizeMode="cover"
                    fadeDuration={0}
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={`${name} — ${label as string}`}
                    style={{ width: "100%", aspectRatio: 1.35, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
                  />
                  <Text style={[type.label, { color: colors.inkFaint, textAlign: "center" }]}>{label as string}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {/* the same diagram as the row's tile, at a size where the lit
              muscles are actually readable, and named in words beside it for
              anyone who would rather read than look */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <MuscleMap
              primary={w.primary}
              secondary={w.secondary}
              view={view(ex.muscle, ex.id)}
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
                {view(ex.muscle, ex.id) === "front" ? t.workout.viewFront : t.workout.viewBack}
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

      {/* the coach's number for today: what to lift, and why */}
      {coachLine ? (
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: space.sm,
            borderRadius: radius.md,
            backgroundColor: target?.kind === "addWeight" ? colors.limeWash : colors.accentWash,
          }}
        >
          <Text style={[type.small, { color: colors.ink, fontWeight: "600" }]}>{coachLine}</Text>
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
            {hold ? t.workout.secsCol : t.workout.repsCol}
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
                {p && p.kg > 0 ? `${p.kg}×${p.reps}` : p && p.reps > 0 ? String(p.reps) : "—"}
              </Text>

              <SetField
                value={row.kg}
                decimals
                onCommit={(n) => updateSet(ex.id, i, { kg: clampKg(n) }, sets)}
                // Last time's numbers when there are any; otherwise a dash for the
                // load and the target for the reps. A grey "0" read as a value
                // already entered, and as a zero-kilo set.
                placeholder={target && target.kg > 0 ? String(target.kg) : p && p.kg > 0 ? String(p.kg) : "—"}
                accessibilityLabel={`${name} ${t.workout.kgCol} ${i + 1}`}
                ink={metricInk(colors, "load")}
              />
              <SetField
                value={row.reps}
                decimals={false}
                onCommit={(n) => updateSet(ex.id, i, { reps: clampReps(n) }, sets)}
                placeholder={target ? String(target.reps) : p && p.reps > 0 ? String(p.reps) : String(reps).match(/\d+/)?.[0] ?? "—"}
                accessibilityLabel={`${name} ${t.workout.repsCol} ${i + 1}`}
                ink={metricInk(colors, "reps")}
              />

              <Pressable
                onPress={() => {
                  // Ticking a set left empty takes the coach's numbers, the way
                  // Hevy fills a set from its greyed-out values.
                  const fillIn: Partial<SetEntry> = {};
                  if (!row.done && target) {
                    if (row.kg === 0 && target.kg > 0) fillIn.kg = target.kg;
                    if (row.reps === 0) fillIn.reps = target.reps;
                  }
                  updateSet(ex.id, i, { ...fillIn, done: !row.done }, sets);
                  if (!row.done) startRest();
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.done }}
                accessibilityLabel={`${name} ${t.workout.setCol} ${i + 1}`}
                hitSlop={8}
                style={{
                  // Ticked mid-set with a sweaty thumb: 30px was too small a
                  // target for the one control pressed after every set.
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: row.done ? metricFill(colors, "sets") : colors.ruleStrong,
                  backgroundColor: row.done ? metricFill(colors, "sets") : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {row.done ? (
                  <Text style={{ color: onMetric(colors, "sets"), fontWeight: "900", fontSize: 18 }}>✓</Text>
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
              onPress={() => removeSet(ex.id, sets)}
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
                delta: `\u2066${prog.deltaPct > 0 ? "+" : ""}${prog.deltaPct}\u2069`,
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
  const { t, locale } = useI18n();
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
      howHe: [t.library.ownHow],
      howEn: [t.library.ownHow],
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
          placeholder={locale === "he" ? "למשל: squat form" : "e.g. squat form"}
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

/** Re-renders every second while mounted; only the clock pays for it. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function WorkoutClock({ startedAt, style }: { startedAt: number; style?: object }) {
  const now = useNow();
  return (
    <Text style={style} accessibilityRole="timer">
      {"\u2066"}
      {formatElapsed(elapsedSec(startedAt, now))}
      {"\u2069"}
    </Text>
  );
}

/**
 * The running workout, Hevy-style: a clock counting from the start, sets ticked
 * out of the day's total, volume moved, and finish / discard.
 */
function LivePanel({
  startedAt,
  sets,
  total,
  volume,
  confirmDiscard,
  onFinish,
  onDiscard,
  onDiscardCancel,
  onDiscardConfirm,
}: {
  startedAt: number;
  sets: number;
  total: number;
  volume: number;
  confirmDiscard: boolean;
  onFinish: () => void;
  onDiscard: () => void;
  onDiscardCancel: () => void;
  onDiscardConfirm: () => void;
}) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const now = useNow();
  const stale = elapsedSec(startedAt, now) >= MAX_WORKOUT_SEC;
  return (
    <View
      style={{
        gap: space.sm,
        padding: space.md,
        marginBottom: space.md,
        borderRadius: radius.lg,
        backgroundColor: colors.accentWash,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="stopwatch" size={22} color={colors.accent} />
        <Text style={[type.smallStrong, { color: colors.accent }]}>{t.workout.live}</Text>
        <View style={{ flex: 1 }} />
        <WorkoutClock
          startedAt={startedAt}
          style={[type.figure, { color: colors.accent, fontSize: 30, lineHeight: 34, fontVariant: ["tabular-nums"] }]}
        />
      </View>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Text style={[type.smallStrong, { color: colors.ink }]}>
          {fill(t.workout.liveSets, { done: sets, total })}
        </Text>
        <Text style={[type.smallStrong, { color: colors.ink }]}>
          {fill(t.workout.liveVolume, { kg: volume.toLocaleString() })}
        </Text>
      </View>
      {stale ? <Text style={[type.small, { color: colors.orangeInk }]}>{t.workout.stale}</Text> : null}
      {confirmDiscard ? (
        <View style={{ gap: space.sm }}>
          <Text style={[type.small, { color: colors.ink }]}>{t.workout.discardSure}</Text>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <PillButton tone="soft" label={t.workout.discardNo} onPress={onDiscardCancel} style={{ flex: 1 }} />
            <PillButton tone="soft" icon="trash" label={t.workout.discardYes} onPress={onDiscardConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
          <Button icon="flag" label={t.workout.finish} onPress={onFinish} style={{ flex: 1 }} />
          <PillButton tone="soft" label={t.workout.discard} onPress={onDiscard} />
        </View>
      )}
    </View>
  );
}

/** Always in reach while a workout runs: the clock and the finish button. */
function LiveBar({ startedAt, dayName, onFinish }: { startedAt: number; dayName: string; onFinish: () => void }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        left: space.lg,
        right: space.lg,
        bottom: space.md,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        backgroundColor: colors.accent,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Ionicons name="stopwatch" size={20} color="#FFFFFF" />
      <WorkoutClock
        startedAt={startedAt}
        style={[type.title, { color: "#FFFFFF", fontVariant: ["tabular-nums"] }]}
      />
      <Text style={[type.small, { color: "#FFFFFF", flex: 1 }]} numberOfLines={1}>
        {dayName}
      </Text>
      <Pressable
        onPress={onFinish}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingVertical: 8,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          backgroundColor: pressed ? "rgba(255,255,255,0.85)" : "#FFFFFF",
        })}
      >
        <Text style={[type.smallStrong, { color: colors.accent }]}>{t.workout.finish}</Text>
      </Pressable>
    </View>
  );
}

function FinishedCard({
  record,
  bonus,
  dayLabel,
  onClose,
}: {
  record: WorkoutRecord;
  bonus: number;
  dayLabel: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <Text style={[type.title, { color: colors.ink }]}>{t.workout.doneTitle}</Text>
        {dayLabel ? <Text style={[type.small, { color: colors.inkSoft }]}>{dayLabel}</Text> : null}
        <Text style={[type.figure, { color: metricInk(colors, "ticks"), fontSize: 22, lineHeight: 28 }]}>
          {fill(t.workout.doneStats, {
            time: `\u2066${formatElapsed(record.durationSec)}\u2069`,
            sets: record.sets,
            kg: record.volumeKg.toLocaleString(),
          })}
        </Text>
        {record.prs > 0 ? (
          <Text style={[type.smallStrong, { color: colors.limeInk }]}>{fill(t.workout.donePrs, { n: record.prs })}</Text>
        ) : null}
        {record.kcal > 0 ? (
          <Text style={[type.small, { color: colors.ink }]}>
            {fill(t.workout.doneKcal, { kcal: record.kcal, bonus })}
          </Text>
        ) : null}
        <PillButton tone="soft" icon="close" label={t.workout.close} onPress={onClose} style={{ alignSelf: "flex-start" }} />
      </View>
    </Card>
  );
}

function HistoryCard({ records, dayLabel }: { records: WorkoutRecord[]; dayLabel: Record<DayType, string> }) {
  const { t, locale } = useI18n();
  const { colors, space, type } = useTheme();
  if (records.length === 0) return null;
  // Not toLocaleDateString: on a phone's engine without locale data that
  // renders as nothing, and the list becomes numbers with no dates.
  const dateOf = (d: string) => formatShortDate(d, t);
  return (
    <Card label={t.workout.history}>
      <View style={{ gap: space.md }}>
        {records.map((r) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Ionicons name="barbell" size={18} color={colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.smallStrong, { color: colors.ink }]}>
                {dateOf(r.date)} · {dayLabel[r.dayType as DayType] ?? ""}
              </Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>
                {fill(t.workout.historyRow, {
                  time: `\u2066${formatElapsed(r.durationSec)}\u2069`,
                  sets: r.sets,
                  kg: r.volumeKg.toLocaleString(),
                })}
                {r.prs > 0 ? ` · 🏆 ${r.prs}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** The coach's line for an exercise, in words. */
function coachText(target: Target, range: string, t: ReturnType<typeof useI18n>["t"]): string {
  const last = target.last ? `\u2066${target.last.kg > 0 ? `${target.last.kg}×${target.last.reps}` : target.last.reps}\u2069` : "";
  const kg = `\u2066${target.kg}\u2069`;
  switch (target.kind) {
    case "first":
      return fill(t.workout.coachFirst, { range: `\u2066${range}\u2069` });
    case "addWeight":
      return target.kg > 0 ? fill(t.workout.coachAdd, { kg, reps: target.reps, last }) : fill(t.workout.coachAddBw, { reps: target.reps });
    case "moreReps":
      return target.kg > 0 ? fill(t.workout.coachMore, { kg, reps: target.reps, last }) : fill(t.workout.coachMoreBw, { reps: target.reps });
    case "repeat":
      return fill(t.workout.coachRepeat, { kg, reps: target.reps });
    case "deload":
      return fill(t.workout.coachDeload, { kg, reps: target.reps });
  }
}

/** The week so far, said like a coach would: sessions, minutes, records. */
function WeekCoach({ planned }: { planned: number }) {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const { state, todayKey, workoutHistory } = useStore();
  const w = weekReview(state.training?.log ?? {}, workoutHistory(), planned, todayKey());
  const left = Math.max(0, w.planned - w.done);
  const text =
    w.mood === "start"
      ? t.workout.weekStart
      : w.mood === "comeback"
        ? fill(t.workout.weekComeback, { n: w.sinceLast ?? 0 })
        : w.mood === "crushing"
          ? fill(t.workout.weekCrushing, { prs: w.prs, min: w.minutes })
          : w.mood === "done"
            ? fill(t.workout.weekDone, { done: w.done, planned: w.planned })
            : w.mood === "onTrack"
              ? fill(t.workout.weekOnTrack, { done: w.done, planned: w.planned, left })
              : fill(t.workout.weekBehind, { done: w.done, planned: w.planned });
  return (
    <Card label={t.workout.coachTitle}>
      <View style={{ gap: space.sm }}>
        <Text style={[type.body, { color: colors.ink }]}>{text}</Text>
        {w.mood !== "start" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
              {Array.from({ length: Math.max(1, w.planned) }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i < w.done ? metricFill(colors, "sets") : colors.surfaceAlt,
                  }}
                />
              ))}
            </View>
            <Text style={[type.smallStrong, { color: colors.inkSoft }]}>
              {fill(t.workout.weekStats, { done: w.done, planned: w.planned, min: w.minutes, prs: w.prs })}
            </Text>
          </View>
        ) : null}
        {w.streakWeeks >= 2 ? (
          <Text style={[type.smallStrong, { color: colors.orangeInk }]}>{fill(t.workout.weekStreak, { n: w.streakWeeks })}</Text>
        ) : null}
      </View>
    </Card>
  );
}
