import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  /** Shown under the label — the habit's if-then anchor, when it has one. */
  hint?: string;
  done: boolean;
  onToggle: () => void;
  /** Tapping the body opens the habit; tapping the circle only ticks it. */
  onOpen?: () => void;
  /** Whether a divider is drawn above this row. */
  first?: boolean;
};

export function TaskRow({ label, hint, done, onToggle, onOpen, first }: Props) {
  const { colors, space, radius, type } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.rule,
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={label}
        // Padding rather than margin: it grows the tap target without moving
        // the circle away from the text.
        style={({ pressed }) => ({ paddingVertical: space.lg, opacity: pressed ? 0.6 : 1 })}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: done ? colors.accent : colors.ruleStrong,
            backgroundColor: done ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {done ? <Ionicons name="checkmark" size={18} color={colors.onAccent} /> : null}
        </View>
      </Pressable>

      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : undefined}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingVertical: space.lg,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              type.bodyStrong,
              {
                color: done ? colors.inkFaint : colors.ink,
                textDecorationLine: done ? "line-through" : "none",
              },
            ]}
          >
            {label}
          </Text>
          {hint ? (
            <Text style={[type.small, { color: colors.inkFaint, marginTop: 2 }]}>{hint}</Text>
          ) : null}
        </View>
        {onOpen ? (
          <Ionicons name="chevron-back" size={18} color={colors.inkFaint} />
        ) : null}
      </Pressable>
    </View>
  );
}
