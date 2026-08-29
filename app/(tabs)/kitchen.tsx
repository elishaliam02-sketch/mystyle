import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MealPhoto } from "@/components/MealPhoto";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { useI18n } from "@/i18n";
import {
  FOODS,
  primaryNote,
  slotForHour,
  starterMeals,
  suggestMeals,
  type Food,
  type Goal,
  type Meal,
  type MealMatch,
  type MealNote,
  type MealSlot,
} from "@/kitchen";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

const GOALS: Goal[] = ["cut", "maintain", "bulk"];

export default function KitchenScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, setPantry } = useStore();

  const [draft, setDraft] = useState(state.pantry ?? "");
  const [editing, setEditing] = useState(!state.pantry);
  const [goal, setGoal] = useState<Goal>("cut");

  const slot = slotForHour(new Date().getHours());
  const pantryText = state.pantry ?? "";

  const result = useMemo(
    () => suggestMeals(pantryText, { goal, slot }),
    [pantryText, goal, slot],
  );
  const haveIds = useMemo(() => new Set(result.pantry.map((f) => f.id)), [result.pantry]);
  const foodsById = useMemo(() => new Map(FOODS.map((f) => [f.id, f])), []);

  function build() {
    setPantry(draft.trim());
    setEditing(false);
  }

  const goalLabel: Record<Goal, { label: string; hint: string }> = {
    cut: { label: t.kitchen.goalCut, hint: t.kitchen.goalCutHint },
    maintain: { label: t.kitchen.goalMaintain, hint: t.kitchen.goalMaintainHint },
    bulk: { label: t.kitchen.goalBulk, hint: t.kitchen.goalBulkHint },
  };

  const hasList = pantryText.trim().length > 0;
  const showAny = result.ready.length > 0 || result.almost.length > 0;

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
            {result.pantry.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {result.pantry.map((f) => (
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
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {GOALS.map((g) => {
              const on = goal === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGoal(g)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1,
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
              />
            ))}
          </View>
        ) : !showAny ? (
          <Card tone="amber">
            <Text style={[type.body, { color: colors.ink }]}>{t.kitchen.nothing}</Text>
          </Card>
        ) : (
          <>
            {result.ready.length > 0 ? (
              <SectionLabel text={t.kitchen.readyTitle} />
            ) : null}
            {result.ready.map((m) => (
              <MealCard key={m.meal.id} match={m} have={haveIds} foodsById={foodsById} />
            ))}

            {result.almost.length > 0 ? (
              <SectionLabel text={t.kitchen.almostTitle} />
            ) : null}
            {result.almost.map((m) => (
              <MealCard key={m.meal.id} match={m} have={haveIds} foodsById={foodsById} />
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
};

function MealCard({ meal, match, have, foodsById }: MealCardProps) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
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
