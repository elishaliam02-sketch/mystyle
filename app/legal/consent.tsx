import Ionicons from "@expo/vector-icons/Ionicons";
import { Chevron } from "@/components/Chevron";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConsentSwitch } from "@/components/ConsentSwitch";
import { Screen } from "@/components/Screen";
import { fill, useI18n } from "@/i18n";
import { LEGAL, legalDocuments } from "@/legal";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

/**
 * The gate. Nobody reaches the app without passing through it, and nobody
 * passes through it without having been told what happens to their data.
 *
 * Two different things are asked here and they are kept apart on purpose. The
 * terms and the privacy policy have to be accepted to use the app at all —
 * that is the contract. Cloud backup and the AI coach are separate opt-ins,
 * both off, and the app is fully usable with both left off; bundling them into
 * the same "I agree" would make the agreement worthless and the consent
 * invalid. Anyone can change their mind later from the profile screen.
 */
export default function ConsentScreen() {
  const { t, locale } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { state, acceptLegal, consent, setConsent } = useStore();
  const docs = legalDocuments(locale);
  const choices = consent();

  function agree() {
    acceptLegal();
    // Someone who has already been through setup goes back to their day;
    // a new person carries on into the welcome flow.
    router.replace(state.profile.onboarded ? "/(tabs)" : "/welcome");
  }

  return (
    <Screen
      eyebrow={fill(t.legal.updated, { version: LEGAL.version, date: LEGAL.effective })}
      title={t.legal.gateTitle}
      subtitle={t.legal.gateBody}
    >
      <Card tone="accent">
        <Text style={[type.label, { color: colors.accent }]}>{t.legal.summaryTitle}</Text>
        <Text style={[type.body, { color: colors.ink }]}>{docs.privacy.summary}</Text>
        <Text style={[type.body, { color: colors.ink, marginTop: space.sm }]}>
          {docs.terms.summary}
        </Text>
      </Card>

      <View style={{ gap: space.sm }}>
        <DocLink label={t.legal.readPrivacy} onPress={() => router.push("/legal/privacy")} />
        <DocLink label={t.legal.readTerms} onPress={() => router.push("/legal/terms")} />
      </View>

      <Card label={t.legal.optionalTitle}>
        <View style={{ gap: space.sm }}>
          <ConsentSwitch
            label={t.legal.cloudLabel}
            body={t.legal.cloudBody}
            value={choices.cloud}
            onChange={(cloud) => setConsent({ cloud })}
          />
          <ConsentSwitch
            label={t.legal.aiLabel}
            body={t.legal.aiBody}
            value={choices.ai}
            onChange={(ai) => setConsent({ ai })}
          />
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <Button icon="checkmark" label={t.legal.agreeCta} onPress={agree} />
        <Text style={[type.small, { color: colors.inkFaint, textAlign: "center" }]}>
          {fill(t.legal.agreeNote, { version: LEGAL.version })}
        </Text>
      </View>
    </Screen>
  );
}

function DocLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, space, radius, type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.rule,
        borderRadius: radius.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="document-text-outline" size={18} color={colors.accent} />
      <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{label}</Text>
      <Chevron size={18} color={colors.inkFaint} />
    </Pressable>
  );
}
