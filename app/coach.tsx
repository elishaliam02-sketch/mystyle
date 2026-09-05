import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Screen } from "@/components/Screen";
import { PillButton } from "@/components/PillButton";
import { useI18n } from "@/i18n";
import { coachReply, suggestedQuestions } from "@/coach";
import { dailyTarget } from "@/kitchen";
import { bodyFatPercent, weeklyChange, type Sex } from "@/health/composition";
import { today, useStore } from "@/store";
import { useTheme } from "@/theme";

type Turn = { id: string; from: "you" | "coach"; text: string };

/**
 * The coach: a chat that answers from this person's own numbers.
 *
 * It runs on the device, so it costs nothing, needs no signal and no account,
 * and it can quote the real targets back — which is what makes it useful rather
 * than a generic assistant. It never gives medical or clinical advice.
 */
export default function CoachScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const router = useRouter();
  const {
    state,
    goal,
    todayIntake,
    todayWater,
    waterGoal,
    todaySteps,
    stepGoal,
  } = useStore();

  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scroller = useRef<ScrollView>(null);

  // Everything the coach is allowed to know, read fresh on every answer.
  const context = useMemo(() => {
    const weightKg =
      [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ??
      state.profile.startKg;
    const g = goal();
    const target = dailyTarget(weightKg, g);
    const eaten = todayIntake();
    const waist = state.measurements?.waist?.at(-1)?.cm;
    return {
      name: state.profile.name || undefined,
      goal: g,
      kcalTarget: target.kcal,
      kcalEaten: eaten.kcal,
      proteinTarget: target.protein,
      proteinEaten: eaten.protein,
      waterCups: todayWater(),
      waterGoal: waterGoal(),
      steps: todaySteps(),
      stepGoal: stepGoal(),
      weeklyChangeKg: weeklyChange(state.weighIns),
      bodyFat: bodyFatPercent({
        heightCm: state.profile.heightCm,
        waistCm: waist,
        sex: state.profile.sex as Sex | undefined,
      }),
      planDays: state.training?.days,
      trainedToday: (state.training?.log?.[today()]?.length ?? 0) > 0,
    };
  }, [state, goal, todayIntake, todayWater, waterGoal, todaySteps, stepGoal]);

  const openers = useMemo(() => suggestedQuestions(locale === "he" ? "he" : "en"), [locale]);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    const reply = coachReply(q, context, locale === "he" ? "he" : "en");
    setTurns((prev) => [
      ...prev,
      { id: `${Date.now()}-q`, from: "you", text: q },
      { id: `${Date.now()}-a`, from: "coach", text: reply.text },
    ]);
    setDraft("");
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen
        title={t.coach.heading}
        subtitle={t.coach.body}
        aside={
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.inkSoft} />
          </Pressable>
        }
      >
        <ScrollView ref={scroller} style={{ maxHeight: 460 }} contentContainerStyle={{ gap: space.sm }}>
          {turns.length === 0 ? (
            <View
              style={{
                padding: space.lg,
                borderRadius: radius.lg,
                backgroundColor: colors.surfaceAlt,
                gap: 6,
              }}
            >
              <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.coach.emptyTitle}</Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>{t.coach.emptyBody}</Text>
            </View>
          ) : null}

          {turns.map((turn) => {
            const mine = turn.from === "you";
            return (
              <View
                key={turn.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  paddingVertical: 10,
                  paddingHorizontal: space.md,
                  borderRadius: radius.lg,
                  backgroundColor: mine ? colors.accent : colors.surfaceAlt,
                }}
              >
                <Text
                  style={[
                    type.body,
                    { color: mine ? colors.onAccent : colors.ink },
                  ]}
                >
                  {turn.text}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* taps, so the chat is never a blank box staring back */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm }}>
          {openers.map((q) => (
            <PillButton key={q} tone="soft" label={q} onPress={() => ask(q)} />
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", marginTop: space.md }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t.coach.placeholder}
            placeholderTextColor={colors.inkFaint}
            onSubmitEditing={() => ask(draft)}
            returnKeyType="send"
            accessibilityLabel={t.coach.placeholder}
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 12,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
              color: colors.ink,
              fontFamily: font.bodyMedium,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={() => ask(draft)}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t.coach.send}
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: draft.trim() ? colors.accent : colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="send" size={20} color={draft.trim() ? colors.onAccent : colors.inkFaint} />
          </Pressable>
        </View>

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.coach.note}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
