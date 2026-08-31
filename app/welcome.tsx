import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The first screen anyone sees. Before this, the app opened on "what's your
 * name?" with no explanation of what it was for — which is most of why it was
 * confusing to land in.
 */
export default function Welcome() {
  const { t, isRTL } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const points: { icon: IconName; title: string; body: string }[] = [
    { icon: "create-outline", title: t.welcome.point1Title, body: t.welcome.point1Body },
    { icon: "sparkles-outline", title: t.welcome.point2Title, body: t.welcome.point2Body },
    { icon: "moon-outline", title: t.welcome.point3Title, body: t.welcome.point3Body },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.band }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + space.xxl,
          paddingBottom: insets.bottom + space.xl,
          paddingHorizontal: space.xl,
          gap: space.xxl,
        }}
      >
        <View style={{ gap: space.lg }}>
          <View style={{ alignItems: "center", gap: space.sm }}>
            <BrandLogo size={92} onBand />
            <Text style={[type.label, { color: colors.bandInkSoft }]}>{t.welcome.kicker}</Text>
          </View>
          <Text
            style={[
              type.body,
              { color: colors.bandInkSoft, textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {t.welcome.tagline}
          </Text>
        </View>

        <View style={{ gap: space.xl }}>
          {points.map((point) => (
            <View
              key={point.title}
              style={{ flexDirection: "row", gap: space.lg, alignItems: "flex-start" }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.md,
                  backgroundColor: colors.bandRule,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={point.icon} size={21} color={colors.bandInk} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: colors.bandInk }]}>{point.title}</Text>
                <Text style={[type.small, { color: colors.bandInkSoft }]}>{point.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ gap: space.sm }}>
          <Button
            icon="arrow-back"
            label={t.welcome.start}
            onPress={() => router.replace("/onboarding")}
          />
          <Text style={[type.small, { color: colors.bandInkSoft, textAlign: "center" }]}>
            {t.welcome.duration}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
