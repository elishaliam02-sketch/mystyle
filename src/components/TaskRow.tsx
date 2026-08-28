import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  done: boolean;
  onToggle: () => void;
};

export function TaskRow({ label, done, onToggle }: Props) {
  const { colors, space, radius, type } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: done ? colors.accent : colors.ruleStrong,
          backgroundColor: done ? colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done ? (
          <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: "700" }}>
            ✓
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          type.body,
          {
            color: done ? colors.inkFaint : colors.ink,
            textDecorationLine: done ? "line-through" : "none",
            // flex, not flexShrink: a long habit written by the user must wrap
            // onto a second line rather than run off the edge of the card.
            flex: 1,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
