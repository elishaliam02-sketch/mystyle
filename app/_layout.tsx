import {
  FrankRuhlLibre_500Medium,
  FrankRuhlLibre_800ExtraBold,
} from "@expo-google-fonts/frank-ruhl-libre";
import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
  Heebo_800ExtraBold,
} from "@expo-google-fonts/heebo";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider } from "@/i18n";
import { StoreProvider, useStore } from "@/store";
import { ThemeProvider, useTheme } from "@/theme";

/**
 * Sends a first-time user into onboarding. It deliberately does NOT redirect
 * in the other direction: the moment onboarding completes, segments still
 * read "onboarding" for one render, and a leave-redirect here would hijack
 * finish()'s navigation to the new habit's tips page. Leaving is finish()'s
 * job; the onboarding screen guards its own accidental-entry case.
 */
function OnboardingGate() {
  const { state, ready } = useStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!state.profile.onboarded && segments[0] !== "onboarding") {
      router.replace("/onboarding");
    }
  }, [ready, state.profile.onboarded, segments, router]);

  return null;
}

function Shell() {
  const { colors } = useTheme();
  const { ready } = useStore();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style="light" />
      {ready ? <OnboardingGate /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="habit/[id]" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  // The whole type scale names these families, so rendering before they load
  // would flash a system-font version of every screen.
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Heebo_800ExtraBold,
    FrankRuhlLibre_500Medium,
    FrankRuhlLibre_800ExtraBold,
  });

  if (!fontsLoaded) return null;

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
