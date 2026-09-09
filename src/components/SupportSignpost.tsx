import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, Text, View } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/**
 * What the app says when someone reaches for a target that would hurt them.
 *
 * Refusing a goal weight below the healthy floor is necessary and not enough:
 * a person who wants to go lower has a reason, and a bare "no" from a piece of
 * software is the moment they stop telling it the truth — or delete it and use
 * one that says yes. So the refusal comes with a door: talk to a doctor or a
 * dietitian, and if it is heavier than that, a real line staffed by real
 * people, around the clock and anonymously.
 *
 * Calm on purpose. Orange, not red; a note, not an alarm. Nobody needs their
 * phone shouting at them about this.
 */
export function SupportSignpost() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.orangeWash,
        borderRadius: radius.lg,
        borderStartWidth: 3,
        borderStartColor: colors.orangeInk,
        padding: space.lg,
        gap: space.sm,
        marginTop: space.md,
      }}
      accessibilityRole="summary"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="heart-outline" size={16} color={colors.orangeInk} />
        <Text style={[type.label, { color: colors.orangeInk }]}>{t.support.title}</Text>
      </View>
      <Text style={[type.small, { color: colors.ink }]}>{t.support.body}</Text>
      <Pressable
        onPress={() => void Linking.openURL("tel:1201")}
        accessibilityRole="button"
        accessibilityLabel={t.support.callLabel}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          alignSelf: "flex-start",
          backgroundColor: colors.surface,
          borderRadius: radius.pill,
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="call-outline" size={16} color={colors.orangeInk} />
        <Text style={[type.smallStrong, { color: colors.orangeInk }]}>{t.support.callLabel}</Text>
      </Pressable>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.support.note}</Text>
    </View>
  );
}
