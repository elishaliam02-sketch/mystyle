import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme";

type Props = {
  label: string;
  /** Shown under the label — the habit's if-then anchor, when it has one. */
  hint?: string;
  done: boolean;
  onToggle: () => void;
  /** Tapping the label opens the habit; tapping the circle only ticks it. */
  onOpen?: () => void;
};

export function TaskRow({ label, hint, done, onToggle, onOpen }: Props) {
  const { colors, space, radius, type } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={label}
        // Padding rather than margin: it grows the tap target without moving
        // the circle away from the text.
        style={({ pressed }) => ({ paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}
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
            <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: "700" }}>✓</Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : undefined}
        style={({ pressed }) => ({ flex: 1, paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          style={[
            type.body,
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
      </Pressable>
    </View>
  );
}
