import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";
import { useI18n } from "@/i18n";

/**
 * The "tap to go in" arrow on a row, pointing the way reading goes.
 *
 * A disclosure chevron has to follow the language, not a fixed side: forward is
 * left in Hebrew and right in English. Every row used to hard-code one
 * direction, so on the Hebrew home screen the habit rows pointed left while the
 * card right below them pointed right — the kind of small wrongness that makes
 * an RTL app feel ported rather than built. One component removes the choice.
 */
export function Chevron({ size = 18, color }: { size?: number; color?: ColorValue }) {
  const { isRTL } = useI18n();
  return <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={size} color={color} />;
}
