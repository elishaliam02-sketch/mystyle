import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { Screen } from "@/components/Screen";
import { SelectTile } from "@/components/SelectTile";
import { WaterBottle } from "@/components/WaterBottle";
import {
  CUP_SIZES,
  fillFraction,
  GOAL_CHOICES_ML,
  litres,
  MAX_DAY_ML,
  recommendedMl,
  waterStatusMl,
  isStorableCupMl,
  MIN_CUP_ML,
  MAX_CUP_ML,
} from "@/health/water";
import { fill, useI18n } from "@/i18n";
import { ON_HERO, ON_HERO_SOFT } from "@/theme";
import { daysAgo, today, useStore } from "@/store";
import { useTheme } from "@/theme";

export default function WaterScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, addWater, todayWater, waterGoal, waterLog, setWaterGoal, cupMl, setCupMl, todayKey } = useStore();
  const [editing, setEditing] = useState(false);
  // The person's own glass: any size, typed in, not only the five offered.
  const [ownOpen, setOwnOpen] = useState(false);
  const [ownDraft, setOwnDraft] = useState("");
  const [ownError, setOwnError] = useState(false);

  // Everything is millilitres; a "cup" is just the glass chosen below.
  const drunk = todayWater();
  const goal = waterGoal();
  const ml = cupMl();
  const cups = Math.round((drunk / ml) * 10) / 10;
  const weightKg =
    [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ??
    state.profile.startKg;
  const range = recommendedMl(weightKg);
  const status = waterStatusMl(drunk, goal, weightKg);
  const pct = fillFraction(drunk, goal);
  const cupsLeft = Math.ceil(Math.max(0, goal - drunk) / ml);

  const statusText =
    status === "over"
      ? t.water.over
      : status === "met"
        ? t.water.met
        : status === "low"
          ? t.water.low
          : drunk === 0
            ? t.water.start
            : t.water.keep;

  // The last seven days in ml, oldest first, zeros included.
  const log = waterLog();
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => daysAgo(6 - i)).map((d) => ({ date: d, ml: log[d] ?? 0 })),
    [log],
  );
  const avg = litres(week.reduce((n, d) => n + d.ml, 0) / 7);
  const peak = Math.max(goal, ...week.map((d) => d.ml), 1);
  // Days in a row, counting back from today, that hit the goal — over the
  // whole log, not only the seven days on the chart.
  let streak = 0;
  {
    const now = todayKey();
    for (let i = 0; i < 400; i++) {
      const d = daysAgo(i);
      if ((log[d] ?? 0) >= goal) streak += 1;
      else if (d !== now) break; // an unfinished today doesn't break it
    }
  }

  return (
    <Screen title={t.water.heading} subtitle={t.water.body}>
      <HeroCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <WaterBottle fill={pct} met={cups >= goal} width={92} height={186} onHero />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[type.figure, { color: ON_HERO, fontSize: 44 }]}>
              {litres(drunk)}
              <Text style={[type.small, { color: ON_HERO_SOFT }]}>
                {" "}
                {fill(t.water.ofGoal, { goal: litres(goal) })}
              </Text>
            </Text>
            <Text style={[type.small, { color: ON_HERO, fontWeight: "700" }]}>{statusText}</Text>
            <Text style={[type.small, { color: ON_HERO_SOFT }]}>
              {fill(t.water.cupsToday, { n: cups, ml })}
              {cupsLeft > 0 ? ` · ${fill(t.water.cupsLeft, { n: cupsLeft })}` : ""}
            </Text>
            <Text style={[type.small, { color: ON_HERO_SOFT }]}>
              {fill(t.water.range, { min: litres(range.min), max: litres(range.max) })}
            </Text>
            {state.weighIns.length === 0 && !state.profile.startKg ? (
              <Text style={[type.small, { color: ON_HERO_SOFT }]}>{t.water.noWeight}</Text>
            ) : null}
            {drunk >= MAX_DAY_ML ? (
              <Text style={[type.small, { color: ON_HERO_SOFT }]}>
                {fill(t.water.capped, { l: litres(MAX_DAY_ML) })}
              </Text>
            ) : null}
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
            {(() => {
              // A size of their own shows as its own chip, selected, with the
              // amount on it — so it reads as chosen, not as "none of these".
              const custom = !(CUP_SIZES as readonly number[]).includes(ml);
              const on = custom || ownOpen;
              return (
                <Pressable
                  onPress={() => {
                    setOwnOpen((o) => !o);
                    setOwnDraft(custom ? String(ml) : "");
                    setOwnError(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: radius.pill,
                    backgroundColor: on ? ON_HERO : "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: on ? ON_HERO : "rgba(255,255,255,0.22)",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name="create-outline" size={14} color={on ? colors.accent : ON_HERO} />
                  <Text style={[type.smallStrong, { color: on ? colors.accent : ON_HERO }]}>
                    {custom ? fill(t.water.cupMl, { ml }) : t.water.cupOwn}
                  </Text>
                </Pressable>
              );
            })()}
          </View>
          {ownOpen ? (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={ownDraft}
                  onChangeText={(v) => {
                    setOwnDraft(v.replace(/[^0-9]/g, "").slice(0, 4));
                    setOwnError(false);
                  }}
                  keyboardType="number-pad"
                  placeholder={t.water.cupOwnPlaceholder}
                  placeholderTextColor={ON_HERO_SOFT}
                  accessibilityLabel={t.water.cupOwnPlaceholder}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: ownError ? colors.orange : "rgba(255,255,255,0.28)",
                    color: ON_HERO,
                    fontSize: 16,
                  }}
                />
                <Pressable
                  onPress={() => {
                    const n = Number(ownDraft);
                    if (!isStorableCupMl(n)) {
                      setOwnError(true);
                      return;
                    }
                    setCupMl(n);
                    setOwnOpen(false);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: radius.pill,
                    backgroundColor: ON_HERO,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={[type.smallStrong, { color: colors.accent }]}>{t.water.cupOwnSave}</Text>
                </Pressable>
              </View>
              <Text style={[type.small, { color: ownError ? colors.orange : ON_HERO_SOFT }]}>
                {fill(t.water.cupOwnRange, { min: MIN_CUP_ML, max: MAX_CUP_ML })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg }}>
          <Pressable
            onPress={() => addWater(-1)}
            disabled={drunk === 0}
            accessibilityRole="button"
            accessibilityLabel={t.water.removeOne}
            accessibilityState={{ disabled: drunk === 0 }}
            hitSlop={8}
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              // Dimmed with the hero's own white washes rather than opacity, so
              // it stays readable on red instead of sinking into it.
              backgroundColor: drunk === 0 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: drunk === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="remove" size={26} color={drunk === 0 ? ON_HERO_SOFT : ON_HERO} />
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
            <Text style={[type.bodyStrong, { color: colors.accent }]}>{fill(t.water.addCupLabel, { ml })}</Text>
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
            {fill(t.water.goalRecommended, { min: litres(range.min), max: litres(range.max) })}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs }}>
            {GOAL_CHOICES_ML.map((n) => {
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
                    {fill(t.water.litre, { l: litres(n) })}
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
            height: 110,
            marginTop: space.xs,
          }}
        >
          {week.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: "100%",
                  height: Math.max(4, Math.round((d.ml / peak) * 70)),
                  borderRadius: radius.sm,
                  backgroundColor: d.ml >= goal ? colors.accent : colors.chartBar,
                }}
              />
              <Text style={[type.label, { color: colors.inkSoft }]}>{litres(d.ml)}</Text>
              {/* which day each bar is — without it the chart is seven
                  anonymous columns */}
              <Text style={[type.label, { color: colors.inkFaint }]}>
                {t.calendar.weekdaysShort[new Date(`${d.date}T12:00:00`).getDay()]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[type.small, { color: colors.inkSoft, marginTop: space.sm }]}>
          {fill(t.water.weekAverage, { avg })}
          {streak === 1 ? ` · ${t.water.streakOne}` : streak > 1 ? ` · ${fill(t.water.streak, { days: streak })}` : ""}
        </Text>
      </Card>

      <Card tone="accent">
        <Text style={[type.body, { color: colors.ink }]}>{t.water.tip}</Text>
      </Card>
    </Screen>
  );
}
