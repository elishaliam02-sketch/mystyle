import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/**
 * Glyph placeholders. Real icons land in phase 4 with the visual polish pass —
 * shipping an icon set now would be work we throw away.
 */
const GLYPHS = { today: "◵", checkin: "◍", progress: "◈", profile: "◎" } as const;

export default function TabsLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();

  const icon =
    (key: keyof typeof GLYPHS) =>
    ({ color }: { color: ColorValue }) => (
      <Text style={{ color, fontSize: 20 }}>{GLYPHS[key]}</Text>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.rule,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t.tabs.today, tabBarIcon: icon("today") }}
      />
      <Tabs.Screen
        name="checkin"
        options={{ title: t.tabs.checkin, tabBarIcon: icon("checkin") }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: t.tabs.progress, tabBarIcon: icon("progress") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t.tabs.profile, tabBarIcon: icon("profile") }}
      />
    </Tabs>
  );
}
