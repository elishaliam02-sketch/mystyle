import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Share, Text, Vibration, View, useWindowDimensions } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FoodThumb } from "@/components/FoodThumb";
import { MealPhoto } from "@/components/MealPhoto";
import { Screen } from "@/components/Screen";
import { fill, useI18n } from "@/i18n";
import { MEALS, gramsNutrition, mealAmount, scaledHousehold, type MealSlot } from "@/kitchen";
import { dietWarnings, foodsOf, scaledGrams, shareText } from "@/kitchen/book";
import { recipeOf, stepMinutes } from "@/kitchen/recipes";
import { useStore } from "@/store";
import { metricInk, useTheme } from "@/theme";

const UNITS_KEY = "mystyle.kitchen.units";

/**
 * One recipe, cooked from the phone: the photo, what to buy for however many
 * people are eating, the method one step at a time (tap a step to mark it
 * done; a step that says "20 minutes" has a timer on it), the same dish for
 * other diets, and — once it is eaten — one tap to the diary.
 */
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  // The photo (or its ingredient tiles) is laid out at the width it will show.
  const photoW = Math.round(Math.min(screenW - 32, 640));
  const { state, logMeal, toggleFavorite, isFavorite } = useStore();

  const meal = MEALS.find((m) => m.id === id) ?? null;
  const recipe = meal ? recipeOf(meal.id) : null;
  const foods = useMemo(() => (meal ? foodsOf(meal) : []), [meal]);

  const [servings, setServings] = useState(1);
  const [units, setUnits] = useState<"household" | "grams">("household");
  const [have, setHave] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState<{ step: number; endsAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(UNITS_KEY)
      .then((saved) => {
        if (saved === "household" || saved === "grams") setUnits(saved);
      })
      .catch(() => {});
  }, []);

  // One ticking interval, only while a timer runs.
  useEffect(() => {
    if (!timer) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [timer]);
  const left = timer ? Math.max(0, Math.round((timer.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (timer && left === 0) Vibration.vibrate([0, 400, 200, 400]);
  }, [timer, left]);

  const close = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/recipes"))}
      accessibilityRole="button"
      accessibilityLabel={t.common.close}
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
  );

  if (!meal || !recipe) {
    return (
      <Screen title={t.recipes.heading} aside={close}>
        <Card tone="orange">
          <Text style={[type.body, { color: colors.ink }]}>{t.recipes.notFound}</Text>
        </Card>
      </Screen>
    );
  }

  const copy = locale === "he" ? meal.he : meal.en;
  const steps = locale === "he" ? recipe.he : recipe.en;
  const starred = isFavorite(meal.id);
  const warnings = dietWarnings(meal, state.dietFilter);
  const slotLabel: Record<MealSlot, string> = {
    breakfast: t.kitchen.slotBreakfast,
    lunch: t.kitchen.slotLunch,
    dinner: t.kitchen.slotDinner,
    snack: t.kitchen.slotSnack,
  };
  const dietLabel: Record<string, string> = { kosher: t.kitchen.dietKosher, vegetarian: t.kitchen.dietVeg, glutenFree: t.kitchen.dietGf };
  const lang = locale === "he" ? "he" : "en";

  const share = () => {
    const text = shareText(meal, lang, servings, {
      ingredients: t.recipes.shareIngredients,
      steps: t.recipes.shareSteps,
      footer: t.recipes.shareFooter,
      minutes: `⏱ ${fill(t.recipes.minutes, { n: recipe.minutes })}`,
      gram: t.kitchen.gram,
    });
    Share.share({ message: text, title: copy.title }).catch(() => {});
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Screen eyebrow={slotLabel[meal.slot]} title={copy.title} subtitle={copy.how} aside={close}>
      <View style={{ borderRadius: radius.lg, overflow: "hidden" }}>
        <MealPhoto meal={meal} foods={foods} haveIds={new Set<string>()} width={photoW} height={Math.round(photoW * 0.62)} />
      </View>

      {/* the numbers a cook decides by */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Fact icon="time-outline" text={fill(t.recipes.minutes, { n: recipe.minutes })} />
        <Fact icon="speedometer-outline" text={recipe.level === 1 ? t.recipes.levelEasy : t.recipes.levelMedium} />
        <Fact icon="flame-outline" text={`≈${meal.kcal} ${t.kitchen.kcal} ${t.recipes.perServing}`} color={metricInk(colors, "calories")} />
        <Fact icon="barbell-outline" text={`${meal.protein}${t.kitchen.grams} ${t.kitchen.protein}`} color={metricInk(colors, "protein")} />
      </View>

      {warnings.length > 0 ? (
        <Card tone="orange">
          <Text style={[type.small, { color: colors.ink }]}>
            {fill(t.recipes.notForYou, { diets: warnings.map((d) => dietLabel[d]).join(" · ") })}
          </Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button
          icon={logged ? "checkmark-circle" : "add-circle"}
          label={logged ? t.recipes.logged : t.recipes.log}
          disabled={logged}
          onPress={() => {
            logMeal(copy.title, meal.kcal, meal.protein);
            setLogged(true);
          }}
          style={{ flex: 1 }}
        />
        <Pressable
          onPress={() => toggleFavorite(meal.id)}
          accessibilityRole="button"
          accessibilityLabel={t.kitchen.a11yFavorite}
          accessibilityState={{ selected: starred }}
          style={{ width: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={starred ? "star" : "star-outline"} size={22} color={starred ? colors.orangeInk : colors.inkSoft} />
        </Pressable>
        <Pressable
          onPress={share}
          accessibilityRole="button"
          accessibilityLabel={t.recipes.share}
          style={{ width: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.inkSoft} />
        </Pressable>
      </View>

      {/* what you need, for however many are eating */}
      <Card label={t.kitchen.ingredients}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
          <Text style={[type.small, { color: colors.inkSoft, flex: 1 }]}>{fill(t.recipes.forServings, { n: servings })}</Text>
          <Stepper value={servings} onChange={setServings} min={1} max={8} label={t.recipes.servings} />
        </View>
        <Pressable
          onPress={() => {
            const next = units === "grams" ? "household" : "grams";
            setUnits(next);
            AsyncStorage.setItem(UNITS_KEY, next).catch(() => {});
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.sm, alignSelf: "flex-start" }}
        >
          <Ionicons name="swap-horizontal" size={14} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent }]}>{units === "grams" ? t.kitchen.showHousehold : t.kitchen.showGrams}</Text>
        </Pressable>
        <View style={{ gap: 8, marginTop: space.sm }}>
          {foods.map((f) => {
            const p = mealAmount(meal, f.id);
            const g = scaledGrams(meal, f.id, servings);
            const amount = units === "grams" ? `${g} ${t.kitchen.gram}` : scaledHousehold(lang === "he" ? p.he : p.en, servings, lang);
            const got = have.has(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  const next = new Set(have);
                  if (got) next.delete(f.id);
                  else next.add(f.id);
                  setHave(next);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: got }}
                accessibilityLabel={`${lang === "he" ? f.he : f.en} ${amount}`}
                style={{ flexDirection: "row", alignItems: "center", gap: space.sm, opacity: got ? 0.55 : 1 }}
              >
                <Ionicons name={got ? "checkbox" : "square-outline"} size={20} color={got ? colors.accent : colors.inkFaint} />
                <FoodThumb food={f} size={28} />
                <Text
                  style={[type.body, { color: colors.ink, flex: 1, textDecorationLine: got ? "line-through" : "none" }]}
                  numberOfLines={1}
                >
                  {lang === "he" ? f.he : f.en}
                </Text>
                <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{amount}</Text>
                <Text style={[type.small, { color: colors.inkFaint, minWidth: 48, textAlign: "left" }]}>
                  {gramsNutrition(f, g).kcal} {t.kitchen.kcal}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* the method, one step at a time */}
      <Card label={t.recipes.steps}>
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.recipes.stepsHint}</Text>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {steps.map((s, i) => {
            const isDone = done.has(i);
            const mins = stepMinutes(s);
            const running = timer?.step === i;
            return (
              <View key={i} style={{ gap: 6 }}>
                <Pressable
                  onPress={() => {
                    const next = new Set(done);
                    if (isDone) next.delete(i);
                    else next.add(i);
                    setDone(next);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone }}
                  style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isDone ? colors.accent : colors.accentWash,
                    }}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={16} color={colors.onAccent} />
                    ) : (
                      <Text style={[type.smallStrong, { color: colors.accent }]}>{i + 1}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      type.body,
                      { color: isDone ? colors.inkFaint : colors.ink, flex: 1, textDecorationLine: isDone ? "line-through" : "none" },
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
                {mins ? (
                  <Pressable
                    onPress={() => {
                      if (running) {
                        setTimer(null);
                      } else {
                        setNow(Date.now());
                        setTimer({ step: i, endsAt: Date.now() + mins * 60_000 });
                      }
                    }}
                    accessibilityRole="button"
                    style={{
                      marginStart: 36,
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: radius.pill,
                      backgroundColor: running ? (left === 0 ? colors.accent : colors.orangeWash ?? colors.accentWash) : colors.surfaceAlt,
                    }}
                  >
                    <Ionicons name={running ? (left === 0 ? "checkmark" : "stop") : "timer-outline"} size={16} color={running && left === 0 ? colors.onAccent : colors.ink} />
                    <Text style={[type.smallStrong, { color: running && left === 0 ? colors.onAccent : colors.ink }]}>
                      {running ? (left === 0 ? t.recipes.timerDone : fill(t.recipes.timerRunning, { time: mmss(left) })) : fill(t.recipes.timer, { n: mins })}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>

      {/* the same dish for someone else */}
      {recipe.options.length > 0 ? (
        <Card label={t.recipes.options}>
          <View style={{ gap: 8 }}>
            {recipe.options.map((o, i) => (
              <View key={i} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
                <Ionicons name="swap-horizontal" size={16} color={colors.accent} style={{ marginTop: 3 }} />
                <Text style={[type.body, { color: colors.ink, flex: 1 }]}>{lang === "he" ? o.he : o.en}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {recipe.tip ? (
        <Card label={t.recipes.tip} tone="accent">
          <Text style={[type.body, { color: colors.ink }]}>{lang === "he" ? recipe.tip.he : recipe.tip.en}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function Fact({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  const { colors, radius, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 11,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Ionicons name={icon} size={15} color={color ?? colors.inkSoft} />
      <Text style={[type.smallStrong, { color: color ?? colors.ink }]}>{text}</Text>
    </View>
  );
}

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const { colors, radius, type } = useTheme();
  const btn = (icon: "remove" | "add", next: number, off: boolean) => (
    <Pressable
      onPress={() => !off && onChange(next)}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${icon === "add" ? "+" : "−"}`}
      hitSlop={6}
      style={{
        width: 34,
        height: 34,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: off ? colors.surfaceAlt : colors.accentWash,
      }}
    >
      <Ionicons name={icon} size={18} color={off ? colors.inkFaint : colors.accent} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {btn("remove", value - 1, value <= min)}
      <Text style={[type.title, { color: colors.ink, minWidth: 18, textAlign: "center" }]}>{value}</Text>
      {btn("add", value + 1, value >= max)}
    </View>
  );
}
