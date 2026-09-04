import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TaskRow } from "@/components/TaskRow";
import { askDailyTip } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge, AiNote } from "@/components/AiNote";
import { Ring } from "@/components/Ring";
import { dailyTarget } from "@/kitchen";
import { fill, formatDate, useI18n } from "@/i18n";
import { today, useStore } from "@/store";
import { detectCategory, getSupport } from "@/support";
import { useTheme } from "@/theme";

/**
 * The home screen's nudge. Claude writes it from the user's actual habits and
 * their own recent recap notes; the written library is what shows while that
 * lands, or if it cannot. Either way the guidance is on screen with no taps,
 * and AiNote says which of the two the user is looking at.
 */
function TipOfTheDay() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, isDone } = useStore();
  const [offset, setOffset] = useState(0);

  const habits = state.habits.filter((h) => !h.archived);
  const dayKey = today();

  const lines = habits.map((h) => ({
    title: h.title,
    slot: h.slot,
    doneToday: isDone(h.id),
  }));
  const recentNotes = state.checkIns
    .filter((c) => c.note)
    .slice(-5)
    .reverse()
    .map((c) => c.note);

  const key = habits.length
    ? `${dayKey}|${lines.map((l) => `${l.title}:${l.doneToday}`).join(",")}|${recentNotes.join("|")}`
    : null;

  const { value: aiTip, state: aiState, retry } = useAi(key, (signal) =>
    askDailyTip(lines, recentNotes, locale, dayKey, signal),
  );

  if (habits.length === 0) return null;

  const dayIndex = Math.floor(Date.parse(dayKey) / 86_400_000);
  const habit = habits[dayIndex % habits.length];
  const support = getSupport(detectCategory(habit.title), locale);
  const fallbackTip = support.tips[(dayIndex + offset) % support.tips.length];

  let mealLine: string | null = null;
  if (!aiTip && support.meals && support.meals.length > 0) {
    const meal = support.meals[(dayIndex + offset) % support.meals.length];
    const idea = meal.ideas[(dayIndex + offset) % meal.ideas.length];
    mealLine = fill(t.today.mealIdea, { slot: meal.slot, idea });
  }

  return (
    <View
      style={{
        backgroundColor: colors.accentWash,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      {aiTip ? (
        <>
          <AiBadge />
          <Text style={[type.bodyStrong, { color: colors.ink }]}>{aiTip.headline}</Text>
          <Text style={[type.body, { color: colors.ink }]}>{aiTip.body}</Text>
          {aiTip.action ? (
            <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
              → {aiTip.action}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={[type.label, { color: colors.accent }]}>
            {fill(t.today.tipTitle, { label: support.label })}
          </Text>
          <Text style={[type.body, { color: colors.ink }]}>{fallbackTip}</Text>
          {mealLine ? (
            <Text style={[type.small, { color: colors.inkSoft }]}>{mealLine}</Text>
          ) : null}
        </>
      )}

      <AiNote state={aiState} onRetry={retry} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: space.xs,
        }}
      >
        {!aiTip ? (
          <PillButton tone="soft" label={t.today.tipAnother} onPress={() => setOffset((o) => o + 1)} />
        ) : (
          <View />
        )}

        <Pressable
          onPress={() => router.push(`/habit/${habit.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: space.xs })}
        >
          <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
            {t.today.tipMore}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The daily hub — one card that ties the app's pillars together, so opening
 * APEX shows the whole day at a glance (streak, habits, nutrition, water,
 * workout) instead of only the habit list. Each tile is a shortcut into its
 * tab. Everything is read straight from the stored state; no extra work.
 */
function TodayHub() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, isDone, streak, todayIntake, todayWater } = useStore();

  const habits = state.habits.filter((h) => !h.archived);
  const doneCount = habits.filter((h) => isDone(h.id)).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, streak(h.id)), 0);

  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const target = dailyTarget(weightKg, state.nutritionGoal ?? "maintain");
  const eaten = todayIntake().kcal;
  const water = todayWater();
  const workoutDone = (state.training?.log[today()]?.length ?? 0) > 0;

  type Tile = {
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    label: string;
    onPress?: () => void;
  };
  const tiles: Tile[] = [
    { icon: "checkbox", value: `${doneCount}/${habits.length}`, label: t.today.hubHabits },
    {
      icon: "restaurant",
      value: `${eaten}/${target.kcal}`,
      label: t.today.hubKcal,
      onPress: () => router.push("/kitchen"),
    },
    {
      icon: "water",
      value: `${water}`,
      label: t.today.hubWater,
      onPress: () => router.push("/kitchen"),
    },
    {
      icon: workoutDone ? "checkmark-circle" : "barbell",
      value: workoutDone ? t.today.hubDone : t.today.hubStart,
      label: t.today.hubWorkout,
      onPress: () => router.push("/workout"),
    },
  ];

  return (
    <Card label={t.today.hubTitle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: space.sm }}>
        <Ionicons name="flame" size={18} color={colors.accent} />
        <Text style={[type.bodyStrong, { color: colors.ink }]}>
          {bestStreak > 0 ? fill(t.today.hubStreak, { days: bestStreak }) : t.today.hubStreakNone}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            onPress={tile.onPress}
            disabled={!tile.onPress}
            accessibilityRole={tile.onPress ? "button" : undefined}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 3,
              paddingVertical: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Ionicons name={tile.icon} size={20} color={colors.accent} />
            <Text style={[type.smallStrong, { color: colors.ink }]} numberOfLines={1}>
              {tile.value}
            </Text>
            <Text style={[type.label, { color: colors.inkFaint }]} numberOfLines={1}>
              {tile.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

export default function TodayScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, isDone, toggleCompletion, archiveHabit, readyForAnotherHabit } = useStore();

  const habits = state.habits.filter((h) => !h.archived);
  const doneCount = habits.filter((h) => isDone(h.id)).length;

  // A daily app should say which day it is; without it every screen looks the
  // same and yesterday's board is indistinguishable from today's.
  const dateLabel = formatDate(new Date(), t);

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
      <Screen eyebrow={dateLabel} title={title}>
        <Card label={t.today.emptyTitle}>
          <Text style={[type.body, { color: colors.inkSoft }]}>{t.today.emptyBody}</Text>
          <Button
            icon="add"
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
    <Screen
      eyebrow={dateLabel}
      title={title}
      subtitle={
        doneCount === habits.length
          ? t.today.allDone
          : fill(t.today.doneCount, { done: doneCount, total: habits.length })
      }
      aside={<Ring done={doneCount} total={habits.length} />}
    >
      <TodayHub />

      <TipOfTheDay />

      <Card label={t.today.listLabel}>
        <View>
          {habits.map((habit, index) => (
            <Pressable
              key={habit.id}
              onLongPress={() => confirmRemove(habit.id, habit.title)}
              delayLongPress={500}
            >
              <TaskRow
                first={index === 0}
                label={habit.slot ? `${habit.title} · ${t.slots[habit.slot]}` : habit.title}
                hint={habit.anchor}
                done={isDone(habit.id)}
                onToggle={() => toggleCompletion(habit.id)}
                onOpen={() => router.push(`/habit/${habit.id}`)}
              />
            </Pressable>
          ))}
        </View>
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.today.openHint}</Text>
      </Card>

      <View
        style={{
          backgroundColor: ready ? colors.accentWash : colors.amberWash,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Ionicons
            name={ready ? "sparkles" : "hourglass-outline"}
            size={16}
            color={ready ? colors.accent : colors.amber}
          />
          <Text style={[type.label, { color: ready ? colors.accent : colors.amber }]}>
            {ready ? t.today.readyTitle : t.today.holdTitle}
          </Text>
        </View>
        <Text style={[type.small, { color: colors.inkSoft }]}>
          {ready ? t.today.readyBody : t.today.holdBody}
        </Text>
        <Button
          icon="add"
          label={t.today.addCta}
          tone={ready ? "primary" : "quiet"}
          onPress={() => router.push("/habit/new")}
          style={{ marginTop: space.xs }}
        />
      </View>
    </Screen>
  );
}
