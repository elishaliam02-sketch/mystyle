import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { computeAchievements, unlockedCount, type Achievement } from "@/achievements";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

export default function AchievementsScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state } = useStore();
  const router = useRouter();

  const list = useMemo(() => computeAchievements(state), [state]);
  const done = unlockedCount(list);

  return (
    <Screen
      eyebrow={fill(t.achievements.unlocked, { done, total: list.length })}
      title={t.achievements.heading}
      subtitle={t.achievements.body}
      aside={
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: colors.bandRule,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={20} color={colors.bandInk} />
        </Pressable>
      }
    >
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, justifyContent: "space-between" }}>
          {list.map((a) => (
            <Badge key={a.id} a={a} />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function Badge({ a }: { a: Achievement }) {
  const { t } = useI18n();
  const { colors, radius, type } = useTheme();
  const meta = t.achievements.badges[a.id as keyof typeof t.achievements.badges];

  // Tiers ride the palette: bronze is the blue of load, silver the charcoal
  // ink, gold the orange of effort — and each chip carries the ink that reads
  // on it, which for orange is charcoal rather than white.
  const tierColor =
    a.tier === "gold" ? colors.orange : a.tier === "silver" ? colors.inkSoft : colors.accent;
  const chip = a.unlocked ? tierColor : colors.surfaceAlt;
  const iconColor = !a.unlocked
    ? colors.inkFaint
    : a.tier === "gold"
      ? colors.onOrange
      : colors.onAccent;
  const pct = Math.round((a.progress / a.target) * 100);

  return (
    <View style={{ width: "30%", minWidth: 92, alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius.pill,
          backgroundColor: chip,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: a.unlocked ? 0 : 1,
          borderColor: colors.rule,
          opacity: a.unlocked ? 1 : 0.9,
        }}
      >
        <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={28} color={iconColor} />
      </View>

      <Text
        style={[type.smallStrong, { color: a.unlocked ? colors.ink : colors.inkSoft, textAlign: "center" }]}
        numberOfLines={2}
      >
        {meta.title}
      </Text>
      <Text style={[type.label, { color: colors.inkFaint, textAlign: "center" }]} numberOfLines={2}>
        {meta.desc}
      </Text>

      {a.unlocked ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: colors.accentWash,
            borderRadius: radius.pill,
            paddingVertical: 2,
            paddingHorizontal: 8,
          }}
        >
          <Ionicons name="checkmark" size={12} color={colors.accent} />
          <Text style={[type.label, { color: colors.accent }]}>{pct}%</Text>
        </View>
      ) : (
        <View style={{ width: "100%", gap: 2, alignItems: "center" }}>
          <View
            style={{
              width: "100%",
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.surfaceAlt,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <Text style={[type.label, { color: colors.inkFaint }]}>
            {fill(t.achievements.progress, { progress: a.progress, target: a.target })}
          </Text>
        </View>
      )}
    </View>
  );
}
