import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { difficultyColor, difficultyLabel, difficultyWash } from "@/components/TaskScan";
import { fill, useI18n } from "@/i18n";
import type { ChallengeKind } from "@/challenge";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

/** A glyph per kind, so the card reads before the sentence does. */
const ICON: Record<ChallengeKind, keyof typeof Ionicons.glyphMap> = {
  move: "walk",
  strength: "barbell",
  food: "restaurant",
  water: "water",
  mind: "leaf",
  sleep: "moon",
};

/**
 * Today's challenge — the one thing on the board the person did not write.
 *
 * Everything else on Today is theirs and repeats; this changes daily and is
 * over by bedtime, which is what keeps a routine app from becoming the same
 * five ticks forever. It is also where people find out they can do more than
 * they wrote down for themselves.
 *
 * When no level has been chosen (someone who skipped it in the intro, or an
 * install from before the choice existed), the card offers the choice instead
 * of nagging: a dare nobody asked for is just noise.
 */
export function ChallengeCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { todayChallenge, isChallengeDone, toggleChallenge, challengeLevel } = useStore();

  const challenge = todayChallenge();

  if (!challenge) {
    if (challengeLevel() !== null) return null;
    return (
      <Pressable onPress={() => router.push("/profile")} accessibilityRole="button">
        <Card label={t.challenge.cardLabel}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.challenge.chooseCta}</Text>
        </Card>
      </Pressable>
    );
  }

  const done = isChallengeDone();
  const tone = difficultyColor(colors, challenge.level);
  const text = (t.challenge.items as Record<string, string>)[challenge.id] ?? "";

  return (
    <Card label={t.challenge.cardLabel}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: difficultyWash(colors, challenge.level),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={ICON[challenge.kind]} size={22} color={tone} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              type.bodyStrong,
              {
                color: done ? colors.inkFaint : colors.ink,
                textDecorationLine: done ? "line-through" : "none",
              },
            ]}
          >
            {text}
          </Text>
          <Text style={[type.label, { color: tone }]}>
            {difficultyLabel(t, challenge.level)} · {fill(t.challenge.worth, { points: challenge.points })}
          </Text>
        </View>

        <Pressable
          onPress={toggleChallenge}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={text}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: done ? tone : colors.ruleStrong,
            backgroundColor: done ? tone : "transparent",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          {done ? <Ionicons name="checkmark" size={20} color={colors.onAccent} /> : null}
        </Pressable>
      </View>

      {done ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.challenge.tomorrow}
        </Text>
      ) : null}
    </Card>
  );
}
