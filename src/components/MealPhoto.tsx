import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, View } from "react-native";
import { MealImage } from "@/components/MealImage";
import { PhotoLoader, type Food, type Meal, type PhotoState } from "@/kitchen";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

/**
 * A meal's picture: a real photograph of the dish, with the drawn plate under it.
 *
 * The drawing shows *immediately* and is a complete picture in its own right, so
 * there is no spinner and never a "loading" state on screen. The photograph —
 * generated from this dish and its ingredients, see `src/kitchen/photo.ts` —
 * fades in over it when it arrives, which on a free service can take twenty
 * seconds. If it never arrives, the drawing simply stays. That is what makes the
 * card feel finished the moment it renders instead of "updating slowly".
 *
 * The loader is shared by every card on the screen, because the thing that has
 * to be managed is not one image but the handful of requests the whole list
 * would otherwise fire at once.
 */

/**
 * One queue for the whole app: the limit that matters is across cards, not per
 * card. Prefetching first is what lets the queue decide *when* a request goes
 * out — an `<Image>` left to itself fires the moment it renders, and a list of
 * ten would go out as ten. The rendered image then reads the cache the prefetch
 * filled (on the web, a second conditional request the browser serves from its
 * own cache).
 */
const loader = new PhotoLoader({
  prefetch: (uri) => Image.prefetch(uri),
  schedule: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  now: () => Date.now(),
});

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
  // A photo is a request to an outside server, so it waits on the switch. With
  // it off the drawing is the picture and nothing is fetched at all.
  //
  // And it waits for `ready` first. The stored answer arrives a moment after the
  // first render, and until it does the default reads as on — so a card that
  // asked straight away fetched photos for somebody who had turned them off.
  // A consent default that applies before the real answer is loaded is not a
  // default, it is a leak.
  const allowed = ready && consent().photos;
  const [state, setState] = useState<PhotoState>(() =>
    allowed ? loader.stateOf(meal) : "pending",
  );
  const fade = useRef(new Animated.Value(loader.stateOf(meal) === "ready" ? 1 : 0)).current;
  const uri = useMemo(() => loader.url(meal), [meal]);

  useEffect(() => {
    if (!allowed) {
      setState("missing");
      return;
    }
    return loader.watch(meal, setState);
  }, [meal, allowed]);

  useEffect(() => {
    if (state !== "ready") return;
    // Already in the image cache by now, so this is a fade, not a wait.
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [state, fade]);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: colors.surfaceAlt,
      }}
    >
      {/* the drawn plate — always there, instantly, as the base layer */}
      <MealImage foods={foods} haveIds={haveIds} width={width} height={height} />

      {state === "ready" ? (
        <Animated.Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={meal.en.title}
          source={{ uri }}
          resizeMode="cover"
          style={{ position: "absolute", top: 0, left: 0, width, height, opacity: fade }}
        />
      ) : null}
    </View>
  );
}
