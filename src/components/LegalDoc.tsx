import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { fill, useI18n } from "@/i18n";
import { LEGAL, legalDocument, type LegalDocuments } from "@/legal";
import { useTheme } from "@/theme";

/**
 * Renders a legal document in the app's own type, in the reader's language.
 *
 * Deliberately not a link out to a web page: a policy that needs a signal to
 * read is a policy nobody reads, and app review asks for one that is reachable
 * from inside the app anyway. A paragraph beginning with "• " becomes a
 * bullet, which is the only formatting these documents need.
 */
export function LegalDoc({ which }: { which: keyof LegalDocuments }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const doc = legalDocument(locale, which);

  return (
    <Screen
      eyebrow={fill(t.legal.updated, { version: LEGAL.version, date: LEGAL.effective })}
      title={doc.title}
      aside={
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: colors.bandRule,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={20} color={colors.bandInk} />
        </Pressable>
      }
    >
      <Card tone="accent">
        <Text style={[type.label, { color: colors.accent }]}>{t.legal.summaryTitle}</Text>
        <Text style={[type.body, { color: colors.ink }]}>{doc.summary}</Text>
      </Card>

      {doc.sections.map((section) => (
        <Card key={section.id} label={section.heading}>
          <View style={{ gap: space.sm }}>
            {section.body.map((paragraph, i) =>
              paragraph.startsWith("• ") ? (
                <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
                  <Text style={[type.body, { color: colors.accent }]}>•</Text>
                  <Text style={[type.body, { color: colors.inkSoft, flex: 1 }]}>
                    {paragraph.slice(2)}
                  </Text>
                </View>
              ) : (
                <Text key={i} style={[type.body, { color: colors.inkSoft }]}>
                  {paragraph}
                </Text>
              ),
            )}
          </View>
        </Card>
      ))}

      <Card label={t.legal.contactTitle}>
        <Text style={[type.body, { color: colors.inkSoft }]}>
          {fill(t.legal.contactBody, { email: LEGAL.contactEmail })}
        </Text>
      </Card>
    </Screen>
  );
}
