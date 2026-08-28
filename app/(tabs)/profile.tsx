import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { TextField } from "@/components/TextField";
import { useI18n, type Locale } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

const LOCALES: { id: Locale; label: string }[] = [
  { id: "he", label: "עברית" },
  { id: "en", label: "English" },
];

export default function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, saveProfile, reset } = useStore();

  const [name, setName] = useState(state.profile.name);
  const [goal, setGoal] = useState(state.profile.goalKg ? String(state.profile.goalKg) : "");

  function persist() {
    saveProfile({
      name: name.trim(),
      goalKg: goal.trim() ? Number(goal.replace(",", ".")) : undefined,
    });
  }

  function confirmReset() {
    Alert.alert(t.profile.dangerTitle, t.profile.dangerConfirm, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.profile.dangerYes, style: "destructive", onPress: reset },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.profile.heading}>
        <Card>
          <View style={{ gap: space.lg }}>
            <TextField
              value={name}
              onChangeText={setName}
              label={t.profile.nameTitle}
              placeholder={t.profile.namePlaceholder}
            />
            <TextField
              value={goal}
              onChangeText={setGoal}
              label={t.profile.goalTitle}
              placeholder={t.profile.goalPlaceholder}
              keyboardType="numeric"
            />
            <Button label={t.profile.saved} onPress={persist} tone="quiet" />
          </View>
        </Card>

        <Card label={t.profile.languageTitle}>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {LOCALES.map(({ id, label }) => {
              const selected = locale === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => void setLocale(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    backgroundColor: selected ? colors.accent : "transparent",
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.rule,
                    borderRadius: radius.pill,
                    paddingVertical: space.md,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    style={[
                      type.bodyStrong,
                      { color: selected ? colors.onAccent : colors.ink },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
            {t.profile.languageNote}
          </Text>
        </Card>

        <StubNote>{t.profile.localNote}</StubNote>

        <Card label={t.profile.dangerTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.profile.dangerBody}</Text>
          <Button
            label={t.profile.dangerCta}
            tone="danger"
            onPress={confirmReset}
            style={{ marginTop: space.md }}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
