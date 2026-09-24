import { useEffect, useMemo, useRef, useState } from "react";
import { BUNDLED_MEAL_PHOTOS } from "@/kitchen/mealPhotoAssets";
import { BUNDLED_FOOD_PHOTOS } from "@/kitchen/foodPhotoAssets";
import { Animated, Image, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { useI18n } from "@/i18n";
import {
  MEALS,
  NATIVE_HEADERS,
  adhocFood,
  closestBundled,
  dietConflicts,
  fetchFoodPhoto,
  scoreAnything,
  type Food,
  type FoodScore,
  type Photo,
  type ScoreBand,
  type ScoreReason,
} from "@/kitchen";
import { useStore } from "@/store";
import { useTheme, type Colors } from "@/theme";

/**
 * "I feel like eating…" — somebody types a food and the app prices it out of
 * ten, with a photograph of it.
 *
 * The number is worked out on the device (`src/kitchen/score.ts`) from what the
 * food is, which is why it can answer on every keystroke, offline, without
 * anything they typed leaving the phone. The picture is the same Wikimedia
 * search the meal cards use, and obeys the same switch.
 *
 * The tone matters as much as the number. This is a weight-loss app, and the
 * person asking "can I eat this" is at their most vulnerable to being told off
 * by software. So: nothing is forbidden, the low bands are "sometimes" and
 * "rarely" rather than "bad", the reasons are facts about the food rather than
 * instructions, and adding something to the list is never argued with.
 */

/** One hue per band, from the metric palette: lime for good, orange to warn. */
export function bandColor(colors: Colors, band: ScoreBand): string {
  if (band === "great" || band === "good") return colors.limeInk;
  if (band === "ok") return colors.azure;
  return colors.orangeInk;
}

const BAND_LABEL: Record<ScoreBand, keyof ReturnType<typeof useI18n>["t"]["eat"]> = {
  great: "bandGreat",
  good: "bandGood",
  ok: "bandOk",
  sometimes: "bandSometimes",
  rarely: "bandRarely",
};

const REASON_LABEL: Record<ScoreReason, string> = {
  protein: "reasonProtein",
  fibre: "reasonFibre",
  wholegrain: "reasonWholegrain",
  omega3: "reasonOmega3",
  fermented: "reasonFermented",
  goodFat: "reasonGoodFat",
  refined: "reasonRefined",
  addedSugar: "reasonAddedSugar",
  processed: "reasonProcessed",
  satFat: "reasonSatFat",
  salt: "reasonSalt",
  energyDense: "reasonEnergyDense",
  wholeFood: "reasonWholeFood",
  guess: "reasonGuess",
};

/** How long to sit on a keystroke before asking Commons for a picture. */
const PHOTO_DEBOUNCE_MS = 700;

export function EatScore() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { wishes, addWish, removeWish, state } = useStore();
  const [text, setText] = useState("");
  const [note, setNote] = useState<"added" | "already" | null>(null);

  // The score is cheap and pure, so it is simply recomputed — there is nothing
  // to debounce and nothing to wait for.
  const { score, food } = useMemo(() => scoreAnything(text), [text]);
  const typed = text.trim().length >= 2;
  // The kitchen's dietary filters, applied to what was typed: a person who
  // keeps kosher asking about a cheeseburger should hear it here, not find out
  // from a filtered menu. A word the library does not know is judged by what
  // it says ("חזיר בגריל").
  const conflicts = useMemo(
    () =>
      typed
        ? dietConflicts(food ? [food, adhocFood(text.trim())] : [adhocFood(text.trim())], state.dietFilter)
        : [],
    [typed, food, text, state.dietFilter],
  );

  const list = wishes();

  return (
    <Card label={t.eat.title}>
      <Text style={[type.small, { color: colors.inkSoft, marginBottom: space.sm }]}>
        {t.eat.hint}
      </Text>

      <TextField
        value={text}
        onChangeText={(next) => {
          setText(next);
          setNote(null);
        }}
        placeholder={t.eat.placeholder}
        maxLength={60}
      />

      {typed ? (
        <View style={{ marginTop: space.md, gap: space.md }}>
          <ScoreReadout score={score} />
          {conflicts.length > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Ionicons name="alert-circle" size={18} color={colors.orangeInk} />
              <Text style={[type.smallStrong, { color: colors.orangeInk, flex: 1 }]}>
                {conflicts
                  .map((d) => (d === "kosher" ? t.eat.notKosher : d === "vegetarian" ? t.eat.notVeg : t.eat.hasGluten))
                  .join(" · ")}
                {"  "}
                <Text style={[type.small, { color: colors.inkFaint }]}>{t.eat.dietBySettings}</Text>
              </Text>
            </View>
          ) : null}
          <FoodShot text={text} food={food} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.eat.add}
              onPress={() => setNote(addWish(text) ? "added" : "already")}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: space.sm,
                paddingHorizontal: space.lg,
                borderRadius: radius.sm,
              }}
            >
              <Text style={[type.smallStrong, { color: colors.onAccent }]}>{t.eat.add}</Text>
            </Pressable>
            {note ? (
              <Text style={[type.small, { color: colors.inkSoft }]}>
                {note === "added" ? t.eat.added : t.eat.already}
              </Text>
            ) : null}
          </View>

          <Text style={[type.label, { color: colors.inkFaint }]}>
            {score.known ? t.eat.estimate : t.eat.guessNote}
          </Text>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={{ marginTop: space.lg, gap: space.xs }}>
          <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
            {t.eat.listTitle}
          </Text>
          {list.map((wish) => {
            const each = scoreAnything(wish.text).score;
            return (
              <View
                key={wish.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingVertical: space.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.rule,
                }}
              >
                <Text
                  style={[
                    type.bodyStrong,
                    { color: bandColor(colors, each.band), minWidth: 42 },
                  ]}
                >
                  {each.value.toFixed(1)}
                </Text>
                <Text style={[type.body, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                  {wish.text}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.eat.remove}
                  onPress={() => removeWish(wish.id)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={18} color={colors.inkFaint} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

/** The number itself, with the band and the three reasons behind it. */
function ScoreReadout({ score }: { score: FoodScore }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const tone = bandColor(colors, score.band);
  const eat = t.eat as unknown as Record<string, string>;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          borderWidth: 3,
          borderColor: tone,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* One decimal, always — a bare "8" next to an "8.6" reads as a different
            kind of answer, and the decimal is what makes it look measured. */}
        <Text style={[type.display, { color: tone }]}>{score.value.toFixed(1)}</Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.bodyStrong, { color: tone }]}>{eat[BAND_LABEL[score.band]]}</Text>
        <Text style={[type.label, { color: colors.inkFaint }]}>{t.eat.outOf}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {score.reasons.map((reason) => (
            <View
              key={reason}
              style={{
                backgroundColor: colors.surfaceAlt,
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                borderRadius: radius.sm,
              }}
            >
              <Text style={[type.label, { color: colors.inkSoft }]}>
                {eat[REASON_LABEL[reason]]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * A photograph of what they typed, when one can be found.
 *
 * Nothing at all is shown until one arrives: a blank rectangle with a spinner
 * in it, on a card whose whole job is to answer quickly, would make the answer
 * feel slower than it is. And the search waits for a pause in the typing —
 * every keystroke is a score, but not every keystroke is worth a request.
 */
const BUNDLED_IDS = new Set(Object.keys(BUNDLED_MEAL_PHOTOS));

function FoodShot({ text, food }: { text: string; food: Food | null }) {
  const { colors, radius, type, space } = useTheme();
  const { consent, ready } = useStore();
  // A food the app knows wears its own shipped photo — or, failing that, the
  // photo of a dish built on it — at once, offline, nothing asked of anyone.
  // Only a food it has never heard of goes looking on Commons.
  const own = food ? BUNDLED_FOOD_PHOTOS[food.id] ?? null : null;
  const bundledId = food && !own ? closestBundled({ id: `food:${food.id}`, uses: [food.id] }, MEALS, BUNDLED_IDS) : null;
  const bundled = own ?? (bundledId ? BUNDLED_MEAL_PHOTOS[bundledId] ?? null : null);
  const allowed = ready && consent().photos && !bundled;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setPhoto(null);
    fade.setValue(0);
    if (!allowed || text.trim().length < 3) return;
    let live = true;
    const timer = setTimeout(() => {
      fetchFoodPhoto(text.trim(), food, 480).then((found) => {
        if (live) setPhoto(found);
      });
    }, PHOTO_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, food, allowed, fade]);

  useEffect(() => {
    if (photo) {
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    }
  }, [photo, fade]);

  if (bundled) {
    return (
      <View style={{ borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceAlt }}>
        <Image
          accessibilityIgnoresInvertColors
          source={bundled.source}
          fadeDuration={0}
          resizeMode="cover"
          style={{ width: "100%", height: 150 }}
        />
        {bundled.credit ? (
          <Text
            numberOfLines={1}
            style={[
              type.label,
              {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                textAlign: "right",
                fontSize: 9,
                color: "rgba(255,255,255,0.92)",
                backgroundColor: "rgba(0,0,0,0.42)",
              },
            ]}
          >
            {bundled.credit}
          </Text>
        ) : null}
      </View>
    );
  }

  if (!photo) return null;

  return (
    <Animated.View
      style={{
        opacity: fade,
        borderRadius: radius.md,
        overflow: "hidden",
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: photo.url, headers: NATIVE_HEADERS }}
        resizeMode="cover"
        style={{ width: "100%", height: 150 }}
      />
      {photo.credit ? (
        <Text
          numberOfLines={1}
          style={[
            type.label,
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: space.sm,
              paddingVertical: 3,
              textAlign: "right",
              fontSize: 9,
              color: "rgba(255,255,255,0.92)",
              backgroundColor: "rgba(0,0,0,0.42)",
            },
          ]}
        >
          {photo.credit}
        </Text>
      ) : null}
    </Animated.View>
  );
}
