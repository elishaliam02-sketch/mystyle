import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  today: { on: "sunny", off: "sunny-outline" },
  kitchen: { on: "restaurant", off: "restaurant-outline" },
  workout: { on: "barbell", off: "barbell-outline" },
  body: { on: "body", off: "body-outline" },
  checkin: { on: "chatbubble-ellipses", off: "chatbubble-ellipses-outline" },
  progress: { on: "stats-chart", off: "stats-chart-outline" },
  profile: { on: "person-circle", off: "person-circle-outline" },
};

export default function TabsLayout() {
  const { t } = useI18n();
  const { colors, font, radius } = useTheme();
  // Android draws edge-to-edge, so the system navigation bar sits over the
  // bottom of the screen. Without this inset the tab labels and icons hide
  // behind the phone's back/home/recent buttons.
  const insets = useSafeAreaInsets();

  const icon =
    (key: keyof typeof ICONS) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <View
        style={{
          width: 34,
          height: 28,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          // The active tab sits in a soft red pill, so the current place in the
          // app is obvious at a glance rather than a colour difference alone.
          backgroundColor: focused ? colors.accentWash : "transparent",
        }}
      >
        <Ionicons
          name={focused ? ICONS[key].on : ICONS[key].off}
          size={20}
          color={String(color)}
        />
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        // Seven tabs share the width, so the label is small and never truncated,
        // and each item gives up its side padding to the text.
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 9.5 },
        tabBarItemStyle: { paddingHorizontal: 0, paddingBottom: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.rule,
          // Roomy enough that the label never clips, even on a device with no
          // gesture-bar inset (worst case: insets.bottom === 0).
          height: 70 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(12, insets.bottom + 8),
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.today, tabBarIcon: icon("today") }} />
      <Tabs.Screen name="kitchen" options={{ title: t.tabs.kitchen, tabBarIcon: icon("kitchen") }} />
      <Tabs.Screen name="workout" options={{ title: t.tabs.workout, tabBarIcon: icon("workout") }} />
      <Tabs.Screen name="body" options={{ title: t.tabs.body, tabBarIcon: icon("body") }} />
      <Tabs.Screen name="checkin" options={{ title: t.tabs.checkin, tabBarIcon: icon("checkin") }} />
      <Tabs.Screen
        name="progress"
        options={{ title: t.tabs.progress, tabBarIcon: icon("progress") }}
      />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile, tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
