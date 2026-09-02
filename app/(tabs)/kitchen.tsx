import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MealPhoto } from "@/components/MealPhoto";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { useI18n } from "@/i18n";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  FOODS,
  adhocFood,
  dailyTarget,
  portion,
  primaryNote,
  readPantryFull,
  slotForHour,
  starterMeals,
  suggestMeals,
  yourPlate,
  type Food,
  type Goal,
  type Meal,
  type MealMatch,
  type MealNote,
  type MealSlot,
} from "@/kitchen";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

const GOALS: Goal[] = ["cut", "recomp", "maintain", "bulk"];

export default function KitchenScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, setPantry, setNutritionGoal } = useStore();

  const [draft, setDraft] = useState(state.pantry ?? "");
  const [editing, setEditing] = useState(!state.pantry);
  // The goal is remembered across opens rather than reset each time.
  const goal: Goal = state.nutritionGoal ?? "cut";
  const setGoal = setNutritionGoal;
  // How amounts read: everyday household units, or exact grams for anyone who
  // weighs their food.
  const [units, setUnits] = useState<"household" | "grams">("household");

  const slot = slotForHour(new Date().getHours());
  const pantryText = state.pantry ?? "";

  const result = useMemo(
    () => suggestMeals(pantryText, { goal, slot }),
    [pantryText, goal, slot],
  );
  // Everything the list named — recognised foods, plus anything unknown turned
  // into an ad-hoc ingredient — so nothing the person typed is dropped.
  const full = useMemo(() => readPantryFull(pantryText), [pantryText]);
  const adhocs = useMemo(() => full.extras.map(adhocFood), [full.extras]);
  const allItems = useMemo(() => [...full.known, ...adhocs], [full.known, adhocs]);
  // A plate built from exactly what the person has, so any list yields a meal.
  const plate = useMemo(
    () => (allItems.length >= 2 ? yourPlate(allItems, slot) : null),
    [allItems, slot],
  );
  // Show only a handful of the best curated picks. Each card fetches its own
  // photo on demand — a dozen at once load slowly and half stay placeholders.
  const ready = useMemo(() => result.ready.slice(0, 3), [result.ready]);
  const almost = useMemo(() => result.almost.slice(0, 3), [result.almost]);
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

  const hasList = pantryText.trim().length > 0;
  const showAny = Boolean(plate) || ready.length > 0 || almost.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.kitchen.heading} subtitle={t.kitchen.body}>
        {/* the list */}
        {editing || !hasList ? (
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
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f.color }} />
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
        )}

        {/* goal picker */}
        <Card label={t.kitchen.goalTitle}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {GOALS.map((g) => {
              const on = goal === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGoal(g)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexGrow: 1,
                    flexBasis: "47%",
                    alignItems: "center",
                    gap: 2,
                    paddingVertical: space.md,
                    paddingHorizontal: space.xs,
                    borderRadius: radius.lg,
                    backgroundColor: on ? colors.accent : colors.surfaceAlt,
                  }}
                >
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
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* how amounts are shown */}
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
          {(["household", "grams"] as const).map((u) => {
            const on = units === u;
            return (
              <Pressable
                key={u}
                onPress={() => setUnits(u)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.pill,
                  backgroundColor: on ? colors.accent : colors.surfaceAlt,
                }}
              >
                <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>
                  {u === "grams" ? t.kitchen.unitsGrams : t.kitchen.unitsHousehold}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* today: targets, water and the food log */}
        <TodayCard goal={goal} />

        {/* meals */}
        {!hasList ? (
          <View style={{ gap: space.md }}>
            <Card label={t.kitchen.starterTitle} tone="accent">
              <Text style={[type.body, { color: colors.ink }]}>{t.kitchen.starterBody}</Text>
            </Card>
            {starterMeals(goal).map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                have={new Set<string>()}
                foodsById={foodsById}
                units={units}
              />
            ))}
          </View>
        ) : !showAny ? (
          <Card tone="amber">
            <Text style={[type.body, { color: colors.ink }]}>{t.kitchen.nothing}</Text>
          </Card>
        ) : (
          <>
            {plate ? (
              <>
                <SectionLabel text={t.kitchen.yourPlate} />
                <MealCard meal={plate} have={haveIds} foodsById={foodsById} units={units} />
              </>
            ) : null}

            {ready.length > 0 ? <SectionLabel text={t.kitchen.readyTitle} /> : null}
            {ready.map((m) => (
              <MealCard key={m.meal.id} match={m} have={haveIds} foodsById={foodsById} units={units} />
            ))}

            {almost.length > 0 ? <SectionLabel text={t.kitchen.almostTitle} /> : null}
            {almost.map((m) => (
              <MealCard key={m.meal.id} match={m} have={haveIds} foodsById={foodsById} units={units} />
            ))}
          </>
        )}

        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.kitchen.estimateNote}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const WATER_GOAL = 8;

function Bar({ pct, over }: { pct: number; over: boolean }) {
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
          backgroundColor: over ? colors.amber : colors.accent,
        }}
      />
    </View>
  );
}

function TodayCard({ goal }: { goal: Goal }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, todayIntake, removeMeal, addWater, todayWater } = useStore();

  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const target = dailyTarget(weightKg, goal);
  const eaten = todayIntake();
  const water = todayWater();

  const kcalLeft = target.kcal - eaten.kcal;
  const proLeft = target.protein - eaten.protein;
  const kcalPct = Math.min(100, Math.round((eaten.kcal / target.kcal) * 100));
  const proPct = Math.min(100, Math.round((eaten.protein / target.protein) * 100));

  return (
    <Card label={t.kitchen.todayTitle}>
      {/* calories */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={[type.smallStrong, { color: colors.ink }]}>{t.kitchen.targetKcal}</Text>
        <Text style={[type.small, { color: colors.inkSoft }]}>
          {eaten.kcal} / {target.kcal} {t.kitchen.kcal}
        </Text>
      </View>
      <Bar pct={kcalPct} over={kcalLeft < 0} />
      <Text style={[type.small, { color: kcalLeft < 0 ? colors.amber : colors.inkFaint, marginTop: 4 }]}>
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
        <Text style={[type.small, { color: colors.inkSoft }]}>
          {eaten.protein} / {target.protein} {t.kitchen.grams}
        </Text>
      </View>
      <Bar pct={proPct} over={false} />
      <Text style={[type.small, { color: colors.inkFaint, marginTop: 4 }]}>
        {proLeft > 0 ? `${t.kitchen.remaining}: ${proLeft} ${t.kitchen.grams}` : t.kitchen.over}
      </Text>

      {/* water */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: space.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="water" size={18} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.ink }]}>
            {water} / {WATER_GOAL} {t.kitchen.cups}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pressable
            onPress={() => addWater(-1)}
            accessibilityRole="button"
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="remove" size={20} color={colors.ink} />
          </Pressable>
          <Pressable
            onPress={() => addWater(1)}
            accessibilityRole="button"
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={20} color={colors.onAccent} />
          </Pressable>
        </View>
      </View>

      {/* logged today */}
      <View style={{ marginTop: space.lg, gap: 6 }}>
        <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
          {t.kitchen.loggedTitle}
        </Text>
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
              <Pressable onPress={() => removeMeal(it.id)} accessibilityRole="button" hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.inkFaint} />
              </Pressable>
            </View>
          ))
        )}
      </View>
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
  units: "household" | "grams";
};

function MealCard({ meal, match, have, foodsById, units }: MealCardProps) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { logMeal } = useStore();
  const m = match?.meal ?? meal!;
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

  return (
    <Card>
      <View style={{ borderRadius: radius.lg, overflow: "hidden", marginBottom: space.sm }}>
        <MealPhoto meal={m} foods={foods} haveIds={have} width={320} height={150} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
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

      <Text style={[type.body, { color: colors.inkSoft, marginTop: 4 }]}>{copy.how}</Text>

      {/* ingredients with amounts — grams for those who weigh, or units */}
      <View style={{ marginTop: space.md, gap: 4 }}>
        <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
          {t.kitchen.ingredients}
        </Text>
        {foods.map((f) => {
          const p = portion(f.id);
          const amount = units === "grams" ? `${p.g} ${t.kitchen.gram}` : (locale === "he" ? p.he : p.en);
          return (
            <View
              key={f.id}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.color }} />
              <Text style={[type.small, { color: colors.ink, flex: 1 }]}>
                {locale === "he" ? f.he : f.en}
              </Text>
              <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{amount}</Text>
            </View>
          );
        })}
      </View>

      {/* nutrition */}
      <View style={{ flexDirection: "row", gap: space.xl, marginTop: space.md }}>
        <View>
          <Text style={[type.figure, { color: colors.ink }]}>≈{m.kcal}</Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.kcal}</Text>
        </View>
        <View>
          <Text style={[type.figure, { color: colors.ink }]}>
            {m.protein}
            {t.kitchen.grams}
          </Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.protein}</Text>
        </View>
      </View>

      {/* log it to today's diary */}
      <Button
        icon="add-circle"
        label={t.kitchen.logMeal}
        tone="quiet"
        onPress={() => logMeal(copy.title, m.kcal, m.protein)}
        style={{ marginTop: space.md }}
      />

      {/* what to buy */}
      {match && match.missing.length > 0 ? (
        <View style={{ marginTop: space.md, gap: 4 }}>
          <Text style={[type.label, { color: colors.amber, textTransform: "uppercase" }]}>
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
