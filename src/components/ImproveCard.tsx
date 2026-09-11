import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { Card } from "@/components/Card";
import { fill, useI18n } from "@/i18n";
import type { Dict } from "@/i18n/dict";
import { improvements, type ImproveArea, type Reading } from "@/insight/improve";
import { today, useStore } from "@/store";
import { useTheme } from "@/theme";

/** The word, the sentence and the fix for each area, from the string table. */
function copy(t: Dict, area: ImproveArea) {
  const map = {
    habits: [t.improve.habits, t.improve.habitsLine, t.improve.habitsFix, "checkbox"],
    workout: [t.improve.workout, t.improve.workoutLine, t.improve.workoutFix, "barbell"],
    water: [t.improve.water, t.improve.waterLine, t.improve.waterFix, "water"],
    steps: [t.improve.steps, t.improve.stepsLine, t.improve.stepsFix, "walk"],
    food: [t.improve.food, t.improve.foodLine, t.improve.foodFix, "restaurant"],
    weighIn: [t.improve.weighIn, t.improve.weighInLine, t.improve.weighInFix, "scale"],
    recap: [t.improve.recap, t.improve.recapLine, t.improve.recapFix, "chatbubble-ellipses"],
  } as const;
  return map[area];
}

/**
 * The reading above the graphs: what to fix next, and what is already working.
 *
 * Charts say what happened. This says what to do about it — which is the gap
 * most tracking apps never close, and the reason people stop opening the
 * progress tab. Deliberately short: at most three things, each with the number
 * it is based on and one concrete move, and always the thing going well too,
 * because a list of six failings is a reason to close the app.
 */
export function ImproveCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state } = useStore();

  const day = today();
  const reading = useMemo(() => improvements(state, day), [state, day]);

  if (reading.all.length === 0) {
    return (
      <Card label={t.improve.title}>
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.improve.none}</Text>
      </Card>
    );
  }

  return (
    <Card label={t.improve.title}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.improve.body}</Text>

      {reading.worst.length === 0 ? (
        <Text style={[type.body, { color: colors.ink, marginTop: space.md }]}>
          {t.improve.allGood}
        </Text>
      ) : (
        <View style={{ gap: space.md, marginTop: space.md }}>
          {reading.worst.map((item) => (
            <Row key={item.area} item={item} />
          ))}
        </View>
      )}

      {reading.best ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            backgroundColor: colors.limeWash,
            borderRadius: radius.md,
            padding: space.md,
            marginTop: space.lg,
          }}
        >
          <Ionicons name="trending-up" size={16} color={colors.limeInk} />
          <Text style={[type.small, { color: colors.ink, flex: 1 }]}>
            <Text style={[type.smallStrong, { color: colors.limeInk }]}>
              {t.improve.bestTitle}:{" "}
            </Text>
            {copy(t, reading.best.area)[0]} ·{" "}
            {fill(t.improve.ofTarget, { percent: Math.round(reading.best.fraction * 100) })}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function Row({ item }: { item: Reading }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [title, line, fixText, icon] = copy(t, item.area);
  const percent = Math.round(item.fraction * 100);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.orangeInk} />
        <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{title}</Text>
        <Text style={[type.smallStrong, { color: colors.orangeInk }]}>
          {fill(t.improve.ofTarget, { percent })}
        </Text>
      </View>

      {/* the bar is the argument: a number in a sentence is easy to dismiss */}
      <View
        style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}
      >
        <View
          style={{ width: `${Math.max(3, percent)}%`, height: "100%", backgroundColor: colors.orange }}
        />
      </View>

      <Text style={[type.small, { color: colors.inkSoft }]}>
        {fill(line, { actual: item.actual.toLocaleString(), target: item.target.toLocaleString() })}
      </Text>
      <Text style={[type.small, { color: colors.ink, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: space.sm }]}>
        {fixText}
      </Text>
    </View>
  );
}
