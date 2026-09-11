import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { DifficultyBadge, difficultyColor, difficultyLabel } from "@/components/TaskScan";
import { fill, useI18n } from "@/i18n";
import { computeRewards, earnings, scoredTasks, STREAK_DAYS, todayOnOffer } from "@/rewards";
import { shareSubject, shareText } from "@/rewards/share";
import { deliverShare } from "@/rewards/deliverShare";
import { Button } from "@/components/Button";
import { today, useStore } from "@/store";
import type { Difficulty } from "@/tasks/difficulty";
import { useTheme } from "@/theme";

/**
 * The reward board: what the tasks this person set themselves have added up to.
 *
 * Everything here is computed from the ticks, so there is nothing to keep in
 * step and nothing that can disagree with the day's list. The point of the
 * screen is the second card down — the split by difficulty — because that is
 * the one that answers "am I actually asking anything of myself?".
 */
export default function RewardsScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, streak } = useStore();
  const router = useRouter();

  const day = today();
  const reward = useMemo(() => computeRewards(state, day), [state, day]);
  const offer = useMemo(() => todayOnOffer(state, day), [state, day]);
  const tasks = useMemo(() => scoredTasks(state), [state]);
  const earned = useMemo(() => earnings(state), [state]);

  const levels: Difficulty[] = ["easy", "moderate", "hard"];
  const [shareNote, setShareNote] = useState<string | null>(null);

  /**
   * Sends the score out. The message is built from the same numbers on screen,
   * and says what was *done* as well as what it scored — a bare number means
   * nothing to whoever receives it.
   */
  async function share() {
    const habits = state.habits.filter((h) => !h.archived);
    const best = habits.reduce((m, h) => Math.max(m, streak(h.id)), 0);
    const text = shareText(t, {
      reward,
      streakDays: best,
      challenges: earned.challenges,
      name: state.profile.name,
    });
    const outcome = await deliverShare(text, shareSubject(t, reward.level));
    setShareNote(
      outcome === "copied" ? t.share.copied : outcome === "failed" ? t.share.failed : null,
    );
  }
  const pct = Math.round((reward.intoLevel / reward.levelSpan) * 100);

  return (
    <Screen
      eyebrow={fill(t.rewards.level, { level: reward.level })}
      title={t.rewards.heading}
      subtitle={t.rewards.body}
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
      {/* the level, and how far into it this person is */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <LevelRing level={reward.level} pct={pct} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.title, { color: colors.ink }]}>
              {fill(t.rewards.level, { level: reward.level })}
            </Text>
            <Text style={[type.small, { color: colors.inkSoft }]}>
              {fill(t.rewards.toNext, { left: reward.toNext, level: reward.level + 1 })}
            </Text>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.surfaceAlt,
                overflow: "hidden",
                marginTop: 4,
              }}
            >
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.accent }} />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", marginTop: space.lg }}>
          {(
            [
              [reward.todayPoints, t.rewards.todayTitle, colors.limeInk],
              [reward.weekPoints, t.rewards.weekTitle, colors.accent],
              [reward.points, t.rewards.lifetimeTitle, colors.azureInk],
            ] as const
          ).map(([value, label, tone]) => (
            <View key={label} style={{ flex: 1, alignItems: "center" }}>
              <Text style={[type.figure, { color: tone, fontSize: 30, lineHeight: 36 }]}>{value}</Text>
              <Text style={[type.label, { color: colors.inkFaint }]}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={[type.small, { color: colors.inkSoft, marginTop: space.sm }]}>
          {fill(t.rewards.todayLine, { earned: offer.earned, available: offer.available })}
        </Text>

        <Button
          icon="share-social-outline"
          label={t.share.cta}
          tone="quiet"
          onPress={() => void share()}
          style={{ marginTop: space.md }}
        />
        {shareNote ? (
          <Text style={[type.small, { color: colors.inkSoft, marginTop: space.xs }]}>
            {shareNote}
          </Text>
        ) : null}
      </Card>

      {/* what kind of work it was — the honest mirror */}
      <Card label={t.rewards.breakdown}>
        {reward.ticks.easy + reward.ticks.moderate + reward.ticks.hard === 0 ? (
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.rewards.empty}</Text>
        ) : (
          <View style={{ gap: space.sm }}>
            {levels.map((level) => {
              const count = reward.ticks[level];
              const total = reward.ticks.easy + reward.ticks.moderate + reward.ticks.hard;
              const share = total > 0 ? Math.round((count / total) * 100) : 0;
              const tone = difficultyColor(colors, level);
              return (
                <View key={level} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[type.smallStrong, { color: tone }]}>
                      {difficultyLabel(t, level)}
                    </Text>
                    <Text style={[type.small, { color: colors.inkSoft }]}>
                      {fill(t.rewards.ticks, { count })}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.surfaceAlt,
                      overflow: "hidden",
                    }}
                  >
                    <View style={{ width: `${share}%`, height: "100%", backgroundColor: tone }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {reward.hardest ? (
          <View style={{ marginTop: space.md, gap: 4 }}>
            <Text style={[type.label, { color: colors.inkFaint }]}>{t.rewards.hardestTitle}</Text>
            <Text style={[type.bodyStrong, { color: colors.ink }]}>{reward.hardest.title}</Text>
          </View>
        ) : null}
      </Card>

      {reward.bonusPoints > 0 ? (
        <Card label={t.rewards.bonusTitle} tone="orange">
          <Text style={[type.small, { color: colors.ink }]}>
            {fill(t.rewards.bonusLine, { points: reward.bonusPoints, days: STREAK_DAYS })}
          </Text>
        </Card>
      ) : null}

      {/* every live task with the price the scanner put on it */}
      <Card label={t.rewards.tasksTitle}>
        {tasks.length === 0 ? (
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.today.emptyBody}</Text>
        ) : (
          <View style={{ gap: space.md }}>
            {tasks.map((task) => (
              <Pressable
                key={task.id}
                onPress={() => router.push(`/habit/${task.id}`)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                  {task.title}
                </Text>
                <DifficultyBadge scan={task.scan} />
              </Pressable>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

/** The level dial — the ring fills with progress into the current level. */
function LevelRing({ level, pct }: { level: number; pct: number }) {
  const { colors, type } = useTheme();
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.rule} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </Svg>
      <Text style={[type.figure, { color: colors.ink, fontSize: 32 }]}>{level}</Text>
    </View>
  );
}
