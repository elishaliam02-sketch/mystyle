import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { SelectTile } from "@/components/SelectTile";
import { Card } from "@/components/Card";
import { ProGate, ProRemaining } from "@/components/ProGate";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { BODY_PARTS, MAX_CM, measureChange, MIN_CM, type BodyPart } from "@/body";
import {
  bodyFatPercent,
  bodyFatTarget,
  fatFraction,
  fatTier,
  weeklyAverages,
  weeklyChange,
  type Sex,
} from "@/health/composition";
import { useAutoSteps } from "@/health/pedometer";
import { askWeekInsight } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge } from "@/components/AiNote";
import { computeAchievements, unlockedCount } from "@/achievements";
import { ImproveCard } from "@/components/ImproveCard";
import { fill, useI18n } from "@/i18n";
import { weekReading } from "@/insight";
import { checkWeight } from "@/store/weight";
import {
  averageSteps,
  isStorableGoal as isStorableStepGoal,
  MAX_STEP_GOAL,
  MIN_STEP_GOAL,
  recentSteps,
  stepStreak,
  stepsKcal,
  stepsKm,
} from "@/health/steps";
import { daysAgo, today, useStore, type WeighIn } from "@/store";
import { metricFill, metricInk, useTheme } from "@/theme";

function Heatmap() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const { state } = useStore();

  // How many habits were completed on each of the last 30 days — the grid is
  // read newest-last, so the bottom-right is today.
  const counts = new Map<string, number>();
  for (const c of state.completions) {
    if (c.done) counts.set(c.date, (counts.get(c.date) ?? 0) + 1);
  }
  const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));

  const shade = (n: number) =>
    n === 0 ? colors.surfaceAlt : n === 1 ? colors.accentWash : colors.accent;

  return (
    <Card label={t.heatmap.title}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.xs }}>
        {days.map((d) => (
          <View
            key={d}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: shade(counts.get(d) ?? 0),
              borderWidth: 1,
              borderColor: colors.rule,
            }}
          />
        ))}
      </View>
      <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
        {t.heatmap.subtitle}
      </Text>
    </Card>
  );
}

function TrendChart({ values }: { values: WeighIn[] }) {
  const { colors, space, radius } = useTheme();
  const kgs = values.map((v) => v.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const range = max - min || 1;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.sm,
        height: 110,
        marginTop: space.sm,
      }}
      accessibilityRole="image"
      accessibilityLabel={`${values.length} readings from ${max} to ${min} kilograms`}
    >
      {values.map((v, index) => (
        <View
          key={v.date}
          style={{
            flex: 1,
            height: 20 + ((v.kg - min) / range) * 80,
            borderRadius: radius.sm,
            backgroundColor: index === values.length - 1 ? colors.accent : colors.accentWash,
          }}
        />
      ))}
    </View>
  );
}

export default function ProgressScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, addWeighIn, weeklyConsistency, isDone } = useStore();
  const router = useRouter();

  const achievements = useMemo(() => computeAchievements(state), [state]);
  const unlocked = unlockedCount(achievements);

  const [kg, setKg] = useState("");
  // A range error blocks the save; a jump warning asks for one confirming tap.
  const [weighNote, setWeighNote] = useState<string | null>(null);
  const [jumpArmed, setJumpArmed] = useState(false);
  // The field empties on a save, which on its own reads like nothing happened.
  const [saved, setSaved] = useState(false);

  const weighIns = state.weighIns;
  const latest = weighIns[weighIns.length - 1];
  const first = weighIns[0];
  const delta = latest && first ? latest.kg - first.kg : 0;
  const consistency = Math.round(weeklyConsistency() * 100);

  const activeHabits = state.habits.filter((h) => !h.archived);
  const window7 = Array.from({ length: 7 }, (_, i) => daysAgo(i));
  const perHabit = activeHabits.map((h) => {
    const eligible = window7.filter((d) => d >= h.createdAt);
    return {
      title: h.title,
      doneDays: eligible.filter((d) => isDone(h.id, d)).length,
      totalDays: eligible.length,
    };
  });
  const recentNotes = state.checkIns
    .filter((c) => c.note)
    .slice(-5)
    .reverse()
    .map((c) => c.note);
  const dayKey = today();

  // Only worth asking once there is a week to read.
  const weekKey =
    activeHabits.length > 0
      ? `${dayKey}|${perHabit.map((h) => `${h.title}:${h.doneDays}/${h.totalDays}`).join(",")}|${weighIns.length}|${recentNotes.join("|")}`
      : null;

  const { value: week } = useAi(weekKey, (signal) =>
    askWeekInsight(
      { consistency, habits: perHabit, weights: weighIns, recentNotes },
      locale,
      dayKey,
      signal,
    ),
  );

  // The honest baseline, computed here from the same numbers. It shows
  // instantly and needs no server; when Claude's reading arrives it takes
  // over. Either way the card is never an apology with no content behind it.
  const localWeek = weekReading(
    { consistency, habits: perHabit, weights: weighIns },
    t.insight,
  );

  function save() {
    const value = Number(kg.replace(",", "."));
    const check = checkWeight(value, latest?.kg);

    if (check.status === "out-of-range") {
      setWeighNote(fill(t.progress.weighRange, { min: check.min, max: check.max }));
      return;
    }
    // A big jump is allowed, but only once the person has seen the warning and
    // tapped again — a typo like 96 → 69 gets a chance to be caught.
    if (check.status === "big-jump" && !jumpArmed) {
      setWeighNote(fill(t.progress.weighJump, { delta: Math.abs(check.delta) }));
      setJumpArmed(true);
      return;
    }
    addWeighIn(value);
    setKg("");
    setWeighNote(null);
    setJumpArmed(false);
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.progress.heading}>
        <Card label={t.progress.weighTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.progress.weighBody}</Text>

          {latest ? (
            <View style={{ flexDirection: "row", gap: space.xl, marginTop: space.md }}>
              <View>
                <Text style={[type.label, { color: colors.inkFaint }]}>{t.progress.latest}</Text>
                <Text style={[type.figure, { color: colors.ink }]}>{latest.kg}</Text>
              </View>
              {weighIns.length > 1 ? (
                <View>
                  <Text style={[type.label, { color: colors.inkFaint }]}>{t.progress.change}</Text>
                  <Text
                    style={[
                      type.figure,
                      { color: delta <= 0 ? colors.accent : colors.orangeInk },
                    ]}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[type.body, { color: colors.inkFaint, marginTop: space.sm }]}>
              {t.progress.weighEmpty}
            </Text>
          )}

          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <TextField
              value={kg}
              onChangeText={(v) => {
                setKg(v);
                // Any edit clears a standing warning and disarms the confirm,
                // so a corrected number is re-checked from scratch.
                if (weighNote) setWeighNote(null);
                if (jumpArmed) setJumpArmed(false);
                if (saved) setSaved(false);
              }}
              placeholder={t.progress.weighPlaceholder}
              keyboardType="numeric"
              onSubmitEditing={save}
            />
            {weighNote ? (
              <Text style={[type.small, { color: colors.alert }]}>{weighNote}</Text>
            ) : saved ? (
              <Text style={[type.smallStrong, { color: colors.accent }]}>{t.common.savedOk}</Text>
            ) : null}
            {/* Armed for a confirm, the label — not only the icon — has to say
                that this second tap is the one that stores the number. */}
            <Button
              icon={jumpArmed ? "checkmark" : "add"}
              label={jumpArmed ? t.progress.weighSaveAnyway : t.progress.weighSave}
              onPress={save}
              disabled={!kg.trim()}
            />
          </View>
        </Card>

        <Pressable onPress={() => router.push("/achievements")} accessibilityRole="button">
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trophy" size={24} color={colors.onAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.ink }]}>{t.achievements.entry}</Text>
                <Text style={[type.small, { color: colors.inkSoft }]}>
                  {fill(t.achievements.entryHint, { done: unlocked, total: achievements.length })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
            </View>
          </Card>
        </Pressable>

        <ImproveCard />

        {activeHabits.length > 0 ? (
          <Card label={t.progress.weekTitle} tone="accent">
            <View style={{ gap: space.sm }}>
              {week ? <AiBadge /> : null}
              <Text style={[type.title, { color: colors.ink }]}>
                {week ? week.headline : localWeek.headline}
              </Text>
              <Text style={[type.body, { color: colors.ink }]}>
                {week ? week.body : localWeek.body}
              </Text>
            </View>
          </Card>
        ) : null}


        <WeeklyAverageCard />

        <BodyFatCard />

        <StepsCard />

        <PhotosCard />

        <MeasurementsSection />

        <Card label={t.progress.trendTitle}>
          {weighIns.length >= 2 ? (
            <TrendChart values={weighIns} />
          ) : (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.progress.trendNeedMore}
            </Text>
          )}
        </Card>

        <Card label={t.progress.consistencyTitle}>
          {state.habits.filter((h) => !h.archived).length > 0 ? (
            <Text style={[type.figure, { color: metricInk(colors, "ticks") }]}>
              {fill(t.progress.consistencyValue, { percent: consistency })}
            </Text>
          ) : (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.progress.consistencyEmpty}
            </Text>
          )}
        </Card>

        <Heatmap />

        <Card label={t.progress.checkinsTitle}>
          <Text style={[type.title, { color: colors.ink }]}>
            {fill(t.progress.checkinsValue, { count: state.checkIns.length })}
          </Text>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}


/**
 * The day's walking, next to the scale — because for someone trying to lose
 * weight the steps are the half of the equation the gym does not cover, and a
 * day with 11,000 steps and no session is not a failed day.
 *
 * The count is typed in (or nudged with the buttons) from whatever the phone
 * or watch already counts. Reading the motion sensor directly would need a
 * native module and a fresh store build; this works today, over the air.
 */
function StepsCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, setSteps, addSteps, todaySteps, stepGoal, setStepGoal } = useStore();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  // The phone counts for itself where it can, so nobody has to guess a number.
  const auto = useAutoSteps({ onTotal: setSteps, onDelta: addSteps });

  const log = state.steps ?? {};
  const day = todaySteps();
  const goal = stepGoal();
  const pct = Math.min(100, Math.round((day / goal) * 100));
  const week = useMemo(() => recentSteps(log, today(), 7), [log]);
  const avg = averageSteps(log, today(), 7);
  const streak = stepStreak(log, today(), goal);
  const weightKg = [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg;
  const peak = Math.max(goal, ...week.map((d) => d.steps), 1);

  function saveGoal() {
    const n = Number(goalDraft.replace(/[,\s]/g, ""));
    if (!isStorableStepGoal(n)) {
      setNote(fill(t.steps.goalRange, { min: MIN_STEP_GOAL, max: MAX_STEP_GOAL }));
      return;
    }
    setStepGoal(Math.round(n));
    setEditingGoal(false);
    setNote(null);
  }

  return (
    <Card label={t.steps.title}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md }}>
        <Text style={[type.figure, { color: metricInk(colors, "steps") }]}>{day.toLocaleString()}</Text>
        <Text style={[type.small, { color: colors.inkSoft, paddingBottom: 6 }]}>
          {fill(t.steps.ofGoal, { goal: goal.toLocaleString() })}
        </Text>
      </View>

      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.surfaceAlt,
          overflow: "hidden",
          marginTop: 6,
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: day >= goal ? metricFill(colors, "steps") : colors.ruleStrong,
          }}
        />
      </View>

      <Text style={[type.small, { color: colors.inkSoft, marginTop: 6 }]}>
        {fill(t.steps.summary, {
          km: stepsKm(day),
          kcal: stepsKcal(day, weightKg),
        })}
        {streak > 0 ? ` · ${fill(t.steps.streak, { days: streak })}` : ""}
      </Text>

      {/* the last seven days, zeros included */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 5,
          height: 54,
          marginTop: space.md,
        }}
      >
        {week.map((d) => (
          <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 3 }}>
            <View
              style={{
                width: "100%",
                height: Math.max(3, Math.round((d.steps / peak) * 40)),
                borderRadius: 3,
                backgroundColor: d.steps >= goal ? metricFill(colors, "steps") : colors.rule,
              }}
            />
          </View>
        ))}
      </View>
      <Text style={[type.small, { color: colors.inkFaint }]}>
        {fill(t.steps.weekAverage, { avg: avg.toLocaleString() })}
      </Text>

      {/* the phone counts by itself when it can — no guessing a number */}
      {auto.running ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: space.md,
            paddingVertical: 8,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: colors.accentWash,
            alignSelf: "flex-start",
          }}
        >
          <Ionicons name="walk" size={16} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent }]}>{t.steps.autoOn}</Text>
        </View>
      ) : (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.md }]}>
          {auto.available ? t.steps.autoAsking : t.steps.autoOff}
        </Text>
      )}


      {editingGoal ? (
        <View style={{ gap: 6, marginTop: space.sm }}>
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <TextField
                value={goalDraft}
                onChangeText={(v) => {
                  setGoalDraft(v);
                  if (note) setNote(null);
                }}
                placeholder={t.steps.goalPlaceholder}
                keyboardType="numeric"
                onSubmitEditing={saveGoal}
              />
            </View>
            <Button label={t.steps.save} onPress={saveGoal} tone="quiet" />
          </View>
          {/* The rejected goal is explained under the field it came from, not
              under the paragraph below it, where a short screen hides it. */}
          {note ? <Text style={[type.small, { color: colors.alert }]}>{note}</Text> : null}
        </View>
      ) : (
        <PillButton
          tone="soft"
          icon="create"
          label={t.steps.changeGoal}
          onPress={() => {
            setGoalDraft(String(goal));
            setEditingGoal(true);
          }}
          style={{ alignSelf: "flex-start", marginTop: space.sm }}
        />
      )}

      <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
        {t.steps.note}
      </Text>
    </Card>
  );
}

/**
 * The weekly weight average — the honest "am I moving?" number. Daily weight
 * jumps with water and food; the week's average cuts through that noise, and
 * the change against last week reads against the goal (down is good on a cut,
 * up on a bulk).
 */
function WeeklyAverageCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, goal } = useStore();

  const weeks = useMemo(() => weeklyAverages(state.weighIns), [state.weighIns]);
  const change = useMemo(() => weeklyChange(state.weighIns), [state.weighIns]);
  const latest = weeks.at(-1);

  if (!latest) {
    return (
      <Card label={t.progress.weeklyAvgTitle}>
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.progress.weeklyAvgNeed}</Text>
      </Card>
    );
  }

  // A drop is "good" on cut/recomp; a gain is "good" on a bulk. Colour the
  // change by whether it serves the goal, not merely by its sign.
  const g = goal();
  const wantsDown = g === "cut" || g === "recomp";
  const good =
    change === null || change === 0
      ? true
      : wantsDown
        ? change < 0
        : g === "bulk"
          ? change > 0
          : Math.abs(change) < 0.4;
  const changeColor = change === null || change === 0 ? colors.inkSoft : good ? colors.accent : colors.orangeInk;
  const dirWord =
    change === null || change === 0 ? t.progress.weeklyFlat : change < 0 ? t.progress.weeklyDown : t.progress.weeklyUp;

  const peak = Math.max(...weeks.map((w) => w.avgKg));
  const low = Math.min(...weeks.map((w) => w.avgKg));
  const span = peak - low || 1;

  return (
    <Card label={t.progress.weeklyAvgTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.progress.weeklyAvgBody}</Text>
      <View style={{ flexDirection: "row", gap: space.xl, marginTop: space.md, alignItems: "flex-end" }}>
        <View>
          <Text style={[type.label, { color: colors.inkFaint }]}>{t.progress.weeklyAvgLatest}</Text>
          <Text style={[type.figure, { color: metricInk(colors, "bodyWeight") }]}>{latest.avgKg}</Text>
        </View>
        {change !== null ? (
          <View>
            <Text style={[type.label, { color: colors.inkFaint }]}>{t.progress.weeklyAvgChange}</Text>
            <Text style={[type.figure, { color: changeColor }]}>
              {change > 0 ? "+" : ""}
              {change}
            </Text>
          </View>
        ) : null}
        <Text style={[type.small, { color: changeColor, fontWeight: "700", paddingBottom: 6 }]}>{dirWord}</Text>
      </View>

      {weeks.length >= 2 ? (
        <View
          style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, height: 80, marginTop: space.md }}
          accessibilityRole="image"
        >
          {weeks.slice(-8).map((w, i, arr) => (
            <View
              key={w.week}
              style={{
                flex: 1,
                height: 14 + ((w.avgKg - low) / span) * 60,
                borderRadius: radius.sm,
                backgroundColor: i === arr.length - 1 ? colors.accent : colors.accentWash,
              }}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Estimated body fat, from the tape measure and the goal. Needs the person's
 * sex (the formula asks for it) and a waist reading; without either it says so
 * and offers the fix. The estimate moves as the waist changes, so it is this
 * person's number and it changes from photo to photo — and the target band it
 * is judged against changes the moment the goal does.
 */
function BodyFatCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, goal, setSex } = useStore();
  const router = useRouter();

  const sex = state.profile.sex as Sex | undefined;
  const heightCm = state.profile.heightCm;
  // The estimate goes null for three separate reasons, and the fix differs:
  // the waist is typed here, the height only exists in Profile. Same band the
  // RFM formula accepts, so the card never sends you somewhere that won't help.
  const heightOk = !!heightCm && heightCm >= 120 && heightCm <= 250;
  const waist = useMemo(() => {
    const series = state.measurements?.waist ?? [];
    return [...series].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.cm;
  }, [state.measurements]);

  const bf = bodyFatPercent({ heightCm, waistCm: waist, sex });

  return (
    <Card label={t.progress.fatTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.progress.fatBody}</Text>

      {/* sex — the estimate needs it */}
      {!sex ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.progress.fatNeedSex}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
        {(["male", "female"] as const).map((s) => (
          <SelectTile
            key={s}
            selected={sex === s}
            onPress={() => setSex(s)}
            style={{ flex: 1, alignItems: "center", paddingVertical: space.sm, borderRadius: radius.md }}
          >
            <Text style={[type.smallStrong, { color: sex === s ? colors.onAccent : colors.inkSoft }]}>
              {s === "male" ? t.progress.sexMale : t.progress.sexFemale}
            </Text>
          </SelectTile>
        ))}
      </View>

      {sex && bf === null ? (
        heightOk ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Text style={[type.small, { color: colors.orangeInk }]}>{t.progress.fatNeedWaist}</Text>
            {/* The waist is the only number still missing, so it is typed on
                this card instead of three cards further down the page. */}
            <PartCard part="waist" />
          </View>
        ) : (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Text style={[type.small, { color: colors.orangeInk }]}>{t.progress.fatNeedHeight}</Text>
            <PillButton
              tone="soft"
              icon="person"
              label={t.progress.fatNeedHeightGo}
              onPress={() => router.push("/profile")}
              style={{ alignSelf: "flex-start" }}
            />
          </View>
        )
      ) : null}

      {bf !== null && sex ? (
        (() => {
          const band = bodyFatTarget(goal(), sex);
          const tier = fatTier(bf, band);
          const bfColor = tier === "in" ? colors.accent : colors.orangeInk;
          const line =
            tier === "in" ? t.progress.fatIn : tier === "below" ? t.progress.fatBelow : t.progress.fatAbove;
          return (
            <View style={{ marginTop: space.md, gap: 6 }}>
              <Text style={[type.figure, { color: colors.ink, fontSize: 40 }]}>
                {bf}
                <Text style={[type.small, { color: colors.inkFaint }]}>%</Text>
              </Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>
                {fill(t.progress.fatTargetFor, {
                  goal: goalWord(t, goal()),
                  min: band.min,
                  max: band.max,
                })}
              </Text>
              {/* a scale with the goal band marked and the reading dotted on it */}
              <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginTop: 4, overflow: "hidden" }}>
                <View
                  style={{
                    position: "absolute",
                    left: `${fatFraction(band.min) * 100}%`,
                    width: `${Math.max(4, (fatFraction(band.max) - fatFraction(band.min)) * 100)}%`,
                    top: 0,
                    bottom: 0,
                    backgroundColor: colors.accentWash,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: `${fatFraction(bf) * 100}%`,
                    width: 4,
                    top: -2,
                    bottom: -2,
                    backgroundColor: bfColor,
                  }}
                />
              </View>
              <Text style={[type.smallStrong, { color: bfColor, marginTop: 4 }]}>{line}</Text>
            </View>
          );
        })()
      ) : null}
    </Card>
  );
}

/**
 * Progress photos — the record the scale and the tape can't keep. A photo every
 * few weeks, each with the day's weight and body-fat frozen beside it, and a
 * start-vs-now compare once there are two. The files never leave the phone.
 */
function PhotosCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, addPhoto, removePhoto, allowance } = useStore();
  const [note, setNote] = useState<string | null>(null);

  const photos = state.photos ?? [];
  const sortedWeighIns = useMemo(
    () => [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)),
    [state.weighIns],
  );
  const latestKg = sortedWeighIns.at(-1)?.kg;
  const waist = state.measurements?.waist?.at(-1)?.cm;
  const bf = bodyFatPercent({
    heightCm: state.profile.heightCm,
    waistCm: waist,
    sex: state.profile.sex as Sex | undefined,
  });
  const canPick = Platform.OS !== "web";
  // Only *taking* another one is capped. The roll below, and its per-photo
  // delete, stay exactly as they are — deleting is how room is made.
  const canAdd = allowance("progressPhotos").ok;

  const pick = async (fromCamera: boolean) => {
    setNote(null);
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        // Once the OS remembers a refusal it stops even asking, so silence here
        // leaves the button looking dead. A cancelled sheet stays silent below.
        if (!perm.granted) {
          setNote(t.progress.cameraDenied);
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        if (!res.canceled && res.assets[0]) addPhoto(res.assets[0].uri, latestKg, bf ?? undefined);
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.6,
        });
        if (!res.canceled && res.assets[0]) addPhoto(res.assets[0].uri, latestKg, bf ?? undefined);
      }
    } catch {
      // A cancelled sheet is not an error worth shouting about.
    }
  };

  const first = photos[0];
  const last = photos.at(-1);

  return (
    <Card label={t.progress.photosTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.progress.photosBody}</Text>

      {!canPick ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.progress.photosUnavailable}
        </Text>
      ) : canAdd ? (
        <View style={{ gap: space.xs, marginTop: space.md }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <PillButton icon="images" label={t.progress.photosAdd} onPress={() => pick(false)} style={{ flex: 1 }} />
            <PillButton tone="soft" icon="camera" label={t.progress.photosCamera} onPress={() => pick(true)} style={{ flex: 1 }} />
          </View>
          <ProRemaining feature="progressPhotos" />
        </View>
      ) : (
        <View style={{ marginTop: space.md }}>
          <ProGate feature="progressPhotos" />
        </View>
      )}

      {note ? (
        <Text style={[type.small, { color: colors.orangeInk, marginTop: space.sm }]}>{note}</Text>
      ) : null}
      {/* The one place the app can lose something without saying so: photos
          are files on this phone and are never uploaded, so a new phone starts
          with none. Saying it next to the pictures, rather than only in the
          privacy policy, is the difference between a choice and a surprise. */}
      {photos.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.sm,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: space.md,
            marginTop: space.md,
          }}
        >
          <Ionicons name="phone-portrait-outline" size={15} color={colors.inkFaint} />
          <Text style={[type.small, { color: colors.inkSoft, flex: 1 }]}>
            {t.progress.photosLocalOnly}
          </Text>
        </View>
      ) : null}

      {photos.length === 0 ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.md }]}>
          {t.progress.photosEmpty}
        </Text>
      ) : (
        <>
          {/* start vs now */}
          {first && last && first.id !== last.id ? (
            <View style={{ marginTop: space.md }}>
              <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase", marginBottom: 6 }]}>
                {t.progress.photosCompare}
              </Text>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                {[first, last].map((p, i) => (
                  <View key={p.id} style={{ flex: 1 }}>
                    <Image
                      source={{ uri: p.uri }}
                      style={{ width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
                      resizeMode="cover"
                    />
                    <Text style={[type.small, { color: colors.inkSoft, marginTop: 4 }]}>
                      {i === 0 ? "▶ " : "◀ "}
                      {p.date}
                      {p.kg ? ` · ${p.kg}kg` : ""}
                      {p.bf ? ` · ${p.bf}%` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* the whole roll */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {[...photos].reverse().map((p) => (
              <View key={p.id} style={{ width: "31%" }}>
                <Image
                  source={{ uri: p.uri }}
                  style={{ width: "100%", height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => removePhoto(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t.progress.photoRemove}
                  hitSlop={6}
                  style={{ position: "absolute", top: 4, right: 4 }}
                >
                  <Ionicons name="close-circle" size={22} color={colors.onAccent} style={{ opacity: 0.9 }} />
                </Pressable>
                <Text style={[type.label, { color: colors.inkFaint, marginTop: 2 }]} numberOfLines={1}>
                  {p.date}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

/** The tape-measure section — folded in from the old Body tab so every number
 * about the body lives in one corner. */
function MeasurementsSection() {
  const { t } = useI18n();
  const { space, type } = useTheme();
  const { colors } = useTheme();
  return (
    <Card label={t.progress.measureTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.progress.measureBody}</Text>
      {/* Every Add below stays greyed until a number is typed — said once here,
          quietly, rather than once on every part card. */}
      <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
        {fill(t.body.rangeError, { min: MIN_CM, max: MAX_CM })}
      </Text>
      <View style={{ gap: space.md, marginTop: space.md }}>
        {BODY_PARTS.map((part) => (
          <PartCard key={part} part={part} />
        ))}
      </View>
    </Card>
  );
}

function MeasureSparkline({ values }: { values: number[] }) {
  const { colors, radius } = useTheme();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 40 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 8 + ((v - min) / range) * 30,
            borderRadius: radius.sm,
            backgroundColor: i === values.length - 1 ? colors.accent : colors.accentWash,
          }}
        />
      ))}
    </View>
  );
}

function PartCard({ part }: { part: BodyPart }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { addMeasurement, measurementSeries } = useStore();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const series = measurementSeries(part);
  const change = measureChange(series);
  const label = t.body.parts[part];

  function save() {
    const cm = Number(draft.replace(",", "."));
    if (!Number.isFinite(cm) || cm < MIN_CM || cm > MAX_CM) {
      setError(fill(t.body.rangeError, { min: MIN_CM, max: MAX_CM }));
      return;
    }
    addMeasurement(part, cm);
    setDraft("");
    setError(null);
  }

  const down = change.delta < 0;
  const up = change.delta > 0;

  return (
    <View style={{ borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: space.md, gap: space.xs }}>
      <Text style={[type.bodyStrong, { color: colors.ink }]}>{label}</Text>
      {change.latest !== null ? (
        <View style={{ flexDirection: "row", gap: space.lg, alignItems: "flex-end" }}>
          <View>
            <Text style={[type.label, { color: colors.inkFaint }]}>{t.body.latest}</Text>
            <Text style={[type.title, { color: colors.ink }]}>
              {change.latest}
              <Text style={[type.small, { color: colors.inkFaint }]}> {t.body.cm}</Text>
            </Text>
          </View>
          {change.count > 1 ? (
            <View>
              <Text style={[type.label, { color: colors.inkFaint }]}>{t.body.change}</Text>
              <Text style={[type.bodyStrong, { color: down ? colors.accent : up ? colors.orangeInk : colors.inkSoft }]}>
                {up ? "+" : ""}
                {change.delta} {t.body.cm}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <MeasureSparkline values={series.map((r) => r.cm)} />
          </View>
        </View>
      ) : (
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.body.empty}</Text>
      )}

      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start", marginTop: space.xs }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              if (error) setError(null);
            }}
            placeholder={t.body.cmPlaceholder}
            keyboardType="numeric"
            onSubmitEditing={save}
          />
        </View>
        <View style={{ width: 110 }}>
          <Button icon="add" label={t.body.add} onPress={save} disabled={!draft.trim()} tone="quiet" />
        </View>
      </View>
      {error ? <Text style={[type.small, { color: colors.alert }]}>{error}</Text> : null}
    </View>
  );
}

/** The label for a goal, reused across the progress cards. */
function goalWord(t: ReturnType<typeof useI18n>["t"], g: string): string {
  return g === "cut"
    ? t.kitchen.goalCut
    : g === "bulk"
      ? t.kitchen.goalBulk
      : g === "maintain"
        ? t.kitchen.goalMaintain
        : t.kitchen.goalRecomp;
}
