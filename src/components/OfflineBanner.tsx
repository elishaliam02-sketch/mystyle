import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "@/i18n";
import { canOpenNetworkSettings, openNetworkSettings, type Reachability } from "@/net";
import { useTheme } from "@/theme";

/**
 * "No connection — and here is what that does and does not mean."
 *
 * Shown only when the person has cloud sync switched on, because only then is
 * there anything a connection would do. The wording matters more than the
 * banner: nothing is lost offline, every screen still works, and the day syncs
 * by itself the moment the signal is back. A bare "offline" icon invites
 * people to assume the opposite and re-enter what they already wrote.
 *
 * The button opens the device's network settings, which is as close to
 * "connect me" as any app is allowed to get.
 */
export function OfflineBanner({ state, onRetry }: { state: Reachability; onRetry?: () => void }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();

  if (state !== "offline") return null;

  return (
    <View
      style={{
        backgroundColor: colors.orangeWash,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.orangeInk,
        padding: space.lg,
        gap: space.sm,
      }}
      accessibilityRole="alert"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.orangeInk} />
        <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{t.net.offlineTitle}</Text>
      </View>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.net.offlineBody}</Text>

      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs, flexWrap: "wrap" }}>
        {canOpenNetworkSettings ? (
          <Pressable
            onPress={() => void openNetworkSettings()}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.orange,
              borderRadius: radius.pill,
              paddingVertical: 9,
              paddingHorizontal: space.lg,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="wifi" size={16} color={colors.onOrange} />
            <Text style={[type.smallStrong, { color: colors.onOrange }]}>{t.net.openSettings}</Text>
          </Pressable>
        ) : null}
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => ({
              paddingVertical: 9,
              paddingHorizontal: space.lg,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{t.net.retry}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
