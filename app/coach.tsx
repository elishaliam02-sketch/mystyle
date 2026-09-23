import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MAX_CONTENT } from "@/components/Screen";
import { PillButton } from "@/components/PillButton";
import { useI18n } from "@/i18n";
import { coachReply, suggestedQuestions, type CoachContext } from "@/coach";
import { eatIntent, eatenLabel, parseEaten } from "@/coach/logfood";
import { askServer } from "@/ai/server";
import { answerHelp, isAppQuestion } from "@/help";
import { AiNote } from "@/components/AiNote";
import { ProGate, ProRemaining } from "@/components/ProGate";
import { dailyTarget } from "@/kitchen";
import { bodyFatPercent, weeklyChange, type Sex } from "@/health/composition";
import { today, useStore } from "@/store";
import { useTheme } from "@/theme";

type Turn = { id: string; from: "you" | "coach"; text: string; route?: string };

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    state,
    goal,
    todayIntake,
    todayWater,
    waterGoal,
    todaySteps,
    stepGoal,
    logMeal,
    allowance,
    noteUsed,
  } = useStore();

  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [aiOff, setAiOff] = useState(false);
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

    // "Where do I log my weight?" is a question about the app, not about
    // training: the guide answers it, with a button to the screen — and it is
    // free, so it comes before the daily limit rather than after it.
    if (isAppQuestion(q)) {
      const found = answerHelp(q);
      if (found.kind === "answer") {
        const topic = found.topic[locale === "he" ? "he" : "en"];
        setTurns((prev) => [
          ...prev,
          { id: `${Date.now()}-q`, from: "you", text: q },
          {
            id: `${Date.now()}-a`,
            from: "coach",
            text: `${t.help.fromCoach}\n${topic.title}\n${topic.answer}`,
            route: found.topic.route,
          },
        ]);
        setDraft("");
        requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
        return;
      }
    }

    // Asked before a word of work is done, so a refused question never costs a
    // reply. The thread above stays exactly as it is — the limit is on the next
    // answer, not on the conversation already had — and the send button leads
    // to the paywall rather than sitting there doing nothing.
    if (!allowance("coach").ok) {
      router.push("/paywall");
      return;
    }

    const lang = locale === "he" ? "he" : "en";

    // If the person is telling the coach what they ate, log it and confirm with
    // the new running total — the coach does the thing, not just talks about it.
    if (eatIntent(q)) {
      const eaten = parseEaten(q, lang);
      if (eaten) {
        logMeal(eatenLabel(eaten), eaten.kcal, eaten.protein);
        const totalKcal = todayIntake().kcal + eaten.kcal;
        const target = context.kcalTarget;
        const left = target ? target - totalKcal : null;
        const lines = eaten.items
          .map((i) => `• ${i.label} — ≈${i.kcal} ${lang === "he" ? "קק״ל" : "kcal"}`)
          .join("\n");
        const confirm =
          lang === "he"
            ? `רשמתי ליומן:\n${lines}\n\nסה״כ ≈${eaten.kcal} קק״ל · ${eaten.protein} ג׳ חלבון.` +
              (left !== null ? `\nנשארו לך היום ≈${left} קק״ל.` : "")
            : `Logged it:\n${lines}\n\nTotal ≈${eaten.kcal} kcal · ${eaten.protein}g protein.` +
              (left !== null ? `\nYou have ≈${left} kcal left today.` : "");
        setTurns((prev) => [
          ...prev,
          { id: `${Date.now()}-q`, from: "you", text: q },
          { id: `${Date.now()}-a`, from: "coach", text: confirm },
        ]);
        setDraft("");
        requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
        return;
      }
    }

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
      // The only point at which a model actually answered. Everything below
      // this line is the on-device coach standing in for one — free to us, so
      // free to them; charging a reply for our server being unreachable would
      // take the day's quota for nothing.
      noteUsed("coach");
      return;
    }
    // The answer above it is the on-device coach's, and it is a real answer —
    // but a person who turned the AI off (or never turned it on) deserves to
    // know which of the two they are reading, and where the switch is. Shown
    // once, under the thread, rather than on every turn.
    setAiOff(answer.reason === "declined");
  }

  const centered = { width: "100%" as const, maxWidth: MAX_CONTENT, alignSelf: "center" as const };
  const sendDisabled = !draft.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* A chat cannot live inside Screen: its ScrollView and this one scroll
          the same axis, so on Android the outer one claims the drag and the
          conversation looks frozen — and it capped the thread at 460px. The
          band is rebuilt here so the message list is the only scroller. */}
      <LinearGradient
        colors={[colors.bandTop, colors.bandBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + space.xxl,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          borderBottomStartRadius: radius.xl,
          borderBottomEndRadius: radius.xl,
        }}
      >
        <View style={[centered, { flexDirection: "row", alignItems: "center", gap: space.lg }]}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={[type.hero, { color: colors.bandInk }]}>{t.coach.heading}</Text>
            <Text style={[type.smallStrong, { color: colors.bandInkSoft }]}>{t.coach.body}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={colors.bandInkSoft} />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={[centered, { padding: space.lg, gap: space.sm }]}
        keyboardShouldPersistTaps="handled"
      >
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
              {turn.route ? (
                <Pressable
                  onPress={() => router.push(turn.route as Href)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    gap: 6,
                    marginTop: space.sm,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? colors.accentWash : colors.accent,
                  })}
                >
                  <Ionicons name="open-outline" size={16} color={colors.onAccent} />
                  <Text style={[type.smallStrong, { color: colors.onAccent }]}>{t.help.open}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* The composer is fixed below the conversation rather than scrolling
          with it: a chat pane nested inside the screen's own scroller fought
          it for the gesture and read as frozen. */}
      <View
        style={[
          centered,
          { paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md, gap: space.sm },
        ]}
      >
        {aiOff && !thinking ? <AiNote state="declined" /> : null}

        {/* Above the composer, never over the thread: the conversation stays
            readable and scrollable while the card says why the next question
            is not going anywhere. */}
        <ProGate feature="coach" />
        <ProRemaining feature="coach" />

        {thinking ? (
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.coach.thinking}</Text>
        ) : null}

        {/* taps, so the chat is never a blank box staring back */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {openers.map((q) => (
            <PillButton key={q} tone="soft" label={q} onPress={() => ask(q)} />
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
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
            disabled={sendDisabled}
            accessibilityRole="button"
            accessibilityLabel={t.coach.send}
            accessibilityState={{ disabled: sendDisabled }}
            // The answer can be half a minute away, so the tap has to be felt
            // at once and the wait has to be visible on the button itself.
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: sendDisabled ? colors.surfaceAlt : colors.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed && !sendDisabled ? 0.94 : 1 }],
            })}
          >
            {thinking ? (
              <ActivityIndicator
                size="small"
                color={sendDisabled ? colors.inkFaint : colors.onAccent}
              />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={sendDisabled ? colors.inkFaint : colors.onAccent}
              />
            )}
          </Pressable>
        </View>

        <Text style={[type.small, { color: colors.inkFaint }]}>{t.coach.note}</Text>
      </View>
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
