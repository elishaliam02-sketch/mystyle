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
import { useStore, type Habit } from "@/store";
import { useTheme } from "@/theme";

const TOTAL = 3;
const SLOTS: (Habit["slot"] | undefined)[] = ["morning", "noon", "evening", undefined];

export default function Onboarding() {
  const { t, locale } = useI18n();
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
  const [goalKg, setGoalKg] = useState("");
  const [habit, setHabit] = useState("");
  const [slot, setSlot] = useState<Habit["slot"]>();

  const ideas = Object.values(t.onboarding.ideas);

  function finish() {
    saveProfile({
      name: name.trim(),
      goalKg: goalKg ? Number(goalKg) : undefined,
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
              value={goalKg}
              onChangeText={setGoalKg}
              label={t.onboarding.step2Goal}
              placeholder="0"
              keyboardType="numeric"
            />
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
            <Text style={[type.small, { color: colors.signal, textAlign: "center" }]}>
              {t.onboarding.step3NeedOne}
            </Text>
          ) : null}
          <Button
            icon={step === TOTAL - 1 ? "sparkles" : "arrow-back"}
            label={step === TOTAL - 1 ? t.onboarding.finish : t.onboarding.next}
            disabled={!canContinue}
            onPress={() => (step === TOTAL - 1 ? finish() : setStep(step + 1))}
          />
          {step === 1 ? (
            <Button
              label={t.onboarding.skip}
              tone="quiet"
              onPress={() => {
                setCurrentKg("");
                setGoalKg("");
                setStep(2);
              }}
            />
          ) : null}
          <Button
            label={t.onboarding.back}
            tone="quiet"
            onPress={() => (step > 0 ? setStep(step - 1) : router.replace("/welcome"))}
          />
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
