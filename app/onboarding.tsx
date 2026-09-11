import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { StepDots } from "@/components/StepDots";
import { SupportPreview } from "@/components/SupportPreview";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { checkGoalWeight, isHeightCm, MAX_HEIGHT_CM, MIN_HEIGHT_CM } from "@/health";
import { isStorableWeight, MAX_KG, MIN_KG } from "@/store/weight";
import { useStore, type Habit } from "@/store";
import { useTheme } from "@/theme";

const TOTAL = 3;
const SLOTS: (Habit["slot"] | undefined)[] = ["morning", "noon", "evening", undefined];

export default function Onboarding() {
  const { t, locale, isRTL } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, saveProfile, addHabit, addWeighIn } = useStore();

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
  const [slot, setSlot] = useState<Habit["slot"]>();

  const ideas = Object.values(t.onboarding.ideas);

  const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : undefined);

  /**
   * The same refusal as the profile screen, applied at the very first screen a
   * person sees. Onboarding was the easiest door to walk an unhealthy target
   * through, because nothing here used to check anything.
   */
  function goalProblem(): string | null {
    const cm = num(heightCm);
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
    saveProfile({
      name: name.trim(),
      goalKg: num(goalKg),
      heightCm: num(heightCm),
      onboarded: true,
    });
    if (currentKg) addWeighIn(Number(currentKg));
    const id = addHabit(habit, slot);
    // One navigation, straight to the habit's tips — the first thing a new
    // user sees is the guidance. Its back button goes home when there is no
    // history behind it, so this is not a dead end.
    router.replace(id ? `/habit/${id}` : "/");
  }

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
              onChangeText={setGoalKg}
              label={t.onboarding.step2Goal}
              placeholder="0"
              keyboardType="numeric"
            />
            {note ? (
              <Text style={[type.small, { color: colors.orangeInk, fontWeight: "700" }]}>{note}</Text>
            ) : null}
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
                const cm = num(heightCm);
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
