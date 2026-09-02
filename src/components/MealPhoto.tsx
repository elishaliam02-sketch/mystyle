import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { MealImage } from "@/components/MealImage";
import { mealPhotoUrl, type Food, type Meal } from "@/kitchen";
import { useTheme } from "@/theme";

/**
 * A meal's picture: a real, appetising photo when there is a network, drawn
 * from the dish and its ingredients by a free image service (no key, no bill).
 *
 * The photo needs the internet, so this never depends on it. The plate drawn
 * from the ingredients shows immediately; the photo fades in once it loads; and
 * if it never loads — offline, the service down, or simply too slow — the card
 * keeps the drawing. A hard timeout means a slow service never leaves a
 * spinner hanging: after it, the instant drawing is what stays.
 */

type Props = {
  meal: Meal;
  foods: Food[];
  haveIds: Set<string>;
  width: number;
  height: number;
};

/** How long to wait for the free image service before settling on the drawing. */
const PHOTO_TIMEOUT_MS = 7000;

export function MealPhoto({ meal, foods, haveIds, width, height }: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A smaller image generates faster on the free service; 1.4x the display size
  // is still crisp on a phone. Speed matters more than a retina-perfect photo.
  const uri = mealPhotoUrl(meal, {
    width: Math.round(width * 1.4),
    height: Math.round(height * 1.4),
  });

  // Give up on a slow photo rather than spin forever — the drawing is a good
  // picture, not an error state, so falling back to it is not a failure.
  useEffect(() => {
    timer.current = setTimeout(() => {
      setState((s) => (s === "loading" ? "failed" : s));
    }, PHOTO_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [uri]);

  return (
    <View style={{ width, height, borderRadius: 18, overflow: "hidden", backgroundColor: colors.surfaceAlt }}>
      {/* The drawn plate is the base layer: shown while the photo loads and
          kept for good if it never arrives. */}
      {state !== "loaded" ? (
        <MealImage foods={foods} haveIds={haveIds} width={width} height={height} />
      ) : null}

      {state === "loading" ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {state !== "failed" ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          resizeMode="cover"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            opacity: state === "loaded" ? 1 : 0,
          }}
        />
      ) : null}
    </View>
  );
}
