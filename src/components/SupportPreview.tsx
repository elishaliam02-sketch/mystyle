import { Text, View } from "react-native";
import { fill, useI18n } from "@/i18n";
import { detectCategory, getSupport } from "@/support";
import { useTheme } from "@/theme";

/**
 * Live tips under the habit input. As the user types, the habit is recognised
 * and the first two real tips — plus a meal idea for food habits — appear
 * immediately. Showing the actual content beats announcing that content exists.
 */
export function SupportPreview({ title }: { title: string }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();

  if (title.trim().length < 3) return null;

  const support = getSupport(detectCategory(title), locale);
  const tips = support.tips.slice(0, 2);
  const meal = support.meals?.[0];

  return (
    <View
      style={{
        backgroundColor: colors.accentWash,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      <Text style={[type.label, { color: colors.accent }]}>
        {fill(t.habit.previewTitle, { label: support.label })}
      </Text>

      {tips.map((tip) => (
        <View key={tip} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.accent,
              marginTop: 8,
            }}
          />
          <Text style={[type.small, { color: colors.ink, flex: 1, lineHeight: 20 }]}>{tip}</Text>
        </View>
      ))}

      {meal ? (
        <Text style={[type.small, { color: colors.inkSoft }]}>
          {fill(t.habit.previewMealIdea, { slot: meal.slot, idea: meal.ideas[0] })}
        </Text>
      ) : null}

      <Text style={[type.small, { color: colors.accent }]}>{t.habit.previewMore}</Text>
    </View>
  );
}
