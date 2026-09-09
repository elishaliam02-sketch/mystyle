import { Text, View } from "react-native";
import { useTheme } from "@/theme";

/**
 * Marks a screen area that is deliberately not wired up yet, so a tester
 * never mistakes an unfinished phase for a bug.
 */
export function StubNote({ children }: { children: string }) {
  const { colors, space, radius, type } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.limeWash,
        borderStartWidth: 3,
        borderStartColor: colors.limeInk,
        borderRadius: radius.sm,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
      }}
    >
      <Text style={[type.small, { color: colors.ink }]}>{children}</Text>
    </View>
  );
}
