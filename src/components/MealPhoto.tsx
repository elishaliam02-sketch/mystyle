import { useEffect, useRef, useState } from "react";
import { Animated, Image, Text, View } from "react-native";
import { MealImage } from "@/components/MealImage";
import {
  MEALS, NATIVE_HEADERS, closestBundled, fetchMealPhoto, type Food, type Meal, type Photo,
} from "@/kitchen";
import { BUNDLED_MEAL_PHOTOS, type BundledPhoto } from "@/kitchen/mealPhotoAssets";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

/**
 * A meal's picture: a real photograph of the dish, with the drawn plate
 * underneath.
 *
 * The drawing shows *immediately* and is a complete picture in its own right —
 * so there is no spinner and never a "loading" state on screen. The photograph
 * is searched for on Wikimedia Commons and fades in quietly over the drawing
 * once it arrives; if it never does (offline, the photos switch off, or Commons
 * has no photo of this dish) the drawing simply stays. That is what makes the
 * card feel instant instead of "updating slowly": you always see a finished
 * plate the moment it renders.
 *
 * Photographs rather than generated images is the whole point — see
 * `src/kitchen/photo.ts`, which also holds the consent gate this depends on.
 */

const BUNDLED_IDS = new Set(Object.keys(BUNDLED_MEAL_PHOTOS));

type Props = {
  meal: Meal;
  foods: Food[];
  haveIds: Set<string>;
  width: number;
  height: number;
};

export function MealPhoto({ meal, foods, haveIds, width, height }: Props) {
  const { colors } = useTheme();
  const { consent, ready } = useStore();
  // A photo is a request to an outside server, so it waits on the switch — and
  // on `ready`, because the stored answer arrives a moment after the first
  // render and the default reads as on until it does. `fetchMealPhoto` checks
  // the same thing again through the consent mirror; this half only spares the
  // work of asking.
  const allowed = ready && consent().photos;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  // Ask for roughly the display size, not 1.4x: Commons renders the thumbnail
  // on demand, and a smaller one arrives sooner and still looks sharp here.
  const want = Math.round(width);

  // What the photo actually depends on. Not the meal object: "your plate" is
  // rebuilt on every goal or diet change, and re-running on identity alone
  // would blink the photo out and back for a dish that has not changed.
  const subject = `${meal.id}|${meal.photo}`;

  // A photo shipped inside the app: the dish's own, or — for a plate built from
  // the fridge — the library dish closest to it, so the picture follows the
  // ingredients. Nothing is requested, so it needs no switch and no network.
  const bundledId = closestBundled(meal, MEALS, BUNDLED_IDS);
  const bundled: BundledPhoto | null = bundledId ? BUNDLED_MEAL_PHOTOS[bundledId] ?? null : null;

  useEffect(() => {
    if (bundled || !allowed) {
      setPhoto(null);
      fade.setValue(0);
      return;
    }
    let live = true;
    setPhoto(null);
    fade.setValue(0);
    fetchMealPhoto(meal, want).then((found) => {
      // A card that scrolled away or changed dish must not adopt this photo.
      if (live) setPhoto(found);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, want, fade, allowed, bundled]);

  useEffect(() => {
    if (photo) {
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [photo, fade]);

  return (
    <View style={{ width, height, borderRadius: 18, overflow: "hidden", backgroundColor: colors.surfaceAlt }}>
      {/* the drawn plate — always there, instantly, as the base layer */}
      <MealImage foods={foods} haveIds={haveIds} width={width} height={height} />

      {bundled ? (
        <View style={{ position: "absolute", top: 0, left: 0 }}>
          <Image
            accessibilityIgnoresInvertColors
            source={bundled.source}
            resizeMode="cover"
            style={{ width, height }}
          />
          <Credit text={bundled.credit} />
        </View>
      ) : null}

      {/* the photograph fades in over it once found; nothing shows until then */}
      {photo ? (
        <Animated.View style={{ position: "absolute", top: 0, left: 0, opacity: fade }}>
          <Animated.Image
            accessibilityIgnoresInvertColors
            source={{ uri: photo.url, headers: NATIVE_HEADERS }}
            resizeMode="cover"
            // A URL that resolves but will not decode leaves the drawing up.
            onError={() => setPhoto(null)}
            style={{ width, height }}
          />
          <Credit text={photo.credit} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The credit, when the licence asks for one. It is small, but it is not
 * optional and it is not a tooltip: a CC BY photo shown without the
 * photographer's name is used outside its licence. `pickPhoto` drops any
 * picture this line could not be written for.
 */
function Credit({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Text
      numberOfLines={1}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 6,
        paddingVertical: 3,
        fontSize: 9,
        textAlign: "right",
        color: "rgba(255,255,255,0.92)",
        backgroundColor: "rgba(0,0,0,0.42)",
      }}
    >
      {text}
    </Text>
  );
}
