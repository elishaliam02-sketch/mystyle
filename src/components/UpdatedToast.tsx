import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { useAutoUpdates, useJustUpdated } from "@/updates";

/**
 * Keeps the app up to date by itself (see src/updates), and says so once
 * after an update was installed — a short note at the top that goes away on
 * its own, so nobody wonders whether the new things arrived.
 */
export function UpdatedToast() {
  useAutoUpdates();
  const fresh = useJustUpdated();
  const [shown, setShown] = useState(false);
  const { t } = useI18n();
  const { colors, space, radius, type, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!fresh) return;
    setShown(true);
    const timer = setTimeout(() => setShown(false), 5000);
    return () => clearTimeout(timer);
  }, [fresh]);

  if (!shown) return null;
  return (
    <Pressable
      onPress={() => setShown(false)}
      accessibilityRole="alert"
      accessibilityLabel={`${t.updates.updatedTitle}. ${t.updates.updatedBody}`}
      style={{ position: "absolute", top: insets.top + space.sm, left: space.lg, right: space.lg, zIndex: 50 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.accent,
          ...elevation(2),
        }}
      >
        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.updates.updatedTitle}</Text>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.updates.updatedBody}</Text>
        </View>
      </View>
    </Pressable>
  );
}
