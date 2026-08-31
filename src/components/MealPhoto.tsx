import { useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { MealImage } from "@/components/MealImage";
import { mealPhotoUrl, type Food, type Meal } from "@/kitchen";

/**
 * A meal's picture: a real, appetising photo when there is a network, drawn
 * from the dish and its ingredients by a free image service (no key, no bill).
 *
 * The photo needs the internet, so this never depends on it. A warm placeholder
 * shows immediately; the photo fades in once it loads; and if it never loads —
 * offline, or the service is down — the app falls back to the plate drawn from
 * the ingredients, so the card is never blank. The photo is what the person
 * sees on a normal day; the drawing is the safety net.
 */

type Props = {
  meal: Meal;
  foods: Food[];
  haveIds: Set<string>;
  width: number;
  height: number;
};

export function MealPhoto({ meal, foods, haveIds, width, height }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  // A smaller image generates faster on the free service; 1.4x the display size
  // is still crisp on a phone. Speed matters more than a retina-perfect photo.
  const uri = mealPhotoUrl(meal, {
    width: Math.round(width * 1.4),
    height: Math.round(height * 1.4),
  });

  return (
    <View style={{ width, height, borderRadius: 18, overflow: "hidden", backgroundColor: "#ECE0CC" }}>
      {/* The drawn plate is the base layer: a tasteful placeholder while the
          photo loads, and the permanent fallback if it never does. */}
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
          <ActivityIndicator color="#0E6E4E" />
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
