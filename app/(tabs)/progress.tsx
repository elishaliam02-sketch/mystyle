import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { askWeekInsight } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge } from "@/components/AiNote";
import { computeAchievements, unlockedCount } from "@/achievements";
import { fill, useI18n } from "@/i18n";
import { weekReading } from "@/insight";
import { checkWeight } from "@/store/weight";
import {
  averageSteps,
  isStorableGoal as isStorableStepGoal,
  MAX_STEP_GOAL,
  MAX_STEPS,
  MIN_STEP_GOAL,
  recentSteps,
  stepStreak,
  stepsKcal,
  stepsKm,
} from "@/health/steps";
import { daysAgo, today, useStore, type WeighIn } from "@/store";
import { useTheme } from "@/theme";

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
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.progress.heading}>
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
                      { color: delta <= 0 ? colors.accent : colors.amber },
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
              }}
              placeholder={t.progress.weighPlaceholder}
              keyboardType="numeric"
              onSubmitEditing={save}
            />
            {weighNote ? (
              <Text style={[type.small, { color: colors.alert }]}>{weighNote}</Text>
            ) : null}
            <Button
              icon={jumpArmed ? "checkmark" : "add"}
              label={t.progress.weighSave}
              onPress={save}
              disabled={!kg.trim()}
            />
          </View>
        </Card>

        <StepsCard />

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
            <Text style={[type.figure, { color: colors.ink }]}>
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
  const [draft, setDraft] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const log = state.steps ?? {};
  const day = todaySteps();
  const goal = stepGoal();
  const pct = Math.min(100, Math.round((day / goal) * 100));
  const week = useMemo(() => recentSteps(log, today(), 7), [log]);
  const avg = averageSteps(log, today(), 7);
  const streak = stepStreak(log, today(), goal);
  const weightKg = [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg;
  const peak = Math.max(goal, ...week.map((d) => d.steps), 1);

  function saveCount() {
    const n = Number(draft.replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > MAX_STEPS) {
      setNote(fill(t.steps.range, { max: MAX_STEPS }));
      return;
    }
    setSteps(Math.round(n));
    setDraft("");
    setNote(null);
  }

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
        <Text style={[type.figure, { color: colors.ink }]}>{day.toLocaleString()}</Text>
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
            backgroundColor: day >= goal ? colors.accent : colors.amber,
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
                backgroundColor: d.steps >= goal ? colors.accent : colors.rule,
              }}
            />
          </View>
        ))}
      </View>
      <Text style={[type.small, { color: colors.inkFaint }]}>
        {fill(t.steps.weekAverage, { avg: avg.toLocaleString() })}
      </Text>

      {/* quick nudges, for logging as you go */}
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        {[500, 1000, 2000].map((n) => (
          <PillButton
            key={n}
            tone="soft"
            label={fill(t.steps.add, { n })}
            accessibilityLabel={fill(t.steps.add, { n })}
            onPress={() => addSteps(n)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      {/* or the exact number off the phone */}
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              if (note) setNote(null);
            }}
            placeholder={t.steps.placeholder}
            keyboardType="numeric"
            onSubmitEditing={saveCount}
          />
        </View>
        <Button label={t.steps.save} onPress={saveCount} disabled={!draft.trim()} tone="quiet" />
      </View>

      {editingGoal ? (
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={goalDraft}
              onChangeText={setGoalDraft}
              placeholder={t.steps.goalPlaceholder}
              keyboardType="numeric"
              onSubmitEditing={saveGoal}
            />
          </View>
          <Button label={t.steps.save} onPress={saveGoal} tone="quiet" />
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setGoalDraft(String(goal));
            setEditingGoal(true);
          }}
          accessibilityRole="button"
          style={{ marginTop: space.sm }}
        >
          <Text style={[type.smallStrong, { color: colors.accent }]}>{t.steps.changeGoal}</Text>
        </Pressable>
      )}

      {note ? (
        <Text style={[type.small, { color: colors.alert, marginTop: 6 }]}>{note}</Text>
      ) : null}

      <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
        {t.steps.note}
      </Text>
    </Card>
  );
}
