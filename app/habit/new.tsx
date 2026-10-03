import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { DaysPicker } from "@/components/DaysPicker";
import { ProGate } from "@/components/ProGate";
import { SupportPreview } from "@/components/SupportPreview";
import { TaskScanPanel } from "@/components/TaskScan";
import { TextField } from "@/components/TextField";
import { useI18n } from "@/i18n";
import { cleanTitle, useStore, type Habit } from "@/store";
import { useTheme } from "@/theme";
import { leave } from "@/ui/nav";

const SLOTS: (Habit["slot"] | undefined)[] = ["morning", "noon", "evening", undefined];

/** The part of the day each starter idea naturally belongs to, so picking one
 * also answers "when?" — a glass of water on waking is a morning habit. */
const IDEA_SLOT: Record<string, Habit["slot"]> = {
  water: "morning",
  walk: "evening",
  breakfast: "morning",
  stairs: undefined,
  screens: "evening",
  veg: "noon",
};

export default function NewHabit() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addHabit, allowance } = useStore();

  const [title, setTitle] = useState("");
  const [slot, setSlot] = useState<Habit["slot"]>();
  const [days, setDays] = useState<number[] | undefined>();

  // The same starters onboarding offers, minus the ones already on the list —
  // an empty box is the hardest place to start from.
  const have = new Set(state.habits.filter((h) => !h.archived).map((h) => cleanTitle(h.title).toLowerCase()));
  const ideas = Object.entries(t.onboarding.ideas).filter(([, idea]) => !have.has(idea.toLowerCase()));
  // Two of the same habit would split one streak into two half-streaks.
  const duplicate = have.has(cleanTitle(title).toLowerCase());

  // This screen is reachable by its own URL, so the limit has to be answered
  // here too — otherwise someone fills in the whole form and then finds out.
  const canSave = allowance("habits").ok;

  function save() {
    const id = addHabit(title, slot, days);
    // Swap this modal for the habit's tips page in one navigation; back from
    // there returns to Today, not to this form.
    if (id) {
      router.replace(`/habit/${id}`);
    } else {
      leave(router);
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
          maxLength={80}
        />

        {!title.trim() && ideas.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Text style={[type.label, { color: colors.inkFaint }]}>{t.onboarding.step3Ideas}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {ideas.map(([key, idea]) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setTitle(idea);
                    setSlot(IDEA_SLOT[key]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={idea}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.rule,
                    borderRadius: radius.md,
                    paddingVertical: space.sm + 2,
                    paddingHorizontal: space.md,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={[type.small, { color: colors.ink }]}>{idea}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* read back before it is even saved: how hard this task looks and
            what ticking it will pay */}
        <TaskScanPanel title={title} />

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

        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: colors.inkFaint }]}>{t.habit.daysTitle}</Text>
          <DaysPicker value={days} onChange={setDays} />
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ gap: space.sm }}>
          {canSave ? (
            <>
              {/* The same line onboarding shows: a greyed-out Save with no reason
                  beside it reads as broken rather than as waiting on the field. */}
              {!title.trim() ? (
                <Text style={[type.small, { color: colors.inkFaint, textAlign: "center" }]}>
                  {t.onboarding.step3NeedOne}
                </Text>
              ) : duplicate ? (
                <Text style={[type.small, { color: colors.orangeInk, textAlign: "center" }]}>
                  {t.habit.duplicate}
                </Text>
              ) : null}
              <Button
                icon="checkmark"
                label={t.habit.save}
                onPress={save}
                disabled={!title.trim() || duplicate}
              />
            </>
          ) : (
            <ProGate feature="habits" />
          )}
          {/* Never gated: leaving is how someone gets back to the habits they
              already have. */}
          <Button label={t.habit.cancel} tone="quiet" onPress={() => leave(router)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
