import { Switch, Text, View } from "react-native";
import { useTheme } from "@/theme";

/**
 * One opt-in, with the whole truth next to it.
 *
 * A switch labelled only "Cloud backup" is not consent to anything — a person
 * has to be told what leaves the phone and to whom before the answer means
 * something. So the body text is required, not optional, and it says what is
 * sent rather than how good the feature is.
 */
export function ConsentSwitch({
  label,
  body,
  value,
  onChange,
}: {
  label: string;
  body: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { colors, space, radius, type } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.md,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        padding: space.lg,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.bodyStrong, { color: colors.ink }]}>{label}</Text>
        <Text style={[type.small, { color: colors.inkSoft }]}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.ruleStrong, true: colors.accent }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.ruleStrong}
      />
    </View>
  );
}
