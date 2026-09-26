import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { fill, useI18n } from "@/i18n";
import { LICENSES, LICENSE_COUNT } from "@/legal/licenses";
import { FOODS, MEALS } from "@/kitchen";
import { BUNDLED_FOOD_PHOTOS } from "@/kitchen/foodPhotoAssets";
import { BUNDLED_MEAL_PHOTOS } from "@/kitchen/mealPhotoAssets";
import { useTheme } from "@/theme";

/**
 * The open-source licences, reproduced because their terms require it.
 *
 * Grouped by licence rather than listed flat: five hundred rows of "MIT" tells
 * a reader nothing, while "MIT — 470 packages" followed by the names tells
 * them exactly what they are looking at. The list itself is generated from
 * what is installed (scripts/gen-licenses.mjs), so it cannot drift out of date
 * the way a hand-kept file does.
 */
export default function LicensesScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();

  const groups = useMemo(() => {
    const byLicense = new Map<string, string[]>();
    for (const pkg of LICENSES) {
      const list = byLicense.get(pkg.license) ?? [];
      list.push(`${pkg.name}@${pkg.version}`);
      byLicense.set(pkg.license, list);
    }
    return [...byLicense.entries()].sort((a, b) => b[1].length - a[1].length);
  }, []);

  // The food and dish photographs come from Wikimedia Commons, and the
  // licences most of them carry (CC BY, CC BY-SA) ask for the photographer to
  // be named. The big photos carry their credit on the picture; the small
  // ones have no room for it, so every credited photo is named here.
  const photoCredits = useMemo(() => {
    const name = (id: string) => {
      const f = FOODS.find((x) => x.id === id);
      if (f) return locale === "he" ? f.he : f.en;
      const m = MEALS.find((x) => x.id === id);
      return m ? (locale === "he" ? m.he.title : m.en.title) : id;
    };
    const rows: string[] = [];
    for (const [id, p] of [...Object.entries(BUNDLED_MEAL_PHOTOS), ...Object.entries(BUNDLED_FOOD_PHOTOS)]) {
      if (p.credit) rows.push(`${name(id)} — ${p.credit}`);
    }
    return rows.sort((a, b) => a.localeCompare(b));
  }, [locale]);

  return (
    <Screen
      eyebrow={fill(t.legal.licensesCount, { count: LICENSE_COUNT })}
      title={t.legal.licensesTitle}
      subtitle={t.legal.licensesBody}
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
      <Card label={t.legal.modelTitle}>
        <Text style={[type.small, { color: colors.inkSoft }]}>{t.legal.modelBody}</Text>
      </Card>
      {photoCredits.length > 0 ? (
        <Card label={`${t.legal.photoCredits} · ${photoCredits.length}`}>
          <Text style={[type.small, { color: colors.inkFaint, marginBottom: space.xs }]}>{t.legal.photoCreditsBody}</Text>
          <View style={{ gap: 2 }}>
            {photoCredits.map((line) => (
              <Text key={line} style={[type.small, { color: colors.inkSoft }]}>
                {line}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      {groups.map(([license, packages]) => (
        <Card key={license} label={`${license} · ${packages.length}`}>
          <View style={{ gap: 2 }}>
            {packages.map((name) => (
              <Text key={name} style={[type.small, { color: colors.inkSoft }]}>
                {name}
              </Text>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
