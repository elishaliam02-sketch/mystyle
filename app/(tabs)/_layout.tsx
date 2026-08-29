import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  today: { on: "sunny", off: "sunny-outline" },
  kitchen: { on: "restaurant", off: "restaurant-outline" },
  checkin: { on: "chatbubble-ellipses", off: "chatbubble-ellipses-outline" },
  progress: { on: "stats-chart", off: "stats-chart-outline" },
  profile: { on: "person-circle", off: "person-circle-outline" },
};

export default function TabsLayout() {
  const { t } = useI18n();
  const { colors, font } = useTheme();

  const icon =
    (key: keyof typeof ICONS) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Ionicons
        name={focused ? ICONS[key].on : ICONS[key].off}
        size={23}
        color={String(color)}
      />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.rule,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.today, tabBarIcon: icon("today") }} />
      <Tabs.Screen name="kitchen" options={{ title: t.tabs.kitchen, tabBarIcon: icon("kitchen") }} />
      <Tabs.Screen name="checkin" options={{ title: t.tabs.checkin, tabBarIcon: icon("checkin") }} />
      <Tabs.Screen
        name="progress"
        options={{ title: t.tabs.progress, tabBarIcon: icon("progress") }}
      />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile, tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
