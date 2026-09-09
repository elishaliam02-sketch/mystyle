import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import type { AiState } from "@/ai/client";

/**
 * Says out loud what the AI did. A silent fallback to written content reads as
 * "nothing happened" — the user cannot tell a general tip from a broken
 * feature, so every state gets a sentence, and recoverable ones get an action.
 *
 * "Off" and "not here" are deliberately different sentences. The coach is off
 * by default now, and a person who is told "unavailable" concludes the feature
 * is broken or unbuilt and never looks again; being told it is off, with the
 * switch one tap away, is the difference between a choice and a dead end.
 */
export function AiNote({ state, onRetry }: { state: AiState; onRetry?: () => void }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();

  if (state === "ready") return null;

  if (state === "checking") {
    return (
      <Text style={[type.small, { color: colors.inkSoft }]}>✦ {t.ai.thinking}</Text>
    );
  }

  const off = state === "declined";
  const message = off ? t.ai.consentOff : state === "unavailable" ? t.ai.unavailable : t.ai.failed;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      }}
    >
      <Text style={[type.small, { color: colors.inkSoft, flex: 1 }]}>{message}</Text>
      {off ? (
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: space.xs })}
        >
          <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
            {t.ai.turnOn}
          </Text>
        </Pressable>
      ) : state === "failed" && onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: space.xs })}
        >
          <Text style={[type.small, { color: colors.accent, fontWeight: "700" }]}>
            {t.ai.retry}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Marks content that Claude wrote for this user. */
export function AiBadge() {
  const { t } = useI18n();
  const { colors, type } = useTheme();
  return (
    <Text style={[type.label, { color: colors.accent }]}>✦ {t.ai.badge}</Text>
  );
}
