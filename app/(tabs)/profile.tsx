import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { useI18n, type Locale } from "@/i18n";
import { useTheme } from "@/theme";

const LOCALES: { id: Locale; label: string }[] = [
  { id: "he", label: "עברית" },
  { id: "en", label: "English" },
];

function Row({ title, body }: { title: string; body: string }) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.bodyStrong, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.small, { color: colors.inkFaint }]}>{body}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { colors, space, radius, type } = useTheme();

  return (
    <Screen title={t.profile.heading}>
      <Card label={t.profile.languageTitle}>
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
          {LOCALES.map(({ id, label }) => {
            const selected = locale === id;
            return (
              <Pressable
                key={id}
                onPress={() => void setLocale(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  backgroundColor: selected ? colors.accent : "transparent",
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.rule,
                  borderRadius: radius.pill,
                  paddingVertical: space.md,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text
                  style={[
                    type.bodyStrong,
                    { color: selected ? colors.onAccent : colors.ink },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.profile.languageNote}
        </Text>
      </Card>

      <Card>
        <View style={{ gap: space.lg }}>
          <Row title={t.profile.accountTitle} body={t.profile.accountStub} />
          <Row
            title={t.profile.notificationsTitle}
            body={t.profile.notificationsStub}
          />
          <Row title={t.profile.dangerTitle} body={t.profile.dangerStub} />
        </View>
      </Card>
    </Screen>
  );
}
