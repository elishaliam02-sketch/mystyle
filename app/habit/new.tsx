import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { SupportPreview } from "@/components/SupportPreview";
import { TextField } from "@/components/TextField";
import { useI18n } from "@/i18n";
import { useStore, type Habit } from "@/store";
import { useTheme } from "@/theme";

const SLOTS: (Habit["slot"] | undefined)[] = ["morning", "noon", "evening", undefined];

export default function NewHabit() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addHabit } = useStore();

  const [title, setTitle] = useState("");
  const [slot, setSlot] = useState<Habit["slot"]>();

  function save() {
    const id = addHabit(title, slot);
    // Swap this modal for the habit's tips page in one navigation; back from
    // there returns to Today, not to this form.
    if (id) {
      router.replace(`/habit/${id}`);
    } else {
      router.back();
    }
  }

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
        <View style={{ gap: space.xs }}>
          <Text style={[type.hero, { color: colors.ink }]}>{t.habit.newTitle}</Text>
          <Text style={[type.body, { color: colors.inkSoft }]}>{t.habit.newBody}</Text>
        </View>

        <TextField
          value={title}
          onChangeText={setTitle}
          placeholder={t.habit.placeholder}
          multiline
          autoFocus
        />

        <SupportPreview title={title} />

        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: colors.inkFaint }]}>{t.habit.when}</Text>
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

        <View style={{ flex: 1 }} />

        <View style={{ gap: space.sm }}>
          {/* The same line onboarding shows: a greyed-out Save with no reason
              beside it reads as broken rather than as waiting on the field. */}
          {!title.trim() ? (
            <Text style={[type.small, { color: colors.signal, textAlign: "center" }]}>
              {t.onboarding.step3NeedOne}
            </Text>
          ) : null}
          <Button icon="checkmark" label={t.habit.save} onPress={save} disabled={!title.trim()} />
          <Button label={t.habit.cancel} tone="quiet" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
