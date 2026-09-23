import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Chevron } from "@/components/Chevron";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/** The way into the app guide (app/help.tsx), wherever someone may be lost. */
export function HelpEntry() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/help")}
      accessibilityRole="button"
      accessibilityLabel={t.help.entry}
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.pill,
              backgroundColor: colors.accentWash,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="help-buoy" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { color: colors.ink }]}>{t.help.entry}</Text>
            <Text style={[type.small, { color: colors.inkSoft }]}>{t.help.entryHint}</Text>
          </View>
          <Chevron size={20} color={colors.inkFaint} />
        </View>
      </Card>
    </Pressable>
  );
}
