import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import {
  addFood, fromAnalysis, label as calcLabel, portions, removeFood, step, total,
  type CalcItem,
} from "@/kitchen/calc";
import { dailyTarget, searchFoods } from "@/kitchen";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { ON_HERO, ON_HERO_SOFT, useTheme } from "@/theme";

/**
 * The calorie calculator.
 *
 * The photo scanner is the fast path when it is available; this is the one that
 * is always available. It needs no key, no network and no quota, so it works on
 * the first day for everyone — and it is also where a photograph's reading
 * lands, because a machine's guess about a plate should be something you can
 * correct rather than something you must accept.
 *
 * Nothing reaches the diary until the total on screen is the total the person
 * agrees with.
 */
export default function CalcScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { logMeal, state, goal: goalOf, todayIntake } = useStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ items?: string }>();

  // A photograph's reading arrives as a parameter so this screen stays the one
  // place a meal is edited, rather than the scanner growing a second editor.
  const [items, setItems] = useState<CalcItem[]>(() => {
    if (!params.items) return [];
    try {
      const parsed: unknown = JSON.parse(String(params.items));
      if (!Array.isArray(parsed)) return [];
      return fromAnalysis(parsed as { label: string; grams?: number }[], locale);
    } catch {
      // A malformed parameter is a deep link someone mangled, not a reason to
      // show a broken screen: open the calculator empty and let them type.
      return [];
    }
  });
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);

  const hits = useMemo(() => (q.trim() ? searchFoods(q, 8) : []), [q]);
  const sums = total(items);

  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const target = dailyTarget(weightKg, goalOf());
  const eaten = todayIntake();
  const leftAfter = target.kcal - eaten.kcal - sums.kcal;

  function save() {
    if (items.length === 0) return;
    logMeal(calcLabel(items, locale), sums.kcal, sums.protein);
    setItems([]);
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen
        title={t.kitchen.calcTitle}
        subtitle={t.kitchen.calcBody}
        aside={
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={8}
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
        {/* the running total, on the hero surface — it is the whole point of
            the screen, and it moves as you tap */}
        <HeroCard>
          <Text style={[type.label, { color: ON_HERO_SOFT, textTransform: "uppercase" }]}>
            {t.kitchen.calcTotal}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginTop: 2 }}>
            <Text style={[type.figure, { color: ON_HERO, fontSize: 46, lineHeight: 50 }]}>
              {sums.kcal}
            </Text>
            <Text style={[type.small, { color: ON_HERO_SOFT, paddingBottom: 8 }]}>
              {t.kitchen.kcal} · {sums.protein}
              {t.kitchen.grams} {t.kitchen.protein}
            </Text>
          </View>
          <Text style={[type.small, { color: ON_HERO_SOFT }]}>
            {leftAfter >= 0
              ? `${t.kitchen.remaining}: ${leftAfter} ${t.kitchen.kcal}`
              : t.kitchen.over}
          </Text>
          <Text style={[type.small, { color: ON_HERO_SOFT, marginTop: 2 }]}>
            {t.kitchen.calcEstimate}
          </Text>
        </HeroCard>

        <Card label={t.kitchen.calcSearch}>
          <TextField
            value={q}
            onChangeText={(v) => {
              setQ(v);
              if (saved) setSaved(false);
            }}
            placeholder={t.kitchen.calcSearchHint}
          />
          {hits.length > 0 ? (
            <View style={{ gap: 6, marginTop: space.sm }}>
              {hits.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setItems((prev) => addFood(prev, f));
                    setQ("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={locale === "he" ? f.he : f.en}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: 10,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.accentWash : colors.surfaceAlt,
                  })}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: radius.pill,
                      backgroundColor: f.color,
                    }}
                  />
                  <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                    {locale === "he" ? f.he : f.en}
                  </Text>
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </Card>

        <Card label={t.kitchen.calcPlate}>
          {items.length === 0 ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.calcEmpty}</Text>
          ) : (
            <View style={{ gap: space.sm }}>
              {items.map((item) => (
                <View
                  key={item.food.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: space.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.rule,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: radius.pill,
                      backgroundColor: item.food.color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                      {locale === "he" ? item.food.he : item.food.en}
                    </Text>
                    <Text style={[type.small, { color: colors.inkFaint }]}>
                      {item.grams} {t.kitchen.calcGrams} ·{" "}
                      {portions(item) === 1
                        ? t.kitchen.calcPortionOne
                        : fill(t.kitchen.calcPortions, { n: portions(item) })}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setItems((prev) => step(prev, item.food.id, -1))}
                    accessibilityRole="button"
                    accessibilityLabel={t.kitchen.calcLess}
                    hitSlop={6}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.pill,
                      backgroundColor: colors.surfaceAlt,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="remove" size={18} color={colors.ink} />
                  </Pressable>
                  <Pressable
                    onPress={() => setItems((prev) => step(prev, item.food.id, 1))}
                    accessibilityRole="button"
                    accessibilityLabel={t.kitchen.calcMore}
                    hitSlop={6}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.pill,
                      backgroundColor: colors.accentWash,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => setItems((prev) => removeFood(prev, item.food.id))}
                    accessibilityRole="button"
                    accessibilityLabel={t.kitchen.calcRemove}
                    hitSlop={6}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.inkFaint} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Button
            icon="checkmark"
            label={t.kitchen.calcSave}
            onPress={save}
            disabled={items.length === 0}
            style={{ marginTop: space.md }}
          />
          {items.length === 0 && !saved ? (
            <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
              {t.kitchen.calcEmpty}
            </Text>
          ) : null}
          {saved ? (
            <Text style={[type.smallStrong, { color: colors.accent, marginTop: space.sm }]}>
              {t.kitchen.calcSaved}
            </Text>
          ) : null}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
