import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { useStore, type Habit } from "@/store";
import { detectCategory, getSupport } from "@/support";
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

  // Recognise the habit as it is typed, so the payoff is visible before saving.
  const support = title.trim().length >= 3
    ? getSupport(detectCategory(title), locale)
    : null;

  function save() {
    addHabit(title, slot);
    router.back();
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
          <Text style={[type.display, { color: colors.ink }]}>{t.habit.newTitle}</Text>
          <Text style={[type.body, { color: colors.inkSoft }]}>{t.habit.newBody}</Text>
        </View>

        <TextField
          value={title}
          onChangeText={setTitle}
          placeholder={t.habit.placeholder}
          multiline
          autoFocus
        />

        {support ? (
          <View
            style={{
              backgroundColor: colors.accentWash,
              borderRadius: radius.lg,
              padding: space.lg,
              gap: space.xs,
            }}
          >
            <Text style={[type.label, { color: colors.accent }]}>{t.habit.previewTitle}</Text>
            <Text style={[type.small, { color: colors.ink }]}>
              {fill(t.habit.previewBody, {
                label: support.label,
                meals: support.meals ? t.habit.previewMeals : "",
              })}
            </Text>
          </View>
        ) : null}

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
          <Button label={t.habit.save} onPress={save} disabled={!title.trim()} />
          <Button label={t.habit.cancel} tone="quiet" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
