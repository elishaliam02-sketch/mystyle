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
import { coachReply, suggestedQuestions, type CoachContext } from "@/coach";
import { askServer } from "@/ai/server";
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
  const [thinking, setThinking] = useState(false);
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

  /**
   * Answers instantly from the device, then — when a model is configured on our
   * server — replaces that answer with a fuller one. The person is never left
   * waiting on a network call for a question the app can already answer, and if
   * the model is unreachable or its free quota is spent, the local answer is
   * simply what stays.
   */
  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    const lang = locale === "he" ? "he" : "en";
    const local = coachReply(q, context, lang);
    const answerId = `${Date.now()}-a`;

    setTurns((prev) => [
      ...prev,
      { id: `${Date.now()}-q`, from: "you", text: q },
      { id: answerId, from: "coach", text: local.text },
    ]);
    setDraft("");
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));

    setThinking(true);
    const answer = await askServer({
      system: coachSystemPrompt(lang),
      prompt: `${factsFor(context, lang)}\n\nQuestion: ${q}`,
    });
    setThinking(false);
    if (answer.ok) {
      setTurns((prev) => prev.map((t) => (t.id === answerId ? { ...t, text: answer.text } : t)));
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }
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

        {thinking ? (
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
            {t.coach.thinking}
          </Text>
        ) : null}

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


/** The rules the model answers under. Safety is decided here, not by the model. */
function coachSystemPrompt(locale: "he" | "en"): string {
  const lang = locale === "he" ? "Hebrew" : "English";
  return [
    `You are the coach inside APEX, a fitness and nutrition app.`,
    `Answer in ${lang}, in at most four short sentences, speaking directly to the person.`,
    `Use the figures you are given — quote them back rather than talking in generalities.`,
    ``,
    `Rules, non-negotiable:`,
    `- Never give medical or clinical advice, and never diagnose.`,
    `- Never encourage fasting, purging, or extreme restriction.`,
    `- If asked about pain, injury, medication, pregnancy or a medical condition,`,
    `  keep it general and say to speak with a professional.`,
    `- Never shame the person.`,
  ].join("\n");
}

/** The person's own numbers, handed to the model as plain facts. */
function factsFor(c: CoachContext, locale: "he" | "en"): string {
  const rows = [
    `goal: ${c.goal}`,
    c.kcalTarget != null ? `calories today: ${c.kcalEaten ?? 0} of ${c.kcalTarget}` : null,
    c.proteinTarget != null ? `protein today: ${c.proteinEaten ?? 0}g of ${c.proteinTarget}g` : null,
    c.waterGoal != null ? `water today: ${c.waterCups ?? 0} of ${c.waterGoal} cups` : null,
    c.stepGoal != null ? `steps today: ${c.steps ?? 0} of ${c.stepGoal}` : null,
    c.weeklyChangeKg != null ? `weekly average change: ${c.weeklyChangeKg} kg vs last week` : null,
    c.bodyFat != null ? `estimated body fat: ${c.bodyFat}%` : null,
    c.planDays != null ? `training days per week: ${c.planDays}` : null,
    `trained today: ${c.trainedToday ? "yes" : "no"}`,
    c.name ? `name: ${c.name}` : null,
  ].filter(Boolean);
  return `Here are this person's figures right now:\n${rows.join("\n")}`;
}
