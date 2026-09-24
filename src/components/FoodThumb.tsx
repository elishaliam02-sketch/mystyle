import { Image, View } from "react-native";
import type { Food } from "@/kitchen";
import { BUNDLED_FOOD_PHOTOS } from "@/kitchen/foodPhotoAssets";
import { useTheme } from "@/theme";

/**
 * A food's own photo at thumbnail size — in the ingredient list, the search,
 * the list read-back. Shipped with the app, so it is there at once and
 * offline. A food with no photo (a word the library has never seen) keeps its
 * colour dot, sized to match, so rows still line up.
 *
 * Credits for these thumbnails live on the licences screen: a 28-pixel square
 * has no room for a line of text, and the shipped set prefers public-domain
 * pictures, which need none.
 */
export function FoodThumb({ food, size = 28 }: { food: Food; size?: number }) {
  const { colors } = useTheme();
  const shot = BUNDLED_FOOD_PHOTOS[food.id];
  if (shot) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={shot.source}
        fadeDuration={0}
        resizeMode="cover"
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt }}
      />
    );
  }
  const dot = Math.max(8, Math.round(size * 0.42));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: food.color,
          borderWidth: 1,
          borderColor: colors.ruleStrong,
        }}
      />
    </View>
  );
}
