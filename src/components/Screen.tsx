import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Screen({ title, subtitle, children }: Props) {
  const { colors, space, type } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.ground }]}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xxl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={{ gap: space.xs }}>
        <Text style={[type.display, { color: colors.ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[type.body, { color: colors.inkSoft }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
