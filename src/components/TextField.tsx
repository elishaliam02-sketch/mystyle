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
  onSubmitEditing?: () => void;
};

export function TextField({
  value,
  onChangeText,
  placeholder,
  label,
  keyboardType,
  multiline,
  autoFocus,
  onSubmitEditing,
}: Props) {
  const { colors, space, radius, type } = useTheme();
  const { isRTL } = useI18n();

  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
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
