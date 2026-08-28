import { useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TaskRow } from "@/components/TaskRow";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

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
      <Card label={t.today.listLabel}>
        <View>
          {habits.map((habit) => (
            <Pressable
              key={habit.id}
              onLongPress={() => confirmRemove(habit.id, habit.title)}
              delayLongPress={500}
            >
              <TaskRow
                label={
                  habit.slot ? `${habit.title} · ${t.slots[habit.slot]}` : habit.title
                }
                done={isDone(habit.id)}
                onToggle={() => toggleCompletion(habit.id)}
              />
            </Pressable>
          ))}
        </View>
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
          {doneCount === habits.length
            ? t.today.allDone
            : fill(t.today.doneCount, { done: doneCount, total: habits.length })}
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
