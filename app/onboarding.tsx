import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { SelectTile } from "@/components/SelectTile";
import { StepDots } from "@/components/StepDots";
import { difficultyColor } from "@/components/TaskScan";
import { SupportPreview } from "@/components/SupportPreview";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { checkGoalWeight, isHeightCm, MAX_HEIGHT_CM, MIN_HEIGHT_CM } from "@/health";
import { isStorableWeight, MAX_KG, MIN_KG } from "@/store/weight";
import { useStore, type Habit } from "@/store";
import { NEWS } from "@/news";
import { NEWS_SEEN_KEY } from "@/components/WhatsNew";
import type { Difficulty } from "@/tasks/difficulty";
import { useTheme } from "@/theme";

const TOTAL = 4;
const SLOTS: (Habit["slot"] | undefined)[] = ["morning", "noon", "evening", undefined];

export default function Onboarding() {
  const { t, locale, isRTL } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, saveProfile, addHabit, addWeighIn, setChallengeLevel, setGoal } = useStore();
  // Which way the person wants to go — it sets the calories, the kitchen and
  // the plan. Chosen here, or read from the two weights when they give both.
  const [direction, setDirection] = useState<"cut" | "recomp" | "bulk" | null>(null);

  // Arrived here while already onboarded (a stale link, a re-mount): go home.
  // Checked once at mount, so finish() flipping the flag can never trigger it.
  useEffect(() => {
    if (state.profile.onboarded) router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currentKg, setCurrentKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [goalKg, setGoalKg] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [habit, setHabit] = useState("");
  // Null is a real answer here — "no daily challenge" — so it is not the same
  // as "not asked yet", which is what an undefined level in the store means.
  const [level, setLevel] = useState<Difficulty | null>("moderate");
  const [slot, setSlot] = useState<Habit["slot"]>();

  const ideas = Object.values(t.onboarding.ideas);

  const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : undefined);
  // Height typed in metres ("1.75") is centimetres the person meant.
  const heightOf = (v: string) => {
    const n = num(v);
    return n !== undefined && n >= 1.2 && n <= 2.4 ? Math.round(n * 100) : n;
  };

  /**
   * The same refusal as the profile screen, applied at the very first screen a
   * person sees. Onboarding was the easiest door to walk an unhealthy target
   * through, because nothing here used to check anything.
   */
  function goalProblem(): string | null {
    const cm = heightOf(heightCm);
    if (cm !== undefined && !isHeightCm(cm)) {
      return fill(t.profile.heightRange, { min: MIN_HEIGHT_CM, max: MAX_HEIGHT_CM });
    }
    const kg = num(currentKg);
    if (kg !== undefined && !isStorableWeight(kg)) {
      return fill(t.progress.weighRange, { min: MIN_KG, max: MAX_KG });
    }
    const target = num(goalKg);
    if (target === undefined) return null;
    const verdict = checkGoalWeight(target, kg, cm);
    if (verdict.status === "out-of-range") {
      return fill(t.profile.goalRange, { min: verdict.min, max: verdict.max });
    }
    if (verdict.status === "needs-height") return t.profile.goalNeedsHeight;
    if (verdict.status === "too-low") return fill(t.profile.goalTooLow, { floor: verdict.floor });
    if (verdict.status === "too-high") {
      return fill(t.profile.goalTooHigh, { ceiling: verdict.ceiling });
    }
    return null;
  }

  function finish() {
    // The level is stored before the profile so the very first Today screen
    // already has a challenge on it — arriving to an empty card and being told
    // to come back tomorrow is a poor first minute.
    if (level) setChallengeLevel(level);
    saveProfile({
      name: name.trim(),
      goalKg: num(goalKg),
      heightCm: heightOf(heightCm),
      onboarded: true,
    });
    const kg = num(currentKg);
    if (kg !== undefined && Number.isFinite(kg)) addWeighIn(kg);
    // The goal drives the calorie target, the kitchen and the training plan.
    // Someone who typed 95 → 75 wants to lose weight; they were getting a
    // maintenance target and "recomp" meals.
    const target = num(goalKg);
    const inferred =
      kg !== undefined && target !== undefined && Number.isFinite(kg) && Number.isFinite(target)
        ? target < kg - 1
          ? "cut"
          : target > kg + 1
            ? "bulk"
            : "recomp"
        : null;
    const chosen = direction ?? inferred;
    if (chosen) setGoal(chosen);
    addHabit(habit.trim().slice(0, 80), slot);
    // A first run lands on Today with its day already set up — and without
    // the changelog of an app it has never seen.
    AsyncStorage.setItem(NEWS_SEEN_KEY, NEWS.id).catch(() => {});
    router.replace("/");
  }

  // The habit step is the only one that cannot be left empty; the challenge
  // level has a default and "no challenge" is a valid choice.
  const canContinue = step === 2 ? habit.trim().length > 0 : true;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: colors.band,
            paddingTop: insets.top + space.xl,
            paddingBottom: space.xl,
            paddingHorizontal: space.lg,
            borderBottomStartRadius: 28,
            borderBottomEndRadius: 28,
            gap: space.md,
          }}
        >
          <StepDots total={TOTAL} current={step} onBand />
          <Text style={[type.label, { color: colors.bandInkSoft }]}>
            {fill(t.onboarding.stepOf, { step: step + 1, total: TOTAL })}
          </Text>
        </View>

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xl, flexGrow: 1 }}>

        {step === 0 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[type.hero, { color: colors.ink }]}>{t.onboarding.step1Title}</Text>
              <Text style={[type.body, { color: colors.inkSoft }]}>{t.onboarding.step1Body}</Text>
            </View>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder={t.onboarding.step1Placeholder}
              autoFocus
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[type.hero, { color: colors.ink }]}>{t.onboarding.step2Title}</Text>
              <Text style={[type.body, { color: colors.inkSoft }]}>{t.onboarding.step2Body}</Text>
            </View>
            <TextField
              value={currentKg}
              onChangeText={setCurrentKg}
              label={t.onboarding.step2Current}
              placeholder="0"
              keyboardType="numeric"
            />
            <TextField
              value={heightCm}
              onChangeText={setHeightCm}
              label={t.profile.heightTitle}
              placeholder={t.profile.heightPlaceholder}
              keyboardType="numeric"
            />
            <TextField
              value={goalKg}
              onChangeText={(v) => {
                setGoalKg(v);
                // A goal weight answers the direction question by itself.
                const cur = num(currentKg);
                const g = num(v);
                if (cur && g && Number.isFinite(cur) && Number.isFinite(g)) {
                  setDirection(g < cur - 1 ? "cut" : g > cur + 1 ? "bulk" : "recomp");
                }
              }}
              label={t.onboarding.step2Goal}
              placeholder="0"
              keyboardType="numeric"
            />
            <View style={{ gap: space.xs }}>
              <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
                {t.onboarding.directionTitle}
              </Text>
              <View style={{ flexDirection: "row", gap: space.xs }}>
                {(
                  [
                    ["cut", t.onboarding.directionCut],
                    ["recomp", t.onboarding.directionRecomp],
                    ["bulk", t.onboarding.directionBulk],
                  ] as const
                ).map(([id, label]) => (
                  <SelectTile
                    key={id}
                    selected={direction === id}
                    onPress={() => setDirection(id)}
                    style={{
                      flex: 1,
                      borderRadius: radius.md,
                      paddingVertical: 12,
                      paddingHorizontal: 6,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: direction === id ? colors.accent : colors.rule,
                    }}
                  >
                    <Text
                      style={[type.smallStrong, { color: direction === id ? colors.onAccent : colors.ink, textAlign: "center" }]}
                    >
                      {label}
                    </Text>
                  </SelectTile>
                ))}
              </View>
            </View>
            {note ? (
              <Text style={[type.small, { color: colors.orangeInk, fontWeight: "700" }]}>{note}</Text>
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[type.hero, { color: colors.ink }]}>{t.challenge.levelTitle}</Text>
              <Text style={[type.body, { color: colors.inkSoft }]}>{t.challenge.levelBody}</Text>
            </View>
            <View style={{ gap: space.sm }}>
              {(
                [
                  ["easy", t.challenge.levelEasy, t.challenge.levelEasyBody],
                  ["moderate", t.challenge.levelModerate, t.challenge.levelModerateBody],
                  ["hard", t.challenge.levelHard, t.challenge.levelHardBody],
                ] as const
              ).map(([id, title, body]) => {
                const on = level === id;
                return (
                  <SelectTile
                    key={id}
                    selected={on}
                    onPress={() => setLevel(id)}
                    style={{
                      borderWidth: 1.5,
                      borderColor: on ? difficultyColor(colors, id) : colors.rule,
                      borderRadius: radius.lg,
                      padding: space.lg,
                    }}
                  >
                    <Text style={[type.title, { color: on ? colors.onAccent : colors.ink }]}>
                      {title}
                    </Text>
                    <Text
                      style={[
                        type.small,
                        { color: on ? colors.onAccent : colors.inkSoft, marginTop: 2 },
                      ]}
                    >
                      {body}
                    </Text>
                  </SelectTile>
                );
              })}
              <Pressable
                onPress={() => setLevel(null)}
                accessibilityRole="button"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: space.sm })}
              >
                <Text style={[type.small, { color: colors.inkFaint, textAlign: "center" }]}>
                  {t.challenge.skip}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[type.hero, { color: colors.ink }]}>{t.onboarding.step3Title}</Text>
              <Text style={[type.body, { color: colors.inkSoft }]}>{t.onboarding.step3Body}</Text>
            </View>

            <TextField
              value={habit}
              onChangeText={setHabit}
              placeholder={t.onboarding.step3Placeholder}
              maxLength={80}
              multiline
            />

            <SupportPreview title={habit} />

            <View style={{ gap: space.sm }}>
              <Text style={[type.label, { color: colors.inkFaint }]}>
                {t.onboarding.step3Ideas}
              </Text>
              <View style={{ gap: space.sm }}>
                {ideas.map((idea) => (
                  <Pressable
                    key={idea}
                    onPress={() => setHabit(idea)}
                    accessibilityRole="button"
                    accessibilityLabel={idea}
                    accessibilityState={{ selected: habit === idea }}
                    style={({ pressed }) => ({
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: habit === idea ? colors.accent : colors.rule,
                      borderRadius: 10,
                      paddingVertical: space.md,
                      paddingHorizontal: space.lg,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={[type.small, { color: colors.ink }]}>{idea}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: space.sm }}>
              <Text style={[type.label, { color: colors.inkFaint }]}>{t.onboarding.step3When}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {SLOTS.map((s) => (
                  <Chip
                    key={s ?? "any"}
                    label={s ? t.slots[s] : t.slots.any}
                    selected={slot === s}
                    onPress={() => setSlot(s)}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={{ gap: space.sm }}>
          {!canContinue ? (
            <Text style={[type.small, { color: colors.limeInk, textAlign: "center" }]}>
              {t.onboarding.step3NeedOne}
            </Text>
          ) : null}
          <Button
            // "Forward" is a different glyph in each direction; a fixed one
            // points backwards for half the users.
            icon={step === TOTAL - 1 ? "sparkles" : isRTL ? "arrow-back" : "arrow-forward"}
            label={step === TOTAL - 1 ? t.onboarding.finish : t.onboarding.next}
            disabled={!canContinue}
            onPress={() => {
              // Leaving the weight step is where the goal is judged: it must
              // not be possible to walk past it and land on a stored target.
              if (step === 1) {
                const problem = goalProblem();
                if (problem) {
                  setNote(problem);
                  return;
                }
                setNote(null);
              }
              if (step === TOTAL - 1) finish();
              else setStep(step + 1);
            }}
          />
          {step === 1 ? (
            <Button
              label={t.onboarding.skip}
              tone="quiet"
              onPress={() => {
                // Skip is about the two weights. The height is the one number
                // with no other door until Profile — and the body-fat card
                // needs it — so it survives, unless it is unusable anyway.
                setCurrentKg("");
                setGoalKg("");
                const cm = heightOf(heightCm);
                if (cm !== undefined && !isHeightCm(cm)) setHeightCm("");
                setNote(null);
                setStep(2);
              }}
            />
          ) : null}
          {/* Back is a way out, not a choice to weigh: as a third full-width
              button it read as heavy as the step's real action. */}
          <Pressable
            onPress={() => (step > 0 ? setStep(step - 1) : router.replace("/welcome"))}
            accessibilityRole="button"
            accessibilityLabel={t.onboarding.back}
            hitSlop={8}
            style={({ pressed }) => ({
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: space.xs,
              paddingVertical: space.sm,
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons
              name={isRTL ? "chevron-forward" : "chevron-back"}
              size={15}
              color={colors.inkSoft}
            />
            <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{t.onboarding.back}</Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
