import { Pressable, Text, View } from "react-native";
import { fill, useI18n } from "@/i18n";
import { ALL_DAYS, normalizeDays } from "@/habits/schedule";
import { useTheme } from "@/theme";

/**
 * The days a habit is due: seven day buttons, all lit for "every day". A tap
 * takes a day off or puts it back; the last day cannot be taken off, because
 * a habit due on no day at all is not a habit.
 */
export function DaysPicker({ value, onChange }: { value?: number[]; onChange: (days: number[] | undefined) => void }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const days = normalizeDays(value);
  const on = (d: number) => !days || days.includes(d);

  function toggle(d: number) {
    const current: number[] = days ?? [...ALL_DAYS];
    const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d];
    if (next.length === 0) return;
    onChange(normalizeDays(next));
  }

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {ALL_DAYS.map((d) => (
          <Pressable
            key={d}
            onPress={() => toggle(d)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on(d) }}
            accessibilityLabel={t.calendar.weekdays[d]}
            style={({ pressed }) => ({
              flex: 1,
              height: 42,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on(d) ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: on(d) ? colors.accent : colors.rule,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={[type.smallStrong, { color: on(d) ? colors.onAccent : colors.inkSoft }]}>
              {t.calendar.weekdaysShort[d]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
        <Text style={[type.small, { color: colors.inkFaint, flexShrink: 1 }]}>
          {days ? fill(t.habit.daysSome, { n: days.length }) : t.habit.daysEvery}
        </Text>
        {days ? (
          <Pressable onPress={() => onChange(undefined)} accessibilityRole="button" hitSlop={8}>
            <Text style={[type.smallStrong, { color: colors.accent }]}>{t.habit.daysReset}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
