import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { fill, useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/** Eight weeks of sample weights, in kg. Replaced by real readings in phase 2. */
const SAMPLE_WEIGHTS = [92.4, 92.0, 91.6, 91.7, 91.0, 90.4, 90.5, 89.8];

function TrendChart({ values }: { values: number[] }) {
  const { colors, space, radius } = useTheme();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.sm,
        height: 120,
        marginTop: space.sm,
      }}
      accessibilityRole="image"
      accessibilityLabel={`${values.length} weekly readings, from ${max} down to ${min} kilograms`}
    >
      {values.map((value, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 24 + ((value - min) / range) * 84,
            borderRadius: radius.sm,
            backgroundColor:
              index === values.length - 1 ? colors.accent : colors.accentWash,
          }}
        />
      ))}
    </View>
  );
}

export default function ProgressScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const latest = SAMPLE_WEIGHTS[SAMPLE_WEIGHTS.length - 1];

  return (
    <Screen title={t.progress.heading} subtitle={t.progress.subheading}>
      <Card label={t.progress.weighInTitle} tone="accent">
        <Text style={[type.display, { color: colors.ink }]}>
          {latest.toFixed(1)} kg
        </Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            backgroundColor: colors.accent,
            borderRadius: radius.pill,
            paddingVertical: space.sm,
            paddingHorizontal: space.lg,
            marginTop: space.sm,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={[type.bodyStrong, { color: colors.onAccent }]}>
            {t.progress.weighInCta}
          </Text>
        </Pressable>
      </Card>

      <Card label={t.progress.trendTitle}>
        <TrendChart values={SAMPLE_WEIGHTS} />
        <Text style={[type.small, { color: colors.inkFaint }]}>
          {t.progress.trendNote}
        </Text>
      </Card>

      <Card label={t.progress.streakTitle}>
        <Text style={[type.title, { color: colors.ink }]}>
          {fill(t.progress.streakValue, { days: 5 })}
        </Text>
      </Card>

      <StubNote>{t.progress.stubNote}</StubNote>
    </Screen>
  );
}
