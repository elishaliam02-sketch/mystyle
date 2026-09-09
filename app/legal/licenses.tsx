import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { fill, useI18n } from "@/i18n";
import { LICENSES, LICENSE_COUNT } from "@/legal/licenses";
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
  const { t } = useI18n();
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
