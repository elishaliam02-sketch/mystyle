import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Chevron } from "@/components/Chevron";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";
import type { Feature } from "@/billing/gate";

/**
 * The one way a limit is shown, so a wall never arrives as a dead button.
 *
 * Two rules it exists to enforce. A refusal always says *which* limit was
 * reached and offers the way past it in the same breath — a control that stops
 * working and explains nothing is the single most common way an app reads as
 * broken. And it appears *beside* the thing it is about, never as an alert over
 * the whole screen, because the person was in the middle of something.
 */

const COPY: Record<Feature, (t: ReturnType<typeof useI18n>["t"], limit: number) => string> = {
  habits: (t, limit) => fill(t.common.proHabits, { limit }),
  coach: (t, limit) => fill(t.common.proCoach, { limit }),
  mealPhoto: (t, limit) => fill(t.common.proMealPhoto, { limit }),
  progressPhotos: (t, limit) => fill(t.common.proPhotos, { limit }),
  customExercises: (t, limit) => fill(t.common.proCustom, { limit }),
  cloudBackup: (t) => t.common.proCloud,
};

/**
 * Renders nothing at all while the feature is still allowed — so a paying
 * account, and a free one under its limit, never sees a trace of this.
 */
export function ProGate({ feature }: { feature: Feature }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { allowance } = useStore();
  const router = useRouter();

  const v = allowance(feature);
  if (v.ok) return null;

  return (
    <Pressable
      onPress={() => router.push("/paywall")}
      accessibilityRole="button"
      accessibilityLabel={t.common.proLocked}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: colors.accentWash,
        borderWidth: 1,
        borderColor: colors.accent,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Ionicons name="sparkles" size={18} color={colors.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        {/* nosemgrep: unsafe-dynamic-method -- `feature` is a compile-time union key, not input */}
        <Text style={[type.small, { color: colors.ink }]}>{COPY[feature](t, v.limit)}</Text>
        <Text style={[type.smallStrong, { color: colors.accent }]}>{t.common.proSee}</Text>
      </View>
      <Chevron size={18} color={colors.accent} />
    </Pressable>
  );
}

/**
 * The quiet half: how many are left, said before they are spent rather than
 * after. Shown only on the last one or two, so it is a heads-up and not a
 * meter running in the corner of the screen.
 */
export function ProRemaining({ feature }: { feature: Feature }) {
  const { t } = useI18n();
  const { colors, type } = useTheme();
  const { allowance } = useStore();
  const daily = feature === "coach" || feature === "mealPhoto";

  const v = allowance(feature);
  if (!v.ok || v.remaining === null || v.remaining > 2) return null;

  const text =
    v.remaining === 1 && daily
      ? t.common.proLeftOne
      : fill(daily ? t.common.proLeftDay : t.common.proLeftTotal, { n: v.remaining });

  return <Text style={[type.small, { color: colors.inkFaint }]}>{text}</Text>;
}
