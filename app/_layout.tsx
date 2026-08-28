import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider } from "@/i18n";
import { StoreProvider, useStore } from "@/store";
import { ThemeProvider, useTheme } from "@/theme";

/**
 * Sends a first-time user into onboarding, and keeps anyone who has finished it
 * out. Runs after the stored state has loaded, so a slow read never flashes
 * onboarding at a returning user.
 */
function OnboardingGate() {
  const { state, ready } = useStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onOnboarding = segments[0] === "onboarding";
    if (!state.profile.onboarded && !onOnboarding) {
      router.replace("/onboarding");
    } else if (state.profile.onboarded && onOnboarding) {
      router.replace("/");
    }
  }, [ready, state.profile.onboarded, segments, router]);

  return null;
}

function Shell() {
  const { colors } = useTheme();
  const { ready } = useStore();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style="auto" />
      {ready ? <OnboardingGate /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <I18nProvider>
          <ThemeProvider>
            <Shell />
          </ThemeProvider>
        </I18nProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
