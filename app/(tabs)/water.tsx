import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { Screen } from "@/components/Screen";
import { SelectTile } from "@/components/SelectTile";
import { WaterBottle } from "@/components/WaterBottle";
import {
  CUP_SIZES,
  fillFraction,
  MAX_WATER_GOAL,
  MIN_WATER_GOAL,
  recommendedRange,
  waterStatus,
} from "@/health/water";
import { fill, useI18n } from "@/i18n";
import { ON_HERO, ON_HERO_SOFT } from "@/theme";
import { daysAgo, today, useStore } from "@/store";
import { useTheme } from "@/theme";

export default function WaterScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, addWater, todayWater, waterGoal, setWaterGoal, cupMl, setCupMl } = useStore();
  const [editing, setEditing] = useState(false);

  const cups = todayWater();
  const goal = waterGoal();
  const ml = cupMl();
  const weightKg =
    [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ??
    state.profile.startKg;
  const range = recommendedRange(weightKg, ml);
  const status = waterStatus(cups, goal, weightKg);
  const pct = fillFraction(cups, goal);

  const statusText =
    status === "over"
      ? t.water.over
      : status === "met"
        ? t.water.met
        : status === "low"
          ? t.water.low
          : cups === 0
            ? t.water.start
            : t.water.keep;

  // The last seven days of cups, oldest first, zeros included.
  const log = state.water ?? {};
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => daysAgo(6 - i)).map((d) => ({ date: d, cups: log[d] ?? 0 })),
    [log],
  );
  const avg = Math.round(week.reduce((n, d) => n + d.cups, 0) / 7);
  const peak = Math.max(goal, ...week.map((d) => d.cups), 1);
  // Days in a row, counting back from today, that hit the goal.
  let streak = 0;
  for (let i = week.length - 1; i >= 0; i--) {
    if (week[i]!.cups >= goal) streak += 1;
    else if (week[i]!.date !== today()) break; // an unlogged today doesn't break it
  }

  return (
    <Screen title={t.water.heading} subtitle={t.water.body}>
      <HeroCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <WaterBottle fill={pct} met={cups >= goal} width={92} height={186} onHero />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[type.figure, { color: ON_HERO, fontSize: 44 }]}>
              {cups}
              <Text style={[type.small, { color: ON_HERO_SOFT }]}>
                {" "}
                {fill(t.water.ofGoal, { goal })}
              </Text>
            </Text>
            <Text style={[type.small, { color: ON_HERO, fontWeight: "700" }]}>{statusText}</Text>
            <Text style={[type.small, { color: ON_HERO_SOFT }]}>
              {fill(t.water.range, { min: range.min, max: range.max })}
            </Text>
            <Text style={[type.small, { color: ON_HERO_SOFT }]}>
              ≈ {fill(t.water.ml, { ml: (cups * ml).toLocaleString() })}
            </Text>
          </View>
        </View>

        {/* The glass size lives on the bottle itself. It used to be two taps
            deep inside "change goal", where nobody found it — and every number
            on this card (ml drunk, the recommended range in cups) depends on it. */}
        <View style={{ marginTop: space.md, gap: 6 }}>
          <Text style={[type.label, { color: ON_HERO_SOFT, textTransform: "uppercase" }]}>
            {t.water.cupSize}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {CUP_SIZES.map((size) => {
              const on = ml === size;
              return (
                <Pressable
                  key={size}
                  onPress={() => setCupMl(size)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: radius.pill,
                    backgroundColor: on ? ON_HERO : "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: on ? ON_HERO : "rgba(255,255,255,0.22)",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={[type.smallStrong, { color: on ? colors.accent : ON_HERO }]}>
                    {fill(t.water.cupMl, { ml: size })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg }}>
          <Pressable
            onPress={() => addWater(-1)}
            disabled={cups === 0}
            accessibilityRole="button"
            accessibilityLabel={t.water.removeOne}
            accessibilityState={{ disabled: cups === 0 }}
            hitSlop={8}
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              // Dimmed with the hero's own white washes rather than opacity, so
              // it stays readable on red instead of sinking into it.
              backgroundColor: cups === 0 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: cups === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="remove" size={26} color={cups === 0 ? ON_HERO_SOFT : ON_HERO} />
          </Pressable>
          <Pressable
            onPress={() => addWater(1)}
            accessibilityRole="button"
            accessibilityLabel={t.water.addOne}
            hitSlop={8}
            style={{
              flex: 1,
              height: 52,
              borderRadius: radius.pill,
              backgroundColor: ON_HERO,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              shadowColor: colors.shadow,
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 5,
            }}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
            <Text style={[type.bodyStrong, { color: colors.accent }]}>{t.water.cups}</Text>
          </Pressable>
          <Pressable
            onPress={() => setEditing((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded: editing }}
            hitSlop={8}
            style={{
              height: 52,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              backgroundColor: "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[type.smallStrong, { color: ON_HERO }]}>{t.water.editGoal}</Text>
          </Pressable>
        </View>
      </HeroCard>

      {editing ? (
        <Card label={t.water.editGoal}>
          <Text style={[type.small, { color: colors.inkSoft }]}>
            {fill(t.water.goalRecommended, { min: range.min, max: range.max })}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs }}>
            {Array.from(
              { length: MAX_WATER_GOAL - MIN_WATER_GOAL + 1 },
              (_, i) => MIN_WATER_GOAL + i,
            ).map((n) => {
              const selected = goal === n;
              const recommended = n >= range.min && n <= range.max;
              return (
                <SelectTile
                  key={n}
                  selected={selected}
                  onPress={() => {
                    setWaterGoal(n);
                    setEditing(false);
                  }}
                  style={{
                    borderRadius: radius.pill,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    // The band is marked, not enforced: a red outline says
                    // "recommended", everything else is still one tap away.
                    borderWidth: 1,
                    borderColor: recommended ? colors.accent : colors.rule,
                  }}
                >
                  <Text
                    style={[
                      type.smallStrong,
                      {
                        color: selected
                          ? colors.onAccent
                          : recommended
                            ? colors.accent
                            : colors.inkSoft,
                      },
                    ]}
                  >
                    {n}
                  </Text>
                </SelectTile>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card label={t.water.weekTitle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: space.sm,
            height: 90,
            marginTop: space.xs,
          }}
        >
          {week.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: "100%",
                  height: Math.max(4, Math.round((d.cups / peak) * 70)),
                  borderRadius: radius.sm,
                  backgroundColor: d.cups >= goal ? colors.accent : colors.accentWash,
                }}
              />
              <Text style={[type.label, { color: colors.inkFaint }]}>{d.cups}</Text>
            </View>
          ))}
        </View>
        <Text style={[type.small, { color: colors.inkSoft, marginTop: space.sm }]}>
          {fill(t.water.weekAverage, { avg })}
          {streak > 0 ? ` · ${fill(t.water.streak, { days: streak })}` : ""}
        </Text>
      </Card>

      <Card tone="accent">
        <Text style={[type.body, { color: colors.ink }]}>{t.water.tip}</Text>
      </Card>
    </Screen>
  );
}
