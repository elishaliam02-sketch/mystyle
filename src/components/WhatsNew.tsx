import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { useI18n } from "@/i18n";
import { NEWS, newsUnseen } from "@/news";
import { useTheme } from "@/theme";

/** Device-local on purpose: what one phone has been told is not account data. */
const KEY = "apex.news.seen";

/** "What's new" — shown on Today once per update, until dismissed. */
export function WhatsNew() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((seen) => {
        if (live) setShow(newsUnseen(seen));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;
  const items = locale === "he" ? NEWS.he : NEWS.en;

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(KEY, NEWS.id).catch(() => {});
  };

  return (
    <Card tone="accent">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="gift" size={18} color={colors.accent} />
        <Text style={[type.title, { color: colors.ink, flex: 1 }]}>{t.today.newsTitle}</Text>
      </View>
      <View style={{ gap: 6, marginTop: space.sm }}>
        {items.map((line) => (
          <View key={line} style={{ flexDirection: "row", gap: space.sm }}>
            <Text style={[type.body, { color: colors.accent }]}>•</Text>
            <Text style={[type.body, { color: colors.ink, flex: 1 }]}>{line}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          marginTop: space.md,
          paddingVertical: 10,
          paddingHorizontal: space.lg,
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.accentDeep : colors.accent,
        })}
      >
        <Text style={[type.smallStrong, { color: colors.onAccent }]}>{t.today.newsOk}</Text>
      </Pressable>
    </Card>
  );
}
