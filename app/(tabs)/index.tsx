import { useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TaskRow } from "@/components/TaskRow";
import { fill, useI18n } from "@/i18n";
import { today, useStore } from "@/store";
import { detectCategory, getSupport } from "@/support";
import { useTheme } from "@/theme";

/**
 * One tip, chosen by the calendar day, from the support library of one of the
 * user's own habits. It changes every day and sits above the list, so the
 * guidance is the first thing on screen — never hidden behind a tap.
 */
function TipOfTheDay() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state } = useStore();

  const habits = state.habits.filter((h) => !h.archived);
  if (habits.length === 0) return null;

  const dayIndex = Math.floor(Date.parse(today()) / 86_400_000);
  const habit = habits[dayIndex % habits.length];
  const support = getSupport(detectCategory(habit.title), locale);
  const tip = support.tips[dayIndex % support.tips.length];

  let mealLine: string | null = null;
  if (support.meals && support.meals.length > 0) {
    const meal = support.meals[dayIndex % support.meals.length];
    const idea = meal.ideas[dayIndex % meal.ideas.length];
    mealLine = fill(t.today.mealIdea, { slot: meal.slot, idea });
  }

  return (
    <Pressable
      onPress={() => router.push(`/habit/${habit.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: colors.accentWash,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={[type.label, { color: colors.accent }]}>
        {fill(t.today.tipTitle, { label: support.label })}
      </Text>
      <Text style={[type.body, { color: colors.ink }]}>{tip}</Text>
      {mealLine ? (
        <Text style={[type.small, { color: colors.inkSoft }]}>{mealLine}</Text>
      ) : null}
      <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
        {t.today.tipMore}
      </Text>
    </Pressable>
  );
}

export default function TodayScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, isDone, toggleCompletion, archiveHabit, readyForAnotherHabit } = useStore();

  const habits = state.habits.filter((h) => !h.archived);
  const doneCount = habits.filter((h) => isDone(h.id)).length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.today.greetingMorning : hour < 17 ? t.today.greetingNoon : t.today.greetingEvening;
  const title = state.profile.name
    ? fill(t.today.greetingNamed, { greeting, name: state.profile.name })
    : greeting;

  function confirmRemove(id: string, habitTitle: string) {
    Alert.alert(
      t.habit.remove,
      fill(t.habit.removeConfirm, { title: habitTitle }),
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.habit.removeYes, style: "destructive", onPress: () => archiveHabit(id) },
      ],
    );
  }

  if (habits.length === 0) {
    return (
      <Screen title={title}>
        <Card label={t.today.emptyTitle}>
          <Text style={[type.body, { color: colors.inkSoft }]}>{t.today.emptyBody}</Text>
          <Button
            label={t.today.emptyCta}
            onPress={() => router.push("/habit/new")}
            style={{ marginTop: space.md }}
          />
        </Card>
      </Screen>
    );
  }

  const ready = readyForAnotherHabit();

  return (
    <Screen title={title}>
      <TipOfTheDay />

      <Card label={t.today.listLabel}>
        <View>
          {habits.map((habit) => (
            <Pressable
              key={habit.id}
              onLongPress={() => confirmRemove(habit.id, habit.title)}
              delayLongPress={500}
            >
              <TaskRow
                label={habit.slot ? `${habit.title} · ${t.slots[habit.slot]}` : habit.title}
                hint={habit.anchor}
                done={isDone(habit.id)}
                onToggle={() => toggleCompletion(habit.id)}
                onOpen={() => router.push(`/habit/${habit.id}`)}
                actionLabel={t.today.tipsBtn}
              />
            </Pressable>
          ))}
        </View>
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
          {doneCount === habits.length
            ? t.today.allDone
            : fill(t.today.doneCount, { done: doneCount, total: habits.length })}
        </Text>
        <Text style={[type.small, { color: colors.accent, marginTop: space.xs }]}>
          {t.today.openHint}
        </Text>
      </Card>

      <View
        style={{
          backgroundColor: ready ? colors.accentWash : colors.surfaceAlt,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.sm,
        }}
      >
        <Text style={[type.bodyStrong, { color: colors.ink }]}>
          {ready ? t.today.readyTitle : t.today.holdTitle}
        </Text>
        <Text style={[type.small, { color: colors.inkSoft }]}>
          {ready ? t.today.readyBody : t.today.holdBody}
        </Text>
        <Button
          label={t.today.addCta}
          tone={ready ? "primary" : "quiet"}
          onPress={() => router.push("/habit/new")}
          style={{ marginTop: space.xs }}
        />
      </View>
    </Screen>
  );
}
