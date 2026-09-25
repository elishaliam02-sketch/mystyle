import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { PillButton } from "@/components/PillButton";
import { SelectTile } from "@/components/SelectTile";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { EatScore } from "@/components/EatScore";
import { FoodThumb } from "@/components/FoodThumb";
import { MealPhoto } from "@/components/MealPhoto";
import { MealScanner } from "@/components/MealScanner";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Chevron } from "@/components/Chevron";
import {
  DIETS,
  FOODS,
  MEALS,
  adhocFood,
  dailyTarget,
  dietHidden,
  dietList,
  dietOk,
  dietSpec,
  foodNutrition,
  goalFit,
  gramsNutrition,
  mealAmount,
  plateForGoal,
  portion,
  primaryNote,
  readPantryFull,
  searchFoods,
  shoppingList,
  slotForHour,
  starterMeals,
  scaledHousehold,
  suggestMeals,
  type Food,
  type Goal,
  type Meal,
  type MealMatch,
  type MealNote,
  type MealSlot,
  type ShoppingItem,
} from "@/kitchen";
import { useStore } from "@/store";
import { projectGoal } from "@/store/projection";
import { metricFill, metricInk, useTheme, type Metric } from "@/theme";

const GOALS: Goal[] = ["cut", "recomp", "maintain", "bulk"];

type Units = "household" | "grams";
const UNITS_KEY = "mystyle.kitchen.units";

export default function KitchenScreen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { colors, space, radius, type } = useTheme();
  const { state, setPantry, goal: goalOf, setGoal, setDietFilter, mealSeed, shuffleMeals } = useStore();
  const favorites = state.favorites ?? [];

  // The store hydrates from disk a tick after this screen first renders, so
  // neither of these may be seeded from state: doing so snapshotted an empty
  // pantry and left someone with a saved list staring at a blank box. The
  // draft is filled the moment the real list arrives, and the editor is a
  // derived state — open only while there is nothing saved, or on request.
  const [draft, setDraft] = useState("");
  const [forceEdit, setForceEdit] = useState(false);
  const editing = forceEdit || !state.pantry;
  const setEditing = (on: boolean) => setForceEdit(on);
  useEffect(() => {
    if (state.pantry) setDraft(state.pantry);
  }, [state.pantry]);
  // The one goal the whole app follows — set it here and the plan, cardio and
  // progress targets all move with it.
  const goal: Goal = goalOf();
  // The switched-on dietary filters, stored as one string ("kosher,vegetarian").
  const diet = state.dietFilter ?? "all";
  const diets = dietList(diet);
  // How amounts read: everyday household units, or exact grams for anyone who
  // weighs their food. It is a reading preference rather than part of the plan,
  // so it sits beside the store — but it still has to survive leaving the tab,
  // which plain component state did not.
  const [units, setUnitsState] = useState<Units>("household");
  useEffect(() => {
    AsyncStorage.getItem(UNITS_KEY)
      .then((saved) => {
        if (saved === "household" || saved === "grams") setUnitsState(saved);
      })
      .catch(() => {});
  }, []);
  const setUnits = (next: Units) => {
    setUnitsState(next);
    // A failed write only costs the preference on next launch.
    AsyncStorage.setItem(UNITS_KEY, next).catch(() => {});
  };

  const slot = slotForHour(new Date().getHours());
  const pantryText = state.pantry ?? "";

  // The seed is what stops the kitchen feeling stuck: this device, this day,
  // and however many times the person has pressed shuffle.
  const seed = mealSeed();
  const result = useMemo(
    () => suggestMeals(pantryText, { goal, slot, seed }),
    [pantryText, goal, slot, seed],
  );
  // Everything the list named — recognised foods, plus anything unknown turned
  // into an ad-hoc ingredient — so nothing the person typed is dropped.
  const full = useMemo(() => readPantryFull(pantryText), [pantryText]);
  const adhocs = useMemo(() => full.extras.map((w) => adhocFood(w)), [full.extras]);
  const allItems = useMemo(() => [...full.known, ...adhocs], [full.known, adhocs]);
  // A plate built from exactly what the person has — but sized and stocked for
  // the goal they chose, and with anything their diet rules out left off it.
  // Switching goal or diet visibly rewrites this card; it used to be the same
  // pile of groceries every time, which is why both controls felt dead.
  const plate = useMemo(
    () => plateForGoal(allItems, slot, goal, diet),
    [allItems, slot, goal, diet],
  );
  // Show only a handful of the best curated picks that pass the diet filter.
  // Each card fetches its own photo on demand — a dozen at once load slowly.
  const ready = useMemo(
    () => result.ready.filter((m) => dietOk(m.meal, diet)).slice(0, 3),
    [result.ready, diet],
  );
  const almost = useMemo(
    () => result.almost.filter((m) => dietOk(m.meal, diet)).slice(0, 3),
    [result.almost, diet],
  );
  const haveIds = useMemo(() => new Set(allItems.map((f) => f.id)), [allItems]);
  const foodsById = useMemo(
    () => new Map([...FOODS, ...adhocs].map((f) => [f.id, f])),
    [adhocs],
  );

  function build() {
    setPantry(draft.trim());
    setEditing(false);
  }

  const goalLabel: Record<Goal, { label: string; hint: string }> = {
    cut: { label: t.kitchen.goalCut, hint: t.kitchen.goalCutHint },
    recomp: { label: t.kitchen.goalRecomp, hint: t.kitchen.goalRecompHint },
    maintain: { label: t.kitchen.goalMaintain, hint: t.kitchen.goalMaintainHint },
    bulk: { label: t.kitchen.goalBulk, hint: t.kitchen.goalBulkHint },
  };

  // How many dishes the dietary filter is holding back, across the whole menu.
  const hidden = useMemo(
    () => dietHidden(MEALS.map((meal) => ({ meal, have: [], missing: [], ready: true, fit: 0 })), diet),
    [diet],
  );

  const hasList = pantryText.trim().length > 0;
  const showAny = Boolean(plate) || ready.length > 0 || almost.length > 0;

  // Once a list is saved the screen belongs to the two or three logs a day, not
  // to the setup that happens once: the daily controls come first and goal,
  // units and diet fold away behind a single row. On a first run there is
  // nothing to log against, so the list leads and the setup stays open. Editing
  // a saved list happens where the list card already sits, so nothing jumps.
  const dailyFirst = hasList;
  const [showSettings, setShowSettings] = useState(false);
  const settingsOpen = showSettings || !dailyFirst;

  // The day's calorie goal, so every confirmation can say where the day stands
  // now instead of only that something was saved.
  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const goalKcal = dailyTarget(weightKg, goal).kcal;

  // The list itself: an editor while there is nothing saved or on request,
  // otherwise the read-back of what was understood.
  const pantryBlock =
    editing || !hasList ? (
      <Card label={t.kitchen.listLabel}>
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder={t.kitchen.listPlaceholder}
          multiline
        />
        <Button
          icon="restaurant"
          label={t.kitchen.save}
          onPress={build}
          style={{ marginTop: space.md }}
        />
      </Card>
    ) : (
      <Card label={t.kitchen.understood}>
        {allItems.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {allItems.map((f) => (
              <View
                key={f.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.pill,
                  paddingVertical: 4,
                  paddingStart: 4,
                  paddingEnd: 10,
                }}
              >
                <FoodThumb food={f} size={20} />
                <Text style={[type.small, { color: colors.ink }]}>{locale === "he" ? f.he : f.en}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[type.body, { color: colors.inkSoft }]}>{t.kitchen.understoodEmpty}</Text>
        )}
        <Button
          label={t.kitchen.change}
          tone="quiet"
          onPress={() => {
            setDraft(pantryText);
            setEditing(true);
          }}
          style={{ marginTop: space.md }}
        />
      </Card>
    );

  // The handful of taps a day: what is left to eat, the camera, the search box.
  const dailyBlock = (
    <>
      {/* today: targets, water and the food log */}
      <TodayCard goal={goal} />

      {/* photograph the plate — the fastest way into the diary */}
      <MealScanner />

      {/* The counting that always works, given its own way in rather than
          living only inside the scanner's failure states. */}
      <Pressable onPress={() => router.push("/calc")} accessibilityRole="button">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.pill,
                backgroundColor: colors.accentWash,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="calculator" size={21} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: colors.ink }]}>{t.kitchen.calcTitle}</Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>{t.kitchen.calcBody}</Text>
            </View>
            <Chevron size={20} color={colors.inkFaint} />
          </View>
        </Card>
      </Pressable>

      {/* log anything you ate, not just the curated dishes */}
      <QuickLog goalKcal={goalKcal} units={units} />
    </>
  );

  // Goal, units and diet: chosen once and then rarely touched, so for anyone
  // with a list they hide behind one row rather than pushing the diary down.
  const settingsBlock = (
    <>
      {dailyFirst ? (
        <Pressable
          onPress={() => setShowSettings((on) => !on)}
          accessibilityRole="button"
          accessibilityState={{ expanded: settingsOpen }}
        >
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Ionicons name="options" size={20} color={colors.inkFaint} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.kitchen.settingsTitle}</Text>
                <Text style={[type.small, { color: colors.inkSoft }]}>
                  {settingsOpen ? t.kitchen.settingsClose : t.kitchen.settingsOpen}
                </Text>
              </View>
              <Ionicons
                name={settingsOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.inkFaint}
              />
            </View>
          </Card>
        </Pressable>
      ) : null}

      {settingsOpen ? (
        <>
          {/* goal picker */}
          <Card label={t.kitchen.goalTitle}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {GOALS.map((g) => {
                const on = goal === g;
                return (
                  <SelectTile
                    key={g}
                    selected={on}
                    onPress={() => setGoal(g)}
                    style={{
                      flexGrow: 1,
                      flexBasis: "47%",
                      alignItems: "center",
                      paddingVertical: space.md,
                      paddingHorizontal: space.xs,
                      borderRadius: radius.lg,
                    }}
                  >
                    <View style={{ alignItems: "center", gap: 2 }}>
                      <Text style={[type.bodyStrong, { color: on ? colors.onAccent : colors.ink }]}>
                        {goalLabel[g].label}
                      </Text>
                      <Text
                        style={[
                          type.small,
                          { color: on ? colors.onAccent : colors.inkFaint, textAlign: "center" },
                        ]}
                      >
                        {goalLabel[g].hint}
                      </Text>
                    </View>
                  </SelectTile>
                );
              })}
            </View>
            {/* this chip does not only move the food targets — say so */}
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.kitchen.goalAlsoTraining}
            </Text>
          </Card>

          {/* how amounts are shown */}
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            {(["household", "grams"] as const).map((u) => {
              const on = units === u;
              return (
                <SelectTile
                  key={u}
                  selected={on}
                  onPress={() => setUnits(u)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: space.lg,
                    borderRadius: radius.pill,
                  }}
                >
                  <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>
                    {u === "grams" ? t.kitchen.unitsGrams : t.kitchen.unitsHousehold}
                  </Text>
                </SelectTile>
              );
            })}
          </View>

          {/* dietary filters — any combination, "all" clears them */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}>
            {(["all", ...DIETS] as const).map((d) => {
              const on = d === "all" ? diets.length === 0 : diets.includes(d);
              const label =
                d === "all"
                  ? t.kitchen.dietAll
                  : d === "kosher"
                    ? t.kitchen.dietKosher
                    : d === "vegetarian"
                      ? t.kitchen.dietVeg
                      : t.kitchen.dietGf;
              return (
                <SelectTile
                  key={d}
                  selected={on}
                  onPress={() =>
                    setDietFilter(
                      d === "all"
                        ? "all"
                        : dietSpec(on ? diets.filter((x) => x !== d) : [...diets, d]),
                    )
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: space.lg,
                    borderRadius: radius.pill,
                  }}
                >
                  <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>
                    {label}
                  </Text>
                </SelectTile>
              );
            })}
          </View>

          <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.dietPickAny}</Text>

          {/* proof the filter did something: what it just took off the menu */}
          {hidden > 0 ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {fill(t.kitchen.dietHidden, { n: hidden })}
            </Text>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.kitchen.heading} subtitle={t.kitchen.body}>
        {/* "Can I eat this?" sits at the top whatever else the screen is doing:
            it answers the question somebody opened the kitchen to ask, and it
            answers it about the food they were already thinking about rather
            than about what happens to be in the fridge. */}
        <EatScore />

        {dailyFirst ? (
          <>
            {dailyBlock}
            {settingsBlock}
            {pantryBlock}
          </>
        ) : (
          <>
            {pantryBlock}
            {settingsBlock}
            {dailyBlock}
          </>
        )}

        {/* where this pace lands you */}
        <ProjectionCard />

        {/* how to size a plate with no scale in the house */}
        <Card label={t.kitchen.portionTitle}>
          <Text style={[type.body, { color: colors.ink }]}>{t.kitchen.portionBody}</Text>
        </Card>

        {/* meals you starred */}
        {favorites.length > 0 ? (
          <>
            <SectionLabel text={t.kitchen.favTitle} />
            {MEALS.filter((m) => favorites.includes(m.id) && dietOk(m, diet)).map((m) => (
              <MealCard key={`fav-${m.id}`} meal={m} have={haveIds} foodsById={foodsById} units={units} onUnits={setUnits} goal={goal} goalKcal={goalKcal} />
            ))}
          </>
        ) : null}

        {/* meals */}
        {!hasList ? (
          <View style={{ gap: space.md }}>
            <Card label={t.kitchen.starterTitle} tone="accent">
              <Text style={[type.body, { color: colors.ink }]}>{t.kitchen.starterBody}</Text>
            </Card>
            {starterMeals(goal, seed)
              .filter((meal) => dietOk(meal, diet))
              .map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  have={new Set<string>()}
                  foodsById={foodsById}
                  units={units}
                  onUnits={setUnits}
                  goal={goal}
                  goalKcal={goalKcal}
                />
              ))}
          </View>
        ) : !showAny ? (
          <Card tone="orange">
            <Text style={[type.body, { color: colors.ink }]}>{t.kitchen.nothing}</Text>
          </Card>
        ) : (
          <>
            {plate ? (
              <>
                <SectionLabel text={t.kitchen.yourPlate} />
                <MealCard meal={plate} have={haveIds} foodsById={foodsById} units={units} onUnits={setUnits} goal={goal} goalKcal={goalKcal} />
              </>
            ) : null}

            {ready.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: space.sm,
                }}
              >
                <SectionLabel text={t.kitchen.readyTitle} />
                <PillButton tone="soft" icon="shuffle" label={t.kitchen.shuffle} onPress={shuffleMeals} />
              </View>
            ) : null}
            {ready.map((m) => (
              <MealCard key={m.meal.id} match={m} have={haveIds} foodsById={foodsById} units={units} onUnits={setUnits} goal={goal} goalKcal={goalKcal} />
            ))}

            {almost.length > 0 ? <SectionLabel text={t.kitchen.almostTitle} /> : null}
            {almost.map((m) => (
              <MealCard key={m.meal.id} match={m} have={haveIds} foodsById={foodsById} units={units} onUnits={setUnits} goal={goal} goalKcal={goalKcal} />
            ))}

            {almost.length > 0 ? <ShoppingCard items={shoppingList(almost)} /> : null}
          </>
        )}

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.kitchen.estimateNote}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}



function Bar({ pct, over, metric }: { pct: number; over: boolean; metric: Metric }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.surfaceAlt,
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 4,
          // Over the line the bar switches to the alert weight of orange; up to
          // it, the bar is whichever metric it is measuring.
          backgroundColor: over ? colors.alert : metricFill(colors, metric),
        }}
      />
    </View>
  );
}

/** The progress bar in its on-hero form: white on the red gradient, where the
 * accent-on-paper Bar would vanish. */
function HeroBar({ pct }: { pct: number }) {
  const { radius, space } = useTheme();
  return (
    <View
      style={{
        height: 8,
        borderRadius: radius.pill,
        // Darker than the gradient rather than lighter: a pale track on red
        // reads as a full bar, which is the opposite of an empty day.
        backgroundColor: "rgba(0,0,0,0.22)",
        overflow: "hidden",
        marginTop: space.xs,
      }}
    >
      <View
        style={{
          width: `${Math.max(2, pct)}%`,
          height: "100%",
          borderRadius: radius.pill,
          backgroundColor: "#FFFFFF",
        }}
      />
    </View>
  );
}

function TodayCard({ goal }: { goal: Goal }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, todayIntake, removeMeal } = useStore();

  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const target = dailyTarget(weightKg, goal);
  const eaten = todayIntake();

  const kcalLeft = target.kcal - eaten.kcal;
  const proLeft = target.protein - eaten.protein;
  const kcalPct = Math.min(100, Math.round((eaten.kcal / target.kcal) * 100));
  const proPct = Math.min(100, Math.round((eaten.protein / target.protein) * 100));

  return (
    <>
      {/* The one figure a person opens the kitchen for, said once and large:
          it used to be a row inside the card, indistinguishable from the four
          rows around it. The metric's own colour still carries the meaning. */}
    <Card label={t.kitchen.todayTitle}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <Text style={[type.figure, { color: metricInk(colors, "calories"), fontSize: 44, lineHeight: 48 }]}>
          {Math.abs(kcalLeft)}
        </Text>
        <Text style={[type.small, { color: colors.inkSoft, paddingBottom: 7 }]}>
          {kcalLeft < 0 ? t.kitchen.over : `${t.kitchen.remaining} · ${t.kitchen.kcal}`}
        </Text>
      </View>

      {/* calories */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={[type.smallStrong, { color: colors.ink }]}>{t.kitchen.targetKcal}</Text>
        <Text style={[type.smallStrong, { color: metricInk(colors, "calories") }]}>
          {eaten.kcal} / {target.kcal} {t.kitchen.kcal}
        </Text>
      </View>
      <Bar pct={kcalPct} over={kcalLeft < 0} metric="calories" />
      <Text style={[type.small, { color: kcalLeft < 0 ? colors.orangeInk : colors.inkFaint, marginTop: 4 }]}>
        {kcalLeft < 0 ? t.kitchen.over : `${t.kitchen.remaining}: ${kcalLeft} ${t.kitchen.kcal}`}
      </Text>

      {/* protein */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: space.md,
        }}
      >
        <Text style={[type.smallStrong, { color: colors.ink }]}>{t.kitchen.targetProtein}</Text>
        <Text style={[type.smallStrong, { color: metricInk(colors, "protein") }]}>
          {eaten.protein} / {target.protein} {t.kitchen.grams}
        </Text>
      </View>
      <Bar pct={proPct} over={false} metric="protein" />
      <Text style={[type.small, { color: colors.inkFaint, marginTop: 4 }]}>
        {proLeft > 0 ? `${t.kitchen.remaining}: ${proLeft} ${t.kitchen.grams}` : t.kitchen.over}
      </Text>
    </Card>

    <Card label={t.kitchen.loggedTitle}>
      {/* logged today */}
      <View style={{ gap: 6 }}>
        {eaten.items.length === 0 ? (
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.logEmpty}</Text>
        ) : (
          eaten.items.map((it) => (
            <View
              key={it.id}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
            >
              <Text style={[type.small, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                {it.label}
              </Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>
                ≈{it.kcal} {t.kitchen.kcal} · {it.protein}
                {t.kitchen.grams}
              </Text>
              <Pressable
                onPress={() => removeMeal(it.id)}
                accessibilityRole="button"
                accessibilityLabel={t.kitchen.a11yRemoveItem}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.inkFaint} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </Card>
    </>
  );
}

/**
 * One shopping list behind the near-miss meals: each missing ingredient once,
 * with how many of those dishes it would unlock, most useful first — so the
 * top item is the single best thing to put in the basket.
 */
function ShoppingCard({ items }: { items: ShoppingItem[] }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  if (items.length === 0) return null;

  return (
    <Card label={t.kitchen.shoppingTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.kitchen.shoppingHint}</Text>
      <View style={{ gap: 6, marginTop: space.sm }}>
        {items.map(({ food, count }) => (
          <View
            key={food.id}
            style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
          >
            <FoodThumb food={food} size={28} />
            <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
              {locale === "he" ? food.he : food.en}
            </Text>
            {count > 1 ? (
              <View
                style={{
                  backgroundColor: colors.accentWash,
                  borderRadius: radius.pill,
                  paddingVertical: 2,
                  paddingHorizontal: 9,
                }}
              >
                <Text style={[type.label, { color: colors.accent }]}>
                  {fill(t.kitchen.shoppingCount, { count })}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

/**
 * Quick log — search the food library, say how much, and it is in today's
 * diary. Someone eating a schnitzel and a pita will never build a recipe
 * first; this is the path that keeps the diary honest for a real day.
 *
 * A tap used to log one standard portion with no way to say "two" or "200 g",
 * so the diary was only right for people who happened to eat exactly the
 * portion the app had in mind. Now a tap opens the amount — half, one, one and
 * a half, two portions, or any weight — with the calories worked out live, and
 * the diary line says how much ("חזה עוף · 225 ג'").
 */
function QuickLog({ goalKcal, units }: { goalKcal: number; units: Units }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { colors, space, radius, type, font } = useTheme();
  const { logMeal, todayIntake } = useStore();
  const [q, setQ] = useState("");
  // Tapping a hit clears the box, which takes the whole list off screen, and
  // the diary it wrote to is further up the page — so the answer to the tap
  // has to stay right here, where the list just was.
  const [logged, setLogged] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [mult, setMult] = useState(1);
  const [typedGrams, setTypedGrams] = useState("");

  const hits = useMemo(() => searchFoods(q, 8), [q]);
  const eaten = todayIntake();
  const nameOf = (f: Food) => (locale === "he" ? f.he : f.en);
  const amountText = (f: Food) => {
    const p = portion(f.id);
    return units === "grams" ? `${p.g} ${t.kitchen.gram}` : locale === "he" ? p.he : p.en;
  };

  const std = picked ? portion(picked.id) : null;
  const typed = typedGrams.trim() ? Number(typedGrams.replace(",", ".")) : null;
  const typedOk = typed !== null && Number.isFinite(typed) && typed >= 1 && typed <= 3000;
  const grams = std ? (typed !== null ? (typedOk ? Math.round(typed) : 0) : Math.round(std.g * mult)) : 0;
  const n = picked && grams > 0 ? gramsNutrition(picked, grams) : { kcal: 0, protein: 0 };

  function choose(f: Food) {
    setPicked(f);
    setMult(1);
    setTypedGrams("");
    setLogged("");
  }

  function commit() {
    if (!picked || grams <= 0) return;
    const label = `${nameOf(picked)} · ${grams} ${t.kitchen.gram}`;
    logMeal(label, n.kcal, n.protein);
    setLogged(label);
    setPicked(null);
    setQ("");
  }

  const MULTS = [0.5, 1, 1.5, 2];

  return (
    <Card label={t.kitchen.quickTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.kitchen.quickHint}</Text>
      <View style={{ marginTop: space.sm }}>
        <TextField
          value={q}
          onChangeText={(next) => {
            setQ(next);
            setPicked(null);
          }}
          placeholder={t.kitchen.quickPlaceholder}
        />
      </View>
      {logged ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>
            {logged} · {fill(t.kitchen.loggedToast, { kcal: eaten.kcal, goal: goalKcal })}
          </Text>
        </View>
      ) : null}

      {picked && std ? (
        <View
          style={{
            marginTop: space.sm,
            padding: space.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceAlt,
            gap: space.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <FoodThumb food={picked} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.ink }]}>{nameOf(picked)}</Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>{t.kitchen.amountTitle}</Text>
            </View>
            <Pressable
              onPress={() => setPicked(null)}
              accessibilityRole="button"
              accessibilityLabel={t.kitchen.amountCancel}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={colors.inkFaint} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {MULTS.map((m) => {
              const on = typed === null && mult === m;
              const g = Math.round(std.g * m);
              const label =
                units === "grams"
                  ? `${g} ${t.kitchen.gram}`
                  : scaledHousehold(locale === "he" ? std.he : std.en, m, locale === "he" ? "he" : "en");
              return (
                <SelectTile
                  key={m}
                  selected={on}
                  onPress={() => {
                    setMult(m);
                    setTypedGrams("");
                  }}
                  style={{ paddingVertical: 8, paddingHorizontal: space.md, borderRadius: radius.pill }}
                >
                  <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>{label}</Text>
                </SelectTile>
              );
            })}
          </View>

          <TextInput
            value={typedGrams}
            onChangeText={(v) => setTypedGrams(v.replace(/[^0-9.,]/g, "").slice(0, 5))}
            keyboardType="numeric"
            placeholder={t.kitchen.amountGramsPlaceholder}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel={t.kitchen.amountGramsPlaceholder}
            style={{
              paddingVertical: 10,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: typed !== null && !typedOk ? colors.orangeInk : colors.rule,
              backgroundColor: colors.surface,
              color: colors.ink,
              fontFamily: font.bodyMedium,
              fontSize: 15,
            }}
          />
          {typed !== null && !typedOk ? (
            <Text style={[type.small, { color: colors.orangeInk }]}>{t.kitchen.amountBad}</Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Text style={[type.bodyStrong, { color: metricInk(colors, "calories"), flex: 1 }]}>
              {grams > 0 ? `${grams} ${t.kitchen.gram} · ${n.kcal} ${t.kitchen.kcal} · ${n.protein}${t.kitchen.grams} ${t.kitchen.protein}` : "—"}
            </Text>
          </View>
          <Button icon="add-circle" label={t.kitchen.amountLog} onPress={commit} disabled={grams <= 0} />
        </View>
      ) : null}

      {!picked && q.trim().length > 0 ? (
        <View style={{ gap: 6, marginTop: space.sm }}>
          {hits.length === 0 ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.quickNone}</Text>
          ) : (
            hits.map((f) => {
              const std1 = foodNutrition(f);
              const name = nameOf(f);
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  onPress={() => choose(f)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.accentWash : colors.surfaceAlt,
                  })}
                >
                  <FoodThumb food={f} size={32} />
                  <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
                    {amountText(f)}
                  </Text>
                  <Text style={[type.smallStrong, { color: colors.accent }]}>
                    ≈{std1.kcal} {t.kitchen.kcal}
                  </Text>
                </Pressable>
              );
            })
          )}
          {/* the calculator searches supermarket products and takes any food by type */}
          <Pressable
            onPress={() => router.push({ pathname: "/calc", params: { q: q.trim() } })}
            accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 }}
          >
            <Ionicons name="calculator" size={16} color={colors.accent} />
            <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>{t.kitchen.quickCalc}</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

/** Where the current pace lands you — the answer to "when do I get there?". */
function ProjectionCard() {
  const { t } = useI18n();
  const { colors, type } = useTheme();
  const { state } = useStore();

  const p = projectGoal(state.weighIns, state.profile.goalKg);
  if (!p) return null;

  const line =
    p.kind === "toward"
      ? fill(p.perWeek < 0 ? t.kitchen.projBody : t.kitchen.projGain, {
          rate: Math.abs(p.perWeek),
          togo: p.toGo,
          weeks: p.weeksLeft,
        })
      : fill(p.kind === "plateau" ? t.kitchen.projPlateau : t.kitchen.projAway, { togo: p.toGo });
  return (
    <Card label={t.kitchen.projTitle} tone="accent">
      <Text style={[type.body, { color: colors.ink }]}>{line}</Text>
    </Card>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors, space, type } = useTheme();
  return (
    <Text
      style={[
        type.label,
        { color: colors.inkFaint, textTransform: "uppercase", marginTop: space.sm },
      ]}
    >
      {text}
    </Text>
  );
}

type MealCardProps = {
  meal?: Meal;
  match?: MealMatch;
  have: Set<string>;
  foodsById: Map<string, Food>;
  units: Units;
  /** Switch every card between grams and household units. */
  onUnits: (next: Units) => void;
  /** The goal in force, so each card can say how well it serves it. */
  goal: Goal;
  /** Today's calorie target, so logging can answer with where the day stands. */
  goalKcal: number;
};

function MealCard({ meal, match, have, foodsById, units, onUnits, goal, goalKcal }: MealCardProps) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { logMeal, toggleFavorite, isFavorite, todayIntake } = useStore();
  const eaten = todayIntake();
  // A second tap on this button is a double tap, not a second helping, and the
  // diary that would show the duplicate is off screen — so the card holds an
  // acknowledged state for a moment rather than silently logging twice.
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    if (!logged) return;
    const id = setTimeout(() => setLogged(false), 5000);
    return () => clearTimeout(id);
  }, [logged]);
  const m = match?.meal ?? meal!;
  const starred = isFavorite(m.id);
  const copy = locale === "he" ? m.he : m.en;
  const foods = m.uses.map((id) => foodsById.get(id)).filter((f): f is Food => !!f);

  const noteLabel: Record<MealNote, string> = {
    light: t.kitchen.noteLight,
    protein: t.kitchen.noteProtein,
    veg: t.kitchen.noteVeg,
    balanced: t.kitchen.noteBalanced,
    hearty: t.kitchen.noteHearty,
  };
  const slotLabel: Record<MealSlot, string> = {
    breakfast: t.kitchen.slotBreakfast,
    lunch: t.kitchen.slotLunch,
    dinner: t.kitchen.slotDinner,
    snack: t.kitchen.slotSnack,
  };
  const note = primaryNote(m);
  // How well this dish serves the chosen goal. This is the number that makes
  // the goal chips visible: it is on every card and it moves the moment the
  // goal changes, rather than only quietly re-sorting the list.
  const fit = Math.round(goalFit(m, goal) * 100);
  const goalName: Record<Goal, string> = {
    cut: t.kitchen.goalCut,
    recomp: t.kitchen.goalRecomp,
    maintain: t.kitchen.goalMaintain,
    bulk: t.kitchen.goalBulk,
  };
  const fitColor = fit >= 70 ? colors.accent : fit >= 45 ? colors.orangeInk : colors.inkFaint;

  return (
    <Card>
      <View style={{ borderRadius: radius.lg, overflow: "hidden", marginBottom: space.sm }}>
        <MealPhoto meal={m} foods={foods} haveIds={have} width={320} height={150} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
        <Pressable
          onPress={() => toggleFavorite(m.id)}
          accessibilityRole="button"
          accessibilityLabel={t.kitchen.a11yFavorite}
          accessibilityState={{ selected: starred }}
          hitSlop={8}
        >
          <Ionicons
            name={starred ? "star" : "star-outline"}
            size={22}
            color={starred ? colors.orangeInk : colors.inkFaint}
          />
        </Pressable>
        <Text style={[type.title, { color: colors.ink }]}>{copy.title}</Text>
        <View
          style={{
            backgroundColor: colors.accentWash,
            borderRadius: radius.pill,
            paddingVertical: 3,
            paddingHorizontal: 9,
          }}
        >
          <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
            {noteLabel[note]} · {slotLabel[m.slot]}
          </Text>
        </View>
      </View>

      {/* how well this dish serves the goal that is switched on right now */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 6 }}>
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.surfaceAlt,
            overflow: "hidden",
          }}
        >
          <View style={{ width: `${fit}%`, height: "100%", backgroundColor: fitColor }} />
        </View>
        <Text style={[type.small, { color: fitColor, fontWeight: "700" }]}>
          {fill(t.kitchen.fitFor, { goal: goalName[goal], pct: fit })}
        </Text>
      </View>

      <Text style={[type.body, { color: colors.inkSoft, marginTop: 4 }]}>{copy.how}</Text>

      {/* ingredients with amounts — grams for those who weigh, or household
          units — and what each one comes to, so the total below is visibly
          the sum of these rows */}
      <View style={{ marginTop: space.md, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
            {t.kitchen.ingredients}
          </Text>
          <Pressable
            onPress={() => onUnits(units === "grams" ? "household" : "grams")}
            accessibilityRole="button"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.accent} />
            <Text style={[type.smallStrong, { color: colors.accent }]}>
              {units === "grams" ? t.kitchen.showHousehold : t.kitchen.showGrams}
            </Text>
          </Pressable>
        </View>
        {foods.map((f) => {
          const p = mealAmount(m, f.id);
          const amount = units === "grams" ? `${p.g} ${t.kitchen.gram}` : (locale === "he" ? p.he : p.en);
          const each = gramsNutrition(f, p.g);
          return (
            <View
              key={f.id}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
            >
              <FoodThumb food={f} size={26} />
              <Text style={[type.small, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                {locale === "he" ? f.he : f.en}
              </Text>
              <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{amount}</Text>
              <Text style={[type.small, { color: colors.inkFaint, minWidth: 52, textAlign: "left" }]}>
                {each.kcal} {t.kitchen.kcal}
              </Text>
            </View>
          );
        })}
      </View>

      {/* nutrition */}
      <View style={{ flexDirection: "row", gap: space.xl, marginTop: space.md }}>
        <View>
          <Text style={[type.figure, { color: metricInk(colors, "calories") }]}>≈{m.kcal}</Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.kcal}</Text>
        </View>
        <View>
          <Text style={[type.figure, { color: metricInk(colors, "protein") }]}>
            {m.protein}
            {t.kitchen.grams}
          </Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.protein}</Text>
        </View>
      </View>

      {/* log it to today's diary */}
      <Button
        icon={logged ? "checkmark-circle" : "add-circle"}
        label={logged ? t.kitchen.alreadyLogged : t.kitchen.logMeal}
        tone="quiet"
        disabled={logged}
        onPress={() => {
          logMeal(copy.title, m.kcal, m.protein);
          setLogged(true);
        }}
        style={{ marginTop: space.md }}
      />
      {logged ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>
            {fill(t.kitchen.loggedToast, { kcal: eaten.kcal, goal: goalKcal })}
          </Text>
        </View>
      ) : null}

      {/* what to buy */}
      {match && match.missing.length > 0 ? (
        <View style={{ marginTop: space.md, gap: 4 }}>
          <Text style={[type.label, { color: colors.orangeInk, textTransform: "uppercase" }]}>
            {t.kitchen.missingLabel}
          </Text>
          <Text style={[type.body, { color: colors.ink }]}>
            {match.missing.map((f) => (locale === "he" ? f.he : f.en)).join(" · ")}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
