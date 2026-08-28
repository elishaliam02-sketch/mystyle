import { Text, TextInput, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

function Bubble({ text, from }: { text: string; from: "app" | "user" }) {
  const { colors, space, radius, type } = useTheme();
  const mine = from === "user";

  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "88%",
        backgroundColor: mine ? colors.accent : colors.surfaceAlt,
        borderRadius: radius.lg,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
      }}
    >
      <Text style={[type.body, { color: mine ? colors.onAccent : colors.ink }]}>
        {text}
      </Text>
    </View>
  );
}

export default function CheckinScreen() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();

  return (
    <Screen title={t.checkin.heading} subtitle={t.checkin.subheading}>
      <Card label={t.checkin.sampleTitle}>
        <View style={{ gap: space.sm, marginTop: space.xs }}>
          <Bubble from="app" text={t.checkin.q1} />
          <Bubble from="user" text={t.checkin.a1} />
          <Bubble from="app" text={t.checkin.q2} />
          <Bubble from="user" text={t.checkin.a2} />
          <Bubble from="app" text={t.checkin.q3} />
        </View>
      </Card>

      <TextInput
        editable={false}
        placeholder={t.checkin.inputPlaceholder}
        placeholderTextColor={colors.inkFaint}
        style={[
          type.body,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.pill,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            color: colors.ink,
          },
        ]}
      />

      <StubNote>{t.checkin.stubNote}</StubNote>
    </Screen>
  );
}
