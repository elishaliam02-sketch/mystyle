import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { SelectTile } from "@/components/SelectTile";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import type { Goal } from "@/kitchen";
import { useStore } from "@/store";
import { useTheme } from "@/theme";
import {
  EXERCISES,
  MUSCLES,
  type Exercise,
  type Muscle,
} from "@/workout/exercises";
import { buildPlan, type DayType } from "@/workout/plan";
import { clampKg, clampReps, progress } from "@/workout/sets";
import { bestLift, lastLift, MAX_KG, MIN_KG } from "@/workout/lifts";

const GOALS: Goal[] = ["cut", "recomp", "maintain", "bulk"];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];
const EQUIP = ["gym", "home", "bodyweight"] as const;

export default function WorkoutScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, configureTraining, isExerciseDone, addCustomExercise, completeSession,
    addExerciseToday, todayExtras } = useStore();

  const training = state.training;
  const [goal, setGoal] = useState<Goal>(training?.goal ?? "recomp");
  const [days, setDays] = useState<number>(training?.days ?? 3);
  const [minutes, setMinutes] = useState<number>(training?.minutes ?? 45);
  const [equipment, setEquipment] = useState<string>(training?.equipment ?? "gym");
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

  const plan = useMemo(
    () =>
      training
        ? buildPlan(training.goal, training.days, training.minutes, training.equipment)
        : null,
    [training],
  );

  function build() {
    configureTraining(goal, days, minutes, equipment);
    setForceSetup(false);
  }

  function reopenSetup() {
    if (training) {
      setGoal(training.goal);
      setDays(training.days);
      setMinutes(training.minutes ?? 45);
      setEquipment(training.equipment ?? "gym");
    }
    setForceSetup(true);
  }

  // ---- setup form: pick a goal and weekly frequency ----
  if (setup || !training || !plan) {
    return (
      <Screen title={t.workout.heading} subtitle={t.workout.body}>
        <Card tone="accent">
          <Text style={[type.body, { color: colors.ink }]}>{t.workout.intro}</Text>
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

        <Button icon="barbell" label={t.workout.build} onPress={build} />

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.workout.videoNote}
        </Text>
      </Screen>
    );
  }

  // ---- the built plan ----
  const custom = training.custom;

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
        subtitle={t.workout.body}
        aside={
          <PillButton icon="barbell" label={t.workout.buildShort} onPress={reopenSetup} />
        }
      >
        <Card tone="accent">
          <Text style={[type.title, { color: colors.ink }]}>
            {goalLabel[plan.goal]} · {fill(t.workout.planFor, { days: plan.days })}
          </Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]}>
            {fill(t.workout.setsReps, { sets: plan.sets, reps: plan.reps })}
            {plan.minutes ? ` · ${fill(t.workout.session, { min: plan.minutes })}` : ""}
          </Text>
          <Button
            label={t.workout.change}
            tone="quiet"
            onPress={reopenSetup}
            style={{ marginTop: space.md }}
          />
        </Card>

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
                  <Text style={[type.figure, { color: colors.ink }]}>{value}</Text>
                  <Text style={[type.small, { color: colors.inkFaint, textAlign: "center" }]}>{label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <RestTimer />

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
              {[...session.exercises, ...(i === 0 ? extraExercises : [])].map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  sets={plan.sets}
                  reps={plan.reps}
                  muscleLabel={muscleLabel}
                />
              ))}
              <Button
                icon={done === session.exercises.length ? "checkmark-done" : "checkmark"}
                label={done === session.exercises.length ? t.workout.dayDone : t.workout.finishDay}
                tone="quiet"
                disabled={done === session.exercises.length}
                onPress={() => completeSession(session.exercises.map((e) => e.id))}
                style={{ marginTop: space.md }}
              />
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

const REST_PRESETS = [60, 90, 120];

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
            <Text style={[type.figure, { color: colors.accent }]}>
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
            <View style={{ width: `${pct}%`, height: "100%", borderRadius: 4, backgroundColor: colors.accent }} />
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
};

/**
 * One exercise, logged set by set — the way a lifting app has to work. Each row
 * carries its own weight and reps and its own tick, with what you did last time
 * beside it so you know the number to beat. The exercise counts as done for the
 * day as soon as any set is ticked.
 */
function ExerciseRow({ ex, sets, reps, muscleLabel }: RowProps) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const { setsFor, updateSet, addSet, removeSet, lastSession, demoFor } = useStore();
  const [open, setOpen] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);

  // Looking up the exact video takes one round trip the first time, so the
  // button says so rather than appearing to do nothing. It always ends in an
  // open — the resolver falls back to the search page when it cannot find the
  // clip — so there is no failure branch to show.
  const openDemo = async () => {
    setLoadingVideo(true);
    try {
      Linking.openURL(await demoFor(ex));
    } finally {
      setLoadingVideo(false);
    }
  };

  const name = locale === "he" ? ex.he : ex.en;
  const how = locale === "he" ? ex.howHe : ex.howEn;
  const rows = setsFor(ex.id, sets);
  const prev = lastSession(ex.id);
  const doneCount = rows.filter((r) => r.done).length;
  const prog = progress(rows, prev);

  const toKg = (v: string) => clampKg(Number(v.replace(",", ".")));
  const toReps = (v: string) => clampReps(Number(v.replace(",", ".")));

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
        <Pressable onPress={() => setOpen((v) => !v)} style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: colors.ink }]}>{name}</Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>
            {muscleLabel[ex.muscle]} · {t.workout.target} {reps} · {doneCount}/{rows.length}
          </Text>
        </Pressable>

        <PillButton
          tone="soft"
          icon="play"
          label={loadingVideo ? t.workout.watchLoading : t.workout.watch}
          onPress={openDemo}
          disabled={loadingVideo}
          accessibilityLabel={t.workout.watch}
        />
      </View>

      {/* set table */}
      <View style={{ gap: 4, marginTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[type.label, { color: colors.inkFaint, width: 26, textAlign: "center" }]}>
            {t.workout.setCol}
          </Text>
          <Text style={[type.label, { color: colors.inkFaint, width: 62, textAlign: "center" }]}>
            {t.workout.prevCol}
          </Text>
          <Text style={[type.label, { color: colors.inkFaint, flex: 1, textAlign: "center" }]}>
            {t.workout.kgCol}
          </Text>
          <Text style={[type.label, { color: colors.inkFaint, flex: 1, textAlign: "center" }]}>
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

              <TextInput
                value={row.kg ? String(row.kg) : ""}
                onChangeText={(v) => updateSet(ex.id, i, { kg: toKg(v) }, sets)}
                keyboardType="numeric"
                placeholder={p && p.kg > 0 ? String(p.kg) : "0"}
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel={`${name} ${t.workout.kgCol} ${i + 1}`}
                style={{
                  flex: 1,
                  // A web <input> carries an intrinsic width that flex will not
                  // shrink past unless min-width is cleared — without this the
                  // set row runs off the card and takes the tick box with it.
                  minWidth: 0,
                  textAlign: "center",
                  paddingVertical: 7,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceAlt,
                  color: colors.ink,
                  fontFamily: font.bodyMedium,
                  fontSize: 15,
                }}
              />
              <TextInput
                value={row.reps ? String(row.reps) : ""}
                onChangeText={(v) => updateSet(ex.id, i, { reps: toReps(v) }, sets)}
                keyboardType="numeric"
                placeholder={p && p.reps > 0 ? String(p.reps) : "0"}
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel={`${name} ${t.workout.repsCol} ${i + 1}`}
                style={{
                  flex: 1,
                  // A web <input> carries an intrinsic width that flex will not
                  // shrink past unless min-width is cleared — without this the
                  // set row runs off the card and takes the tick box with it.
                  minWidth: 0,
                  textAlign: "center",
                  paddingVertical: 7,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceAlt,
                  color: colors.ink,
                  fontFamily: font.bodyMedium,
                  fontSize: 15,
                }}
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
                  borderColor: row.done ? colors.accent : colors.ruleStrong,
                  backgroundColor: row.done ? colors.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {row.done ? (
                  <Text style={{ color: colors.onAccent, fontWeight: "900" }}>✓</Text>
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
      </View>

      {/* today against last time — the whole point of writing sets down */}
      {prog.volume > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          <Text style={[type.small, { color: colors.inkSoft }]}>
            {fill(t.workout.volume, { kg: prog.volume.toLocaleString() })}
          </Text>
          {prog.deltaPct !== null ? (
            <Text
              style={[
                type.smallStrong,
                { color: prog.deltaPct >= 0 ? colors.accent : colors.inkFaint },
              ]}
            >
              {fill(t.workout.vsLast, {
                delta: `${prog.deltaPct > 0 ? "+" : ""}${prog.deltaPct}`,
              })}
            </Text>
          ) : null}
          {prog.personalBest ? (
            <Text style={[type.smallStrong, { color: colors.amber }]}>{t.workout.pr}</Text>
          ) : null}
          {prog.oneRepMax > 0 ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {fill(t.workout.oneRm, { kg: prog.oneRepMax.toLocaleString() })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {open ? (
        <View style={{ gap: 4, marginTop: space.sm }}>
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
                  onPress={() => {
                    onPick(e.id);
                    setQ("");
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
