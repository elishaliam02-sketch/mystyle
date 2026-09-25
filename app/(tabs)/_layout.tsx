import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Text, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_CONTENT } from "@/components/Screen";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  today: { on: "sunny", off: "sunny-outline" },
  kitchen: { on: "restaurant", off: "restaurant-outline" },
  workout: { on: "barbell", off: "barbell-outline" },
  water: { on: "water", off: "water-outline" },
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
          width: 42,
          height: 30,
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
          size={22}
          color={String(color)}
        />
      </View>
    );

  const label =
    (text: string) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          fontFamily: focused ? font.bodyBold : font.bodyMedium,
          // Seven tabs share a phone's width; a long word ("התקדמות",
          // "Progress") gets a smaller size instead of an ellipsis — the web
          // ignores adjustsFontSizeToFit.
          fontSize: text.length > 6 ? 9.5 : text.length > 5 ? 10 : 11,
          letterSpacing: text.length > 5 ? -0.2 : 0,
          lineHeight: 14,
          color: String(color),
          marginTop: 3,
          paddingHorizontal: 0,
        }}
      >
        {text}
      </Text>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSoft,
        // Seven tabs share the width. The label used to be 9.5px in the faintest
        // ink, which was unreadable at arm's length; it is now 11px in the soft
        // ink (bold when active, see `label` below) and shrinks to fit rather
        // than truncating on the narrowest phones.
        tabBarItemStyle: { paddingHorizontal: 0, paddingBottom: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.rule,
          // Roomy enough that the label never clips, even on a device with no
          // gesture-bar inset (worst case: insets.bottom === 0).
          height: 78 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(12, insets.bottom + 8),
          // The body of every screen is held to one centred column; on a
          // tablet or a desktop browser the bar has to stop with it, or seven
          // tabs end up marooned at the far corners of a metre of glass. On a
          // phone the width is already below the cap, so this is a no-op.
          width: "100%",
          maxWidth: MAX_CONTENT,
          alignSelf: "center",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.today, tabBarLabel: label(t.tabs.today), tabBarIcon: icon("today") }} />
      <Tabs.Screen name="kitchen" options={{ title: t.tabs.kitchen, tabBarLabel: label(t.tabs.kitchen), tabBarIcon: icon("kitchen") }} />
      <Tabs.Screen name="workout" options={{ title: t.tabs.workout, tabBarLabel: label(t.tabs.workout), tabBarIcon: icon("workout") }} />
      <Tabs.Screen name="water" options={{ title: t.tabs.water, tabBarLabel: label(t.tabs.water), tabBarIcon: icon("water") }} />
      <Tabs.Screen name="checkin" options={{ title: t.tabs.checkin, tabBarLabel: label(t.tabs.checkin), tabBarIcon: icon("checkin") }} />
      <Tabs.Screen
        name="progress"
        options={{ title: t.tabs.progress, tabBarLabel: label(t.tabs.progress), tabBarIcon: icon("progress") }}
      />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile, tabBarLabel: label(t.tabs.profile), tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
