import { useState } from "react";
import { Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { TaskRow } from "@/components/TaskRow";
import { fill, useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type TaskId = "breakfast" | "walk" | "sleep";

export default function TodayScreen() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const [done, setDone] = useState<Record<TaskId, boolean>>({
    breakfast: false,
    walk: false,
    sleep: false,
  });

  const toggle = (id: TaskId) =>
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));

  const labels: Record<TaskId, string> = {
    breakfast: fill(t.today.tasks.breakfast, { time: "09:00" }),
    walk: fill(t.today.tasks.walk, { minutes: 15 }),
    sleep: fill(t.today.tasks.sleep, { time: "23:30" }),
  };

  const ids: TaskId[] = ["breakfast", "walk", "sleep"];
  const doneCount = ids.filter((id) => done[id]).length;
  const greeting =
    new Date().getHours() < 15
      ? t.today.greetingMorning
      : t.today.greetingEvening;

  return (
    <Screen title={greeting} subtitle={t.today.subheading}>
      <Card label={t.today.heading}>
        <View style={{ gap: 0 }}>
          {ids.map((id) => (
            <TaskRow
              key={id}
              label={labels[id]}
              done={done[id]}
              onToggle={() => toggle(id)}
            />
          ))}
        </View>
        <Text
          style={[
            type.small,
            { color: colors.inkFaint, marginTop: space.xs },
          ]}
        >
          {fill(t.today.doneCount, { done: doneCount, total: ids.length })}
        </Text>
      </Card>

      <StubNote>{t.today.stubNote}</StubNote>
    </Screen>
  );
}
