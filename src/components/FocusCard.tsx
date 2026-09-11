import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useI18n } from "@/i18n";
import { canOpenPhoneSettings, openColourFilters, openDoNotDisturb } from "@/focus";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

/**
 * Focus mode, and a straight answer about the two things it cannot do.
 *
 * Asked for: block distracting apps, and put the phone in greyscale during a
 * workout. Neither is available to an app — blocking is behind entitlements
 * both stores reserve for parental-control products, and system greyscale has
 * no public API at all. Pretending otherwise would mean a switch that quietly
 * does nothing, which is worse than not having it.
 *
 * So the card does the parts that are real, says plainly why the rest is not,
 * and hands over the two system screens that *do* it — one tap each, and the
 * person keeps control of their own phone.
 */
export function FocusCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { focusOn, toggleFocus } = useStore();
  const on = focusOn();

  return (
    <Card label={t.focus.title}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.focus.body}</Text>

      {on ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: space.md,
            marginTop: space.md,
          }}
        >
          <Ionicons name="contrast" size={16} color={colors.ink} />
          <Text style={[type.smallStrong, { color: colors.ink, flex: 1 }]}>{t.focus.on}</Text>
        </View>
      ) : null}

      <Button
        icon={on ? "color-palette-outline" : "contrast"}
        label={on ? t.focus.turnOff : t.focus.turnOn}
        tone={on ? "quiet" : "primary"}
        onPress={toggleFocus}
        style={{ marginTop: space.md }}
      />

      {on ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
          {t.focus.autoOff}
        </Text>
      ) : null}

      {canOpenPhoneSettings ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <SettingRoute
            icon="moon-outline"
            title={t.focus.dndTitle}
            body={t.focus.dndBody}
            cta={t.focus.dndCta}
            onPress={() => void openDoNotDisturb()}
          />
          <SettingRoute
            icon="eye-outline"
            title={t.focus.filterTitle}
            body={t.focus.filterBody}
            cta={t.focus.filterCta}
            onPress={() => void openColourFilters()}
          />
        </View>
      ) : null}
    </Card>
  );
}

function SettingRoute({
  icon,
  title,
  body,
  cta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name={icon} size={16} color={colors.inkFaint} />
        <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{title}</Text>
      </View>
      <Text style={[type.small, { color: colors.inkSoft }]}>{body}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: space.xs })}
      >
        <Text style={[type.smallStrong, { color: colors.accent }]}>{cta} →</Text>
      </Pressable>
    </View>
  );
}
