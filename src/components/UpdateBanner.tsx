import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "@/i18n";
import { useAppUpdate } from "@/updates";
import { useTheme } from "@/theme";

/**
 * "A new version is ready — it installs by itself, or now."
 *
 * Updates normally install on their own the moment the app is opened (see
 * src/updates). This shows only in the rarer case where one finished
 * downloading while the app was already in use: then it waits for the next
 * return to the app rather than restarting under someone mid-set, and this
 * offers it now for whoever does not want to wait. Dismissing costs nothing.
 */
export function UpdateBanner() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { ready, apply } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || dismissed) return null;

  return (
    <View
      style={{
        backgroundColor: colors.accentWash,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.accent,
        padding: space.lg,
        gap: space.sm,
      }}
      accessibilityRole="alert"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="cloud-download" size={18} color={colors.accent} />
        <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{t.updates.bannerTitle}</Text>
      </View>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.updates.bannerBody}</Text>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
        <Pressable
          onPress={() => void apply()}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            borderRadius: radius.pill,
            paddingVertical: 9,
            paddingHorizontal: space.lg,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={[type.smallStrong, { color: colors.onAccent }]}>{t.updates.restart}</Text>
        </Pressable>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            paddingVertical: 9,
            paddingHorizontal: space.lg,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{t.updates.later}</Text>
        </Pressable>
      </View>
    </View>
  );
}
