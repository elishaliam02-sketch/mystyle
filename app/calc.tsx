import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { Screen } from "@/components/Screen";
import { FoodThumb } from "@/components/FoodThumb";
import { TextField } from "@/components/TextField";
import {
  addFood, addGrams, cookedFirst, fromAnalysis, label as calcLabel, macros, portions, removeFood, setGrams, step, total,
  type CalcItem, type ReadItem,
} from "@/kitchen/calc";
import { adhocFood, type FoodTag } from "@/kitchen/data";
import { foodFromFact, searchFoodFacts, type FactHit } from "@/kitchen/foodfacts";
import { dailyTarget, searchFoods } from "@/kitchen";
import { recentMeals } from "@/kitchen/recent";
import { mentionsAmount, parseEaten } from "@/coach/logfood";
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
  const { colors, space, radius, type, font } = useTheme();
  const { logMeal, state, goal: goalOf, todayIntake, todayKey } = useStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ items?: string; q?: string }>();

  // A photograph's reading arrives as a parameter so this screen stays the one
  // place a meal is edited, rather than the scanner growing a second editor.
  const [items, setItems] = useState<CalcItem[]>(() => {
    if (!params.items) return [];
    try {
      const parsed: unknown = JSON.parse(String(params.items));
      if (!Array.isArray(parsed)) return [];
      return fromAnalysis(parsed as ReadItem[], locale);
    } catch {
      // A malformed parameter is a deep link someone mangled, not a reason to
      // show a broken screen: open the calculator empty and let them type.
      return [];
    }
  });
  // A word the kitchen's quick log could not find arrives here to be looked up.
  const [q, setQ] = useState(() => (typeof params.q === "string" ? params.q.slice(0, 60) : ""));
  // An Open Food Facts lookup for the word in the search box. It only ever
  // runs from the explicit "search Open Food Facts" button — that press is the
  // consent for sending the typed word — and belongs to the query it was made
  // for, so a stale answer never shows under a new word.
  const [facts, setFacts] = useState<
    { q: string; phase: "loading" | "done" | "fail"; hits: FactHit[] } | null
  >(null);

  async function lookUp() {
    const query = q.trim();
    if (!query) return;
    setFacts({ q: query, phase: "loading", hits: [] });
    const found = await searchFoodFacts(query, locale === "he" ? "he" : "en");
    setFacts((cur) =>
      cur && cur.q === query
        ? { q: query, phase: found === null ? "fail" : "done", hits: found ?? [] }
        : cur,
    );
  }
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const hits = useMemo(() => (q.trim() ? cookedFirst(searchFoods(q, 8)) : []), [q]);
  // A whole meal typed in one go — "2 ביצים ופרוסת לחם", "חזה עוף 200 גרם" —
  // read into rows with their amounts, so nobody taps five foods one by one.
  // Shown when there is more than one food or an amount to honour; a single
  // bare word stays an ordinary search.
  const read = useMemo(() => {
    const text = q.trim();
    if (!text) return null;
    const meal = parseEaten(text, locale === "he" ? "he" : "en");
    if (!meal) return null;
    return meal.items.length >= 2 || mentionsAmount(text) ? meal : null;
  }, [q, locale]);
  function addRead() {
    if (!read) return;
    setItems((prev) => read.items.reduce((acc, it) => addGrams(acc, it.food, it.grams), prev));
    setQ("");
    setFacts(null);
  }
  // Whether a hit holds the whole query. When the only hits are foods named
  // inside it (a brand, a dish), the product lookup stays on offer.
  const direct = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hits.some((f) => [f.he, f.en, ...f.match].some((term) => term.toLowerCase().includes(needle)));
  }, [hits, q]);
  const sums = total(items);
  const split = macros(items);

  const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
  const target = dailyTarget(weightKg, goalOf());
  const eaten = todayIntake();

  // The meals already in the diary, offered back for one-tap re-logging. Read
  // from the same stored intake the diary is drawn from, so it can never show a
  // meal that was not really eaten.
  const today = todayKey();
  const recent = useMemo(() => recentMeals(state.intake, today, 6), [state.intake, today]);
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
          {split ? (
            <Text style={[type.small, { color: ON_HERO_SOFT }]}>
              {fill(t.kitchen.calcMacros, { carbs: split.carbs, fat: split.fat })}
              {split.partial ? ` (${t.kitchen.calcMacrosPartial})` : ""}
            </Text>
          ) : null}
          <Text style={[type.small, { color: ON_HERO_SOFT }]}>
            {leftAfter >= 0
              ? `${t.kitchen.remaining}: ${leftAfter} ${t.kitchen.kcal}`
              : t.kitchen.over}
          </Text>
          <Text style={[type.small, { color: ON_HERO_SOFT, marginTop: 2 }]}>
            {t.kitchen.calcEstimate}
          </Text>
        </HeroCard>

        {recent.length > 0 ? (
          <Card label={t.kitchen.recentTitle}>
            <Text style={[type.small, { color: colors.inkSoft }]}>{t.kitchen.recentBody}</Text>
            <View style={{ gap: 6, marginTop: space.sm }}>
              {recent.map((m) => (
                <Pressable
                  key={`${m.label}-${m.kcal}`}
                  onPress={() => {
                    logMeal(m.label, m.kcal, m.protein);
                    setSaved(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: 9,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.accentWash : colors.surfaceAlt,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text style={[type.small, { color: colors.inkFaint }]}>
                      {m.kcal} {t.kitchen.kcal} · {m.protein}
                      {t.kitchen.grams} {t.kitchen.protein}
                      {m.count > 1 ? ` · ${fill(t.kitchen.recentOften, { n: m.count })}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        <Card label={t.kitchen.calcSearch}>
          <TextField
            value={q}
            onChangeText={(v) => {
              setQ(v);
              setFacts(null);
              if (saved) setSaved(false);
            }}
            placeholder={t.kitchen.calcSearchHint}
            maxLength={120}
            onSubmitEditing={() => {
              if (read) addRead();
              else if (hits.length > 0) {
                setItems((prev) => addFood(prev, hits[0]!));
                setQ("");
              }
            }}
          />
          {read ? (
            <View
              style={{
                marginTop: space.sm,
                padding: space.md,
                gap: 6,
                borderRadius: radius.md,
                backgroundColor: colors.accentWash,
                borderWidth: 1,
                borderColor: colors.accent,
              }}
            >
              <Text style={[type.smallStrong, { color: colors.accent }]}>{t.kitchen.calcReadTitle}</Text>
              {read.items.map((it) => (
                <View key={it.food.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <FoodThumb food={it.food} size={26} />
                  <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                    {locale === "he" ? it.food.he : it.food.en}
                  </Text>
                  <Text style={[type.small, { color: colors.inkSoft }]}>
                    {it.grams} {t.kitchen.calcGrams} · {it.kcal} {t.kitchen.kcal}
                  </Text>
                </View>
              ))}
              <Button
                icon="add"
                label={fill(t.kitchen.calcReadAdd, { kcal: `${read.kcal} ${t.kitchen.kcal}` })}
                onPress={addRead}
                style={{ marginTop: 4 }}
              />
              <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.calcReadEdit}</Text>
            </View>
          ) : null}
          {hits.length > 0 && !read ? (
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
                  <FoodThumb food={f} size={28} />
                  <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                    {locale === "he" ? f.he : f.en}
                  </Text>
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {q.trim().length > 0 && !direct && !read ? (
            // The library is ~130 foods; a plate is not. When nothing matches,
            // the typed word is still loggable — pick the closest category so
            // the estimate lands in the right ballpark, the way the pantry and
            // the photo path already accept a food the app has never seen.
            <View style={{ gap: 6, marginTop: space.sm }}>
              {!facts || facts.q !== q.trim() ? (
                <>
                  <Pressable
                    onPress={() => void lookUp()}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.sm,
                      paddingVertical: 12,
                      paddingHorizontal: space.md,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? colors.accent : colors.accentWash,
                    })}
                  >
                    <Ionicons name="search" size={18} color={colors.accent} />
                    <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>
                      {fill(t.kitchen.calcFactsSearch, { q: q.trim() })}
                    </Text>
                  </Pressable>
                  <Text style={[type.small, { color: colors.inkFaint }]}>{t.kitchen.calcFactsNote}</Text>
                </>
              ) : facts.phase === "loading" ? (
                <Text style={[type.small, { color: colors.inkSoft }]}>{t.kitchen.calcFactsLoading}</Text>
              ) : facts.hits.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={[type.label, { color: colors.inkFaint }]}>{t.kitchen.calcFactsSource}</Text>
                  {facts.hits.map((hit) => (
                    <Pressable
                      key={hit.code}
                      onPress={() => {
                        setItems((prev) => addFood(prev, foodFromFact(hit)));
                        setQ("");
                        setFacts(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={hit.brand ? `${hit.name} · ${hit.brand}` : hit.name}
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
                      <View style={{ flex: 1 }}>
                        <Text style={[type.body, { color: colors.ink }]} numberOfLines={1}>
                          {hit.name}
                          {hit.brand ? (
                            <Text style={{ color: colors.inkFaint }}>{` · ${hit.brand}`}</Text>
                          ) : null}
                        </Text>
                        <Text style={[type.small, { color: colors.inkSoft }]}>
                          {fill(t.kitchen.calcFactsPer100, { kcal: hit.per100.kcal })}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={22} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {/* Library foods were found inside a longer query ("חומוס אחלה"):
                  the search above is offered for the exact product, but the
                  add-by-type fallback would only be noise under real matches. */}
              {hits.length === 0 ? (
                <>
                  <Text style={[type.small, { color: colors.inkSoft }]}>
                    {facts && facts.q === q.trim() && facts.phase === "fail"
                      ? t.kitchen.calcFactsFail
                      : facts && facts.q === q.trim() && facts.phase === "done" && facts.hits.length === 0
                        ? t.kitchen.calcFactsNone
                        : fill(t.kitchen.calcAddUnknown, { q: q.trim() })}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                    {([
                      ["protein", t.kitchen.calcCatProtein],
                      ["carb", t.kitchen.calcCatCarb],
                      ["veg", t.kitchen.calcCatVeg],
                      ["fat", t.kitchen.calcCatFat],
                    ] as [FoodTag, string][]).map(([tag, label]) => (
                      <Pressable
                        key={tag}
                        onPress={() => {
                          setItems((prev) => addFood(prev, adhocFood(q.trim().slice(0, 40), tag)));
                          setQ("");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${q.trim()} · ${label}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: radius.pill,
                          backgroundColor: pressed ? colors.accent : colors.accentWash,
                        })}
                      >
                        <Ionicons name="add" size={15} color={colors.accent} />
                        <Text style={[type.smallStrong, { color: colors.accent }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
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
                  <FoodThumb food={item.food} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                      {locale === "he" ? item.food.he : item.food.en}
                    </Text>
                    {editing === item.food.id ? (
                      // the ± steppers move by whole portions; typing here is
                      // the escape hatch for an exact weight (180 g, not "two
                      // portions of ninety")
                      <TextInput
                        value={String(item.grams)}
                        onChangeText={(v) => {
                          const n = Number(v.replace(/[^0-9]/g, ""));
                          setItems((prev) => setGrams(prev, item.food.id, Number.isFinite(n) ? n : 0));
                        }}
                        onBlur={() => setEditing(null)}
                        autoFocus
                        keyboardType="number-pad"
                        accessibilityLabel={t.kitchen.calcEditGrams}
                        style={{
                          alignSelf: "flex-start",
                          minWidth: 64,
                          marginTop: 2,
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.accent,
                          color: colors.ink,
                          fontFamily: font.bodyMedium,
                          fontSize: 14,
                          textAlign: "center",
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setEditing(item.food.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t.kitchen.calcEditGrams}
                        hitSlop={6}
                      >
                        {item.food.src ? (
                          <Text style={[type.label, { color: colors.inkFaint }]}>
                            {item.food.src === "off" ? t.kitchen.calcFactsSource : t.kitchen.calcAiSource}
                          </Text>
                        ) : null}
                        <Text style={[type.small, { color: colors.inkFaint }]}>
                          {item.grams} {t.kitchen.calcGrams} ·{" "}
                          {portions(item) === 1
                            ? t.kitchen.calcPortionOne
                            : fill(t.kitchen.calcPortions, { n: portions(item) })}
                        </Text>
                      </Pressable>
                    )}
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
