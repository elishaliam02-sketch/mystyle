import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { MealPhoto } from "@/components/MealPhoto";
import { PillButton } from "@/components/PillButton";
import { MAX_CONTENT, ScreenBand } from "@/components/Screen";
import { SelectTile } from "@/components/SelectTile";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { dietList, readPantry, STAPLES, type Meal, type MealSlot } from "@/kitchen";
import { BUNDLED_MEAL_PHOTOS } from "@/kitchen/mealPhotoAssets";
import { bookSize, foodsOf, searchBook, type BookFilter } from "@/kitchen/book";
import { RECIPES } from "@/kitchen/recipes";
import { useStore } from "@/store";
import { metricInk, useTheme } from "@/theme";
import { leave } from "@/ui/nav";

/**
 * The recipe book: every dish in the kitchen, searchable by name or by what is
 * in it, narrowed by meal and by the kind of cooking (quick, no-cook, for
 * kids, make-ahead…). The person's diet setting (kosher, vegetarian, gluten-
 * free) applies here as everywhere, and says so; one tap shows everything.
 */
export default function RecipeBookScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state } = useStore();
  const diet = state.dietFilter ?? "all";
  const diets = dietList(diet);
  const favorites = state.favorites ?? [];

  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<MealSlot | "all">("all");
  const [filter, setFilter] = useState<BookFilter | null>(null);
  const [anyDiet, setAnyDiet] = useState(false);
  const [only, setOnly] = useState<"starred" | "canMake" | null>(null);

  // What is in the kitchen, as the daily menu reads it — so "what can I make
  // now" here agrees with the menu, staples and stand-ins included.
  const have = useMemo(
    () => (state.pantry?.trim() ? new Set([...readPantry(state.pantry).map((f) => f.id), ...STAPLES]) : null),
    [state.pantry],
  );

  const rows = useMemo(
    () => searchBook({ query, slot, filter, diet, anyDiet, only, favorites, have }),
    [query, slot, filter, diet, anyDiet, only, favorites, have],
  );
  const total = useMemo(() => bookSize(anyDiet ? null : diet), [diet, anyDiet]);

  const slotLabel: Record<MealSlot, string> = {
    breakfast: t.kitchen.slotBreakfast,
    lunch: t.kitchen.slotLunch,
    dinner: t.kitchen.slotDinner,
    snack: t.kitchen.slotSnack,
  };
  const filterLabel: Record<BookFilter, string> = {
    quick: t.recipes.tagQuick,
    protein: t.recipes.tagProtein,
    veggie: t.recipes.tagVeggie,
    noCook: t.recipes.tagNoCook,
    kids: t.recipes.tagKids,
    mealPrep: t.recipes.tagMealPrep,
    onePan: t.recipes.tagOnePan,
    budget: t.recipes.tagBudget,
  };
  const dietLabel: Record<string, string> = {
    kosher: t.kitchen.dietKosher,
    vegetarian: t.kitchen.dietVeg,
    glutenFree: t.kitchen.dietGf,
  };

  const surprise = () => {
    const pool = rows.length > 0 ? rows : searchBook({ diet });
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) router.push({ pathname: "/recipe/[id]", params: { id: pick.id } });
  };

  const open = useCallback(
    (id: string) => router.push({ pathname: "/recipe/[id]", params: { id } }),
    [router],
  );
  const renderItem = useCallback(
    ({ item }: { item: Meal }) => (
      <RecipeRow
        meal={item}
        locale={locale === "he" ? "he" : "en"}
        starred={favorites.includes(item.id)}
        slotText={slotLabel[item.slot]}
        onOpen={open}
      />
    ),
    // slotLabel is rebuilt from t each render; t only changes with the locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, favorites, open],
  );

  // The controls ride at the top of the list, so the whole screen scrolls as
  // one — but the rows below them are virtualized: only what is on screen is
  // drawn. 137 rows each decoding a full-size photo is what made the book slow
  // to open and stutter when scrolled.
  const header = (
    <View>
      <ScreenBand
        eyebrow={fill(t.recipes.count, { n: total })}
        title={t.recipes.heading}
        subtitle={t.recipes.body}
        aside={
          <Pressable
            onPress={() => leave(router)}
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
        }
      />
      <View style={[centered, { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg, paddingBottom: space.sm }]}>
        <TextField value={query} onChangeText={setQuery} placeholder={t.recipes.search} />

        {/* which meal */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          <Filter label={t.recipes.all} on={slot === "all"} onPress={() => setSlot("all")} />
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((s) => (
            <Filter key={s} label={slotLabel[s]} on={slot === s} onPress={() => setSlot(slot === s ? "all" : s)} />
          ))}
        </View>

        {/* what kind of cooking */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {(["quick", "protein", "veggie", "noCook", "kids", "mealPrep", "onePan", "budget"] as const).map((f) => (
            <Filter key={f} label={filterLabel[f]} on={filter === f} onPress={() => setFilter(filter === f ? null : f)} />
          ))}
        </View>

        {/* from my kitchen, and my favourites — the two ways a person
            actually decides what to cook tonight */}
        {have || favorites.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {have ? (
              <Filter
                label={t.recipes.canMake}
                on={only === "canMake"}
                onPress={() => setOnly(only === "canMake" ? null : "canMake")}
              />
            ) : null}
            {favorites.length > 0 ? (
              <Filter
                label={fill(t.recipes.starred, { n: favorites.length })}
                on={only === "starred"}
                onPress={() => setOnly(only === "starred" ? null : "starred")}
              />
            ) : null}
          </View>
        ) : null}

        {diets.length > 0 ? (
          <Pressable onPress={() => setAnyDiet(!anyDiet)} accessibilityRole="button">
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {anyDiet ? t.kitchen.dietPickAny : fill(t.recipes.dietNote, { diets: diets.map((d) => dietLabel[d]).join(" · ") })}
              <Text style={[type.smallStrong, { color: colors.accent }]}>  {anyDiet ? "↺" : t.recipes.all}</Text>
            </Text>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[type.small, { color: colors.inkFaint }]}>{fill(t.recipes.showing, { n: rows.length })}</Text>
          <PillButton tone="soft" icon="shuffle" label={t.recipes.surprise} onPress={surprise} />
        </View>

        {rows.length === 0 ? (
          <Card tone="orange">
            <Text style={[type.body, { color: colors.ink }]}>{t.recipes.none}</Text>
          </Card>
        ) : null}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ground }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={rows}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={{ height: space.xxl }} />}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        style={{ flex: 1 }}
      />
    </KeyboardAvoidingView>
  );
}

const centered = { width: "100%" as const, maxWidth: MAX_CONTENT, alignSelf: "center" as const };

function Separator() {
  return <View style={{ height: 8 }} />;
}

const THUMB = 76;

/** One recipe in the list. Memoized: a row only redraws when its own data changes. */
const RecipeRow = memo(function RecipeRow({
  meal: m,
  locale,
  starred,
  slotText,
  onOpen,
}: {
  meal: Meal;
  locale: "he" | "en";
  starred: boolean;
  slotText: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const r = RECIPES[m.id]!;
  const copy = locale === "he" ? m.he : m.en;
  const photo = BUNDLED_MEAL_PHOTOS[m.id];
  return (
    <View style={[centered, { paddingHorizontal: space.lg }]}>
      <Pressable
        onPress={() => onOpen(m.id)}
        accessibilityRole="button"
        accessibilityLabel={copy.title}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.sm,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.rule,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View style={{ width: THUMB, height: THUMB, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceAlt }}>
          {photo ? (
            // Decoded at thumbnail size on Android rather than at 640 × 480.
            <Image source={photo.source} resizeMethod="resize" fadeDuration={120} style={{ width: THUMB, height: THUMB }} />
          ) : (
            <MealPhoto meal={m} foods={foodsOf(m)} haveIds={new Set<string>()} width={THUMB} height={THUMB} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[type.bodyStrong, { color: colors.ink, flexShrink: 1 }]} numberOfLines={2}>
              {copy.title}
            </Text>
            {starred ? <Ionicons name="star" size={14} color={colors.orangeInk} /> : null}
          </View>
          <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
            {slotText} · ⏱ {fill(t.recipes.minutes, { n: r.minutes })}
          </Text>
          <Text style={[type.small, { color: colors.inkSoft }]}>
            <Text style={{ color: metricInk(colors, "calories"), fontWeight: "700" }}>≈{m.kcal}</Text> {t.kitchen.kcal} ·{" "}
            <Text style={{ color: metricInk(colors, "protein"), fontWeight: "700" }}>{m.protein}</Text>
            {t.kitchen.grams} {t.kitchen.protein}
          </Text>
        </View>
        <Ionicons name={locale === "he" ? "chevron-back" : "chevron-forward"} size={18} color={colors.inkFaint} />
      </Pressable>
    </View>
  );
});

function Filter({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors, radius, type, space } = useTheme();
  return (
    <SelectTile
      selected={on}
      onPress={onPress}
      accessibilityLabel={label}
      style={{ paddingVertical: 7, paddingHorizontal: space.md, borderRadius: radius.pill }}
    >
      <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.inkSoft }]}>{label}</Text>
    </SelectTile>
  );
}
