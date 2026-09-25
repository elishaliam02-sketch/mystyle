import { TextInput, View, Text, type KeyboardTypeOptions } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  label?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onSubmitEditing?: () => void;
  /** A ceiling on length, so a pasted essay cannot become a habit title. */
  maxLength?: number;
};

/**
 * What a number field keeps of what was typed or pasted: digits and one
 * decimal mark. A phone's number pad already offers little else, but a paste,
 * a hardware keyboard or the web does not — and "דני" in the weight field used
 * to reach the store as NaN.
 */
export function cleanNumber(raw: string): string {
  const kept = raw.replace(/[^0-9.,]/g, "");
  const mark = kept.search(/[.,]/);
  if (mark === -1) return kept;
  return kept.slice(0, mark + 1) + kept.slice(mark + 1).replace(/[.,]/g, "");
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  label,
  keyboardType,
  multiline,
  autoFocus,
  secureTextEntry,
  autoCapitalize,
  onSubmitEditing,
  maxLength,
}: Props) {
  const { colors, space, radius, type } = useTheme();
  const { isRTL } = useI18n();
  const numeric = keyboardType === "numeric" || keyboardType === "decimal-pad" || keyboardType === "number-pad";

  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={numeric ? (next) => onChangeText(cleanNumber(next)) : onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        secureTextEntry={secureTextEntry}
        // Emails and passwords must not be auto-capitalised.
        autoCapitalize={autoCapitalize ?? (keyboardType === "email-address" ? "none" : undefined)}
        autoCorrect={secureTextEntry || keyboardType === "email-address" ? false : undefined}
        onSubmitEditing={onSubmitEditing}
        maxLength={maxLength}
        returnKeyType={onSubmitEditing ? "done" : undefined}
        // Numeric fields stay LTR even in Hebrew, or the digits read backwards.
        textAlign={keyboardType === "numeric" ? "left" : isRTL ? "right" : "left"}
        style={[
          type.body,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.md,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            color: colors.ink,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}
