import { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { MealImage } from "@/components/MealImage";
import { fetchMealPhoto, type Food, type Meal } from "@/kitchen";
import { useTheme } from "@/theme";

/**
 * A meal's picture: a real photograph of the dish, with the drawn plate
 * underneath.
 *
 * The drawing shows *immediately* and is a complete picture in its own right —
 * so there is no spinner and never a "loading" state on screen. The photograph
 * is searched for on Wikimedia Commons and fades in quietly over the drawing
 * once it arrives; if it never does (offline, or Commons has no photo of this
 * dish) the drawing simply stays. That is what makes the card feel instant
 * instead of "updating slowly": you always see a finished plate the moment it
 * renders.
 *
 * Photographs rather than generated images is the whole point — see
 * `src/kitchen/photo.ts`.
 */

type Props = {
  meal: Meal;
  foods: Food[];
  haveIds: Set<string>;
  width: number;
  height: number;
};

export function MealPhoto({ meal, foods, haveIds, width, height }: Props) {
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  // Ask for roughly the display size, not 1.4x: Commons renders the thumbnail
  // on demand, and a smaller one arrives sooner and still looks sharp here.
  const want = Math.round(width);

  // What the photo actually depends on. Not the meal object: "your plate" is
  // rebuilt on every goal or diet change, and re-running on identity alone
  // would blink the photo out and back for a dish that has not changed.
  const subject = `${meal.id}|${meal.photo}`;

  useEffect(() => {
    let live = true;
    setUri(null);
    fade.setValue(0);
    fetchMealPhoto(meal, want).then((found) => {
      // A card that scrolled away or changed dish must not adopt this photo.
      if (live) setUri(found);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, want, fade]);

  useEffect(() => {
    if (uri) {
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [uri, fade]);

  return (
    <View style={{ width, height, borderRadius: 18, overflow: "hidden", backgroundColor: colors.surfaceAlt }}>
      {/* the drawn plate — always there, instantly, as the base layer */}
      <MealImage foods={foods} haveIds={haveIds} width={width} height={height} />

      {/* the photograph fades in over it once found; nothing shows until then */}
      {uri ? (
        <Animated.Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          resizeMode="cover"
          // A URL that resolves but will not decode leaves the drawing up.
          onError={() => setUri(null)}
          style={{ position: "absolute", top: 0, left: 0, width, height, opacity: fade }}
        />
      ) : null}
    </View>
  );
}
