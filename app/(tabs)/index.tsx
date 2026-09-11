import Ionicons from "@expo/vector-icons/Ionicons";
import { Chevron } from "@/components/Chevron";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { ProGate, ProRemaining } from "@/components/ProGate";
import { Screen } from "@/components/Screen";
import { TaskRow } from "@/components/TaskRow";
import { UpdateBanner } from "@/components/UpdateBanner";
import { ChallengeCard } from "@/components/ChallengeCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useConnectivity } from "@/net";
import { askDailyTip } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge, AiNote } from "@/components/AiNote";
import Svg, { Circle } from "react-native-svg";
import { dayScore, scoreTier } from "@/insight/dayscore";
import { dailyTarget } from "@/kitchen";
import { fill, formatDate, useI18n } from "@/i18n";
import { ON_HERO, ON_HERO_SOFT } from "@/theme";
import { useStore } from "@/store";
import { computeRewards, todayOnOffer } from "@/rewards";
import { scanTask } from "@/tasks/difficulty";
import { detectCategory, getSupport } from "@/support";
import { confirm } from "@/ui/confirm";
import { metricFill, metricInk, useTheme } from "@/theme";

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
  const { state, isDone, todayKey } = useStore();
  const [offset, setOffset] = useState(0);

  const habits = state.habits.filter((h) => !h.archived);
  const dayKey = todayKey();

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
        <PillButton
          tone="soft"
          label={t.today.tipAnother}
          onPress={() => {
            setOffset((o) => o + 1);
            retry();
          }}
        />

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
 * What today's board is worth, and what it has paid so far.
 *
 * The tasks on the Today screen are the person's own words, and the app has
 * already read them and priced them (see `@/tasks/difficulty`). This is where
 * that shows up in the run of the day: a level, a bar toward the next one, and
 * the plain fact that there are still points sitting on the board unticked.
 */
function RewardsEntry() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, todayKey } = useStore();

  const day = todayKey();
  const reward = computeRewards(state, day);
  const offer = todayOnOffer(state, day);
  const pct = Math.round((reward.intoLevel / reward.levelSpan) * 100);

  return (
    <Pressable onPress={() => router.push("/rewards")} accessibilityRole="button">
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="medal" size={22} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.title, { color: colors.ink }]}>
              {fill(t.rewards.entry, { level: reward.level })}
            </Text>
            <Text style={[type.small, { color: colors.inkSoft }]}>
              {fill(t.rewards.entryHint, { points: reward.points, left: reward.toNext })}
            </Text>
          </View>
          <Text style={[type.figure, { color: metricInk(colors, "score"), fontSize: 26, lineHeight: 32 }]}>
            {offer.earned}
          </Text>
        </View>

        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.surfaceAlt,
            overflow: "hidden",
            marginTop: space.sm,
          }}
        >
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.accent }} />
        </View>

        <Text style={[type.small, { color: colors.inkFaint, marginTop: 4 }]}>
          {fill(t.rewards.todayLine, { earned: offer.earned, available: offer.available })}
        </Text>
      </Card>
    </Pressable>
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
  const { state, isDone, streak, todayIntake, todayWater, waterGoal, goal, todayKey } = useStore();

  const habits = state.habits.filter((h) => !h.archived);
  const doneCount = habits.filter((h) => isDone(h.id)).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, streak(h.id)), 0);

  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const target = dailyTarget(weightKg, goal());
  const eaten = todayIntake().kcal;
  const water = todayWater();
  const wGoal = waterGoal();
  const workoutDone = (state.training?.log[todayKey()]?.length ?? 0) > 0;

  // One number that ties the day together — the hook that makes the Today
  // screen worth opening. It climbs as habits are ticked, the session is done,
  // water is drunk and food is logged near target.
  const score = dayScore({
    habitsDone: doneCount,
    habitsTotal: habits.length,
    workoutDone,
    hasPlan: !!state.training,
    waterCups: water,
    waterGoal: wGoal,
    kcalEaten: eaten,
    kcalTarget: target.kcal,
    loggedFood: todayIntake().items.length > 0,
  });
  const tier = scoreTier(score);
  const headline = t.today.score[tier];

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
      value: `${water}/${wGoal}`,
      label: t.today.hubWater,
      onPress: () => router.push("/water"),
    },
    {
      icon: workoutDone ? "checkmark-circle" : "barbell",
      value: workoutDone ? t.today.hubDone : t.today.hubStart,
      label: t.today.hubWorkout,
      onPress: () => router.push("/workout"),
    },
  ];

  return (
    <HeroCard>
      {/* the day score — the number that makes today worth opening */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <ScoreRing score={score} onHero />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.display, { color: ON_HERO, fontSize: 22, lineHeight: 28 }]}>{headline}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="flame" size={16} color={ON_HERO} />
            <Text style={[type.small, { color: ON_HERO_SOFT }]}>
              {bestStreak > 0 ? fill(t.today.hubStreak, { days: bestStreak }) : t.today.hubStreakNone}
            </Text>
          </View>
        </View>
      </View>

      {/* the pillars as glass tiles on the hero — a shortcut into each */}
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
        {tiles.map((tile) => {
          const box = {
            flex: 1,
            alignItems: "center" as const,
            gap: 4,
            paddingVertical: space.md,
            paddingHorizontal: 2,
            borderRadius: radius.md,
            borderWidth: 1,
          };
          const body = (
            <>
              <Ionicons name={tile.icon} size={19} color={ON_HERO} />
              <Text style={[type.smallStrong, { color: ON_HERO }]} numberOfLines={1}>
                {tile.value}
              </Text>
              <Text style={[type.label, { color: ON_HERO_SOFT, letterSpacing: 0.3 }]} numberOfLines={1}>
                {tile.label}
              </Text>
            </>
          );

          // A tile with nowhere to go is a readout, not a shortcut. Drawn like
          // the others it read as a button that ignores the tap, and the habit
          // list it counts is the very next block anyway.
          if (!tile.onPress) {
            return (
              <View key={tile.label} style={[box, { borderColor: "transparent" }]}>
                {body}
              </View>
            );
          }

          return (
            <Pressable
              key={tile.label}
              onPress={tile.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [
                box,
                {
                  backgroundColor: pressed ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.14)",
                  borderColor: "rgba(255,255,255,0.18)",
                },
              ]}
            >
              {body}
            </Pressable>
          );
        })}
      </View>
    </HeroCard>
  );
}

/** The day-score dial: a ring that fills with the score and shows it big. */
function ScoreRing({ score, onHero = false }: { score: number; onHero?: boolean }) {
  const { colors, type } = useTheme();
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const track = onHero ? "rgba(255,255,255,0.22)" : colors.rule;
  // The day score counts what got finished, so the arc belongs to the count
  // family: neon lime, which is the one bright that holds up on the blue hero.
  const fill = onHero ? colors.lime : metricFill(colors, "score");
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fill}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </Svg>
      <Text style={[type.figure, { color: onHero ? ON_HERO : colors.ink, fontSize: 34 }]}>{score}</Text>
    </View>
  );
}

export default function TodayScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, isDone, toggleCompletion, readyForAnotherHabit, allowance, consent } = useStore();
  // Reachability only, not a second sync loop — the store's sync lives in one
  // place and calling useCloud here would start a rival copy of it.
  const net = useConnectivity(consent().cloud);

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
  // Only the *next* habit is ever refused: the list above is untouched by this,
  // and every habit already there stays tickable, openable and editable.
  const canAdd = allowance("habits").ok;

  return (
    <Screen
      eyebrow={dateLabel}
      title={title}
      subtitle={
        doneCount === habits.length
          ? t.today.allDone
          : fill(t.today.doneCount, { done: doneCount, total: habits.length })
      }
    >
      <OfflineBanner state={net.state} onRetry={() => void net.recheck()} />

      <UpdateBanner />

      <TodayHub />

      {/* the core daily loop leads the screen: ticking a habit was the fourth
          block down, at or below the fold on a phone */}
      <Card label={t.today.listLabel}>
        <View>
          {habits.map((habit, index) => (
            <TaskRow
              key={habit.id}
              first={index === 0}
              label={habit.slot ? `${habit.title} · ${t.slots[habit.slot]}` : habit.title}
              hint={habit.anchor}
              done={isDone(habit.id)}
              scan={scanTask(habit.title)}
              onToggle={() => toggleCompletion(habit.id)}
              onOpen={() => router.push(`/habit/${habit.id}`)}
            />
          ))}
        </View>
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.today.openHint}</Text>
      </Card>

      <ChallengeCard />

      <RewardsEntry />

      {/* the coach — answers from this person's own numbers, on the device */}
      <Pressable onPress={() => router.push("/coach")} accessibilityRole="button">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubbles" size={22} color={colors.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: colors.ink }]}>{t.coach.entry}</Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>{t.coach.entryHint}</Text>
            </View>
            <Chevron size={20} color={colors.inkFaint} />
          </View>
        </Card>
      </Pressable>

      <TipOfTheDay />

      <View
        style={{
          backgroundColor: ready ? colors.accentWash : colors.orangeWash,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Ionicons
            name={ready ? "sparkles" : "hourglass-outline"}
            size={16}
            color={ready ? colors.accent : colors.orangeInk}
          />
          <Text style={[type.label, { color: ready ? colors.accent : colors.orangeInk }]}>
            {ready ? t.today.readyTitle : t.today.holdTitle}
          </Text>
        </View>
        <Text style={[type.small, { color: colors.inkSoft }]}>
          {ready ? t.today.readyBody : t.today.holdBody}
        </Text>
        {/* The invitation to add one stays as it was; at the free ceiling the
            button is replaced by the card that says which limit was hit, rather
            than left on screen doing nothing. */}
        {canAdd ? (
          <>
            <Button
              icon="add"
              label={t.today.addCta}
              tone={ready ? "primary" : "quiet"}
              onPress={() => router.push("/habit/new")}
              style={{ marginTop: space.xs }}
            />
            <ProRemaining feature="habits" />
          </>
        ) : (
          <ProGate feature="habits" />
        )}
      </View>
    </Screen>
  );
}
