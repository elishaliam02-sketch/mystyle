import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { askHabitSupport } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge, AiNote } from "@/components/AiNote";
import { daysAgo, useStore } from "@/store";
import { detectCategory, getSupport } from "@/support";
import { useTheme } from "@/theme";

/** Fourteen dots: filled where the habit happened, hollow where it didn't. */
function DayGrid({ habitId }: { habitId: string }) {
  const { colors, space } = useTheme();
  const { isDone } = useStore();
  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));

  return (
    <View style={{ flexDirection: "row", gap: 5, marginTop: space.sm, flexWrap: "wrap" }}>
      {days.map((date) => {
        const done = isDone(habitId, date);
        return (
          <View
            key={date}
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              backgroundColor: done ? colors.accent : "transparent",
              borderWidth: done ? 0 : 1,
              borderColor: colors.rule,
            }}
          />
        );
      })}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.accent,
          marginTop: 9,
        }}
      />
      <Text style={[type.small, { color: colors.ink, flex: 1, lineHeight: 21 }]}>{text}</Text>
    </View>
  );
}

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, streak, updateHabit, archiveHabit } = useStore();

  const habit = state.habits.find((h) => h.id === id);
  const [customAnchor, setCustomAnchor] = useState("");

  const habitTitle = habit?.title;
  const habitSlot = habit?.slot;

  // The written library renders instantly; Claude's version — built from the
  // user's exact sentence — replaces it when it lands, and AiNote says which
  // of the two is on screen rather than failing silently.
  const { value: ai, state: aiState, retry } = useAi(
    habitTitle ? `${habitTitle}|${habitSlot ?? ""}|${locale}` : null,
    (signal) => askHabitSupport(habitTitle ?? "", habitSlot, locale, signal),
  );

  if (!habit) {
    return <Screen title="—"><View /></Screen>;
  }

  const library = getSupport(detectCategory(habit.title), locale);
  const support = ai ?? library;
  const days = streak(habit.id);

  function confirmRemove() {
    if (!habit) return;
    Alert.alert(t.habit.remove, fill(t.habit.removeConfirm, { title: habit.title }), [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.habit.removeYes,
        style: "destructive",
        onPress: () => {
          archiveHabit(habit.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={habit.title}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.pill,
            paddingVertical: space.sm,
            paddingHorizontal: space.lg,
            marginTop: -space.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <Ionicons name="chevron-forward" size={16} color={colors.ink} />
            <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.detail.back}</Text>
          </View>
        </Pressable>
        {ai ? (
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <AiBadge />
            <Text style={[type.label, { color: colors.inkFaint }]}>· {support.label}</Text>
          </View>
        ) : (
          <Text style={[type.label, { color: colors.accent }]}>{support.label}</Text>
        )}
        <AiNote state={aiState} onRetry={retry} />

        <Card label={t.detail.streakTitle} tone={days > 0 ? "accent" : "default"}>
          <Text style={[type.title, { color: colors.ink }]}>
            {days > 0 ? fill(t.detail.streakDays, { days }) : t.detail.streakNone}
          </Text>
          <Text style={[type.label, { color: colors.inkFaint, marginTop: space.md }]}>
            {t.detail.last14}
          </Text>
          <DayGrid habitId={habit.id} />
        </Card>

        <Card label={t.detail.whyTitle}>
          <Text style={[type.body, { color: colors.ink }]}>{support.why}</Text>
        </Card>

        <Card label={t.detail.tipsTitle}>
          <View style={{ gap: space.md, marginTop: space.xs }}>
            {support.tips.map((tip) => (
              <Bullet key={tip} text={tip} />
            ))}
          </View>
        </Card>

        <Card label={t.detail.anchorTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.detail.anchorBody}</Text>
          {habit.anchor ? (
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Text style={[type.bodyStrong, { color: colors.accent }]}>
                {fill(t.detail.anchorSet, { anchor: habit.anchor })}
              </Text>
              <Button
                label={t.detail.anchorClear}
                tone="quiet"
                onPress={() => updateHabit(habit.id, { anchor: undefined })}
              />
            </View>
          ) : (
            <View style={{ gap: space.md, marginTop: space.md }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {support.anchors.map((anchor) => (
                  <Chip
                    key={anchor}
                    label={anchor}
                    onPress={() => updateHabit(habit.id, { anchor })}
                  />
                ))}
              </View>
              <TextField
                value={customAnchor}
                onChangeText={setCustomAnchor}
                placeholder={t.detail.anchorPrefix}
                onSubmitEditing={() => {
                  if (customAnchor.trim()) {
                    updateHabit(habit.id, { anchor: customAnchor.trim() });
                    setCustomAnchor("");
                  }
                }}
              />
            </View>
          )}
        </Card>

        {support.meals ? (
          <Card label={t.detail.mealsTitle}>
            <View style={{ gap: space.lg, marginTop: space.xs }}>
              {support.meals.map((meal) => (
                <View key={meal.slot} style={{ gap: space.sm }}>
                  <Text style={[type.bodyStrong, { color: colors.ink }]}>{meal.slot}</Text>
                  <View style={{ gap: space.sm }}>
                    {meal.ideas.map((idea) => (
                      <View
                        key={idea}
                        style={{
                          backgroundColor: colors.surfaceAlt,
                          borderRadius: radius.md,
                          paddingVertical: space.md,
                          paddingHorizontal: space.lg,
                        }}
                      >
                        <Text style={[type.small, { color: colors.ink }]}>{idea}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Text style={[type.small, { color: colors.inkFaint, marginTop: space.lg }]}>
              {t.detail.mealsNote}
            </Text>
          </Card>
        ) : null}

        <Card label={t.detail.smallerTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.detail.smallerBody}</Text>
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {support.smaller.map((option) => (
              <Pressable
                key={option}
                onPress={() => updateHabit(habit.id, { title: `${habit.title} — ${option}` })}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: colors.rule,
                  borderRadius: radius.md,
                  paddingVertical: space.md,
                  paddingHorizontal: space.lg,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={[type.small, { color: colors.ink }]}>{option}</Text>
                <Text style={[type.label, { color: colors.accent, marginTop: 4 }]}>
                  {t.detail.smallerApply}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Button icon="trash-outline" label={t.habit.remove} tone="danger" onPress={confirmRemove} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
