import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { StepDots } from "@/components/StepDots";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { useStore, type Habit } from "@/store";
import { useTheme } from "@/theme";

const TOTAL = 3;
const SLOTS: (Habit["slot"] | undefined)[] = ["morning", "noon", "evening", undefined];

export default function Onboarding() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveProfile, addHabit, addWeighIn } = useStore();

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
    addHabit(habit, slot);
    router.replace("/");
  }

  const canContinue = step === 2 ? habit.trim().length > 0 : true;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.lg,
          gap: space.xl,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.md }}>
          <StepDots total={TOTAL} current={step} />
          <Text style={[type.label, { color: colors.inkFaint }]}>
            {fill(t.onboarding.stepOf, { step: step + 1, total: TOTAL })}
          </Text>
        </View>

        {step === 0 ? (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Text style={[type.display, { color: colors.ink }]}>{t.onboarding.step1Title}</Text>
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
              <Text style={[type.display, { color: colors.ink }]}>{t.onboarding.step2Title}</Text>
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
              <Text style={[type.display, { color: colors.ink }]}>{t.onboarding.step3Title}</Text>
              <Text style={[type.body, { color: colors.inkSoft }]}>{t.onboarding.step3Body}</Text>
            </View>

            <TextField
              value={habit}
              onChangeText={setHabit}
              placeholder={t.onboarding.step3Placeholder}
              multiline
            />

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
          {step > 0 ? (
            <Button label={t.onboarding.back} tone="quiet" onPress={() => setStep(step - 1)} />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
