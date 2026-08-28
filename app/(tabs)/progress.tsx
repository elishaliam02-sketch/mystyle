import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { askWeekInsight } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge, AiNote } from "@/components/AiNote";
import { fill, useI18n } from "@/i18n";
import { daysAgo, today, useStore, type WeighIn } from "@/store";
import { useTheme } from "@/theme";

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
  const { colors, space, type } = useTheme();
  const { state, addWeighIn, weeklyConsistency, isDone } = useStore();

  const [kg, setKg] = useState("");

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

  const { value: week, state: weekState, retry: retryWeek } = useAi(weekKey, (signal) =>
    askWeekInsight(
      { consistency, habits: perHabit, weights: weighIns, recentNotes },
      locale,
      dayKey,
      signal,
    ),
  );

  function save() {
    const value = Number(kg.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    addWeighIn(value);
    setKg("");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.progress.heading}>
        {activeHabits.length > 0 ? (
          <Card label={t.progress.weekTitle} tone={week ? "accent" : "default"}>
            {week ? (
              <View style={{ gap: space.sm }}>
                <AiBadge />
                <Text style={[type.title, { color: colors.ink }]}>{week.headline}</Text>
                <Text style={[type.body, { color: colors.ink }]}>{week.body}</Text>
              </View>
            ) : null}
            <View style={{ marginTop: week ? space.md : 0 }}>
              <AiNote state={weekState} onRetry={retryWeek} />
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
              onChangeText={setKg}
              placeholder={t.progress.weighPlaceholder}
              keyboardType="numeric"
              onSubmitEditing={save}
            />
            <Button icon="add" label={t.progress.weighSave} onPress={save} disabled={!kg.trim()} />
          </View>
        </Card>

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

        <Card label={t.progress.checkinsTitle}>
          <Text style={[type.title, { color: colors.ink }]}>
            {fill(t.progress.checkinsValue, { count: state.checkIns.length })}
          </Text>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
