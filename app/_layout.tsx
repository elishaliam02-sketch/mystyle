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
import { configure as configureNotifications } from "@/notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { accessForAccount } from "@/billing/access";
import { SUBSCRIPTION_REQUIRED } from "@/billing/launch";
import { currentAccount } from "@/cloud/client";
import { I18nProvider } from "@/i18n";
import { StoreProvider, useStore } from "@/store";
import { ThemeProvider, useTheme } from "@/theme";
import { trustedNowMs } from "@/time/clock";

/**
 * Sends a first-time user into onboarding, and anyone who has not accepted the
 * current terms into the consent gate first.
 *
 * The consent check comes before the onboarding one and applies to everybody,
 * not only to new installs: raising LEGAL.version is what makes an existing
 * user see the documents again after they change, which is the whole point of
 * versioning them. The legal screens themselves are exempt, or reading the
 * policy from the gate would bounce straight back to the gate.
 *
 * It deliberately does NOT redirect in the other direction: the moment
 * onboarding completes, segments still read "onboarding" for one render, and a
 * leave-redirect here would hijack finish()'s navigation to the new habit's
 * tips page. Leaving is finish()'s job; the onboarding screen guards its own
 * accidental-entry case.
 */
function OnboardingGate() {
  const { state, ready, legalCurrent } = useStore();
  const segments = useSegments();
  const router = useRouter();

  // Whether there is a real, recoverable account. Only ever asked when the
  // subscriber-only gate is switched on (SUBSCRIPTION_REQUIRED); while it is
  // off — every build before launch — this stays true and no account lookup,
  // and no network, ever happens, so nothing about the app changes.
  const [hasAccount, setHasAccount] = useState<boolean | null>(
    SUBSCRIPTION_REQUIRED ? null : true,
  );
  const section = segments[0];

  useEffect(() => {
    if (!SUBSCRIPTION_REQUIRED || !ready) return;
    let alive = true;
    void currentAccount().then((a) => {
      if (alive) setHasAccount(!!a && !a.anonymous);
    });
    return () => {
      alive = false;
    };
    // Re-checked on every navigation and once ready: signing in on /auth is
    // what flips this, and the gate has to notice and move the person on.
  }, [ready, section]);

  useEffect(() => {
    if (!ready) return;
    const inLegal = section === "legal";
    // A password-reset link is time-limited and arrives from outside the app.
    // Bouncing it to the consent gate or to onboarding would spend the link on
    // a screen that cannot use it, so this one route is always allowed
    // through — it neither reads nor writes anything but the password.
    if (section === "reset") return;

    // The subscribers-only gate. Dormant unless launched. Identity and payment
    // come before onboarding: there is no point setting up a first habit for
    // someone who cannot get into the app. Legal stays reachable throughout so
    // the terms and privacy links on the paywall and sign-in work.
    if (SUBSCRIPTION_REQUIRED && hasAccount !== null) {
      const nowIso = new Date(trustedNowMs(Date.now(), state.clockHighWaterMs ?? 0)).toISOString();
      const access = accessForAccount({ hasAccount, nowIso, subscription: state.subscription });
      if (access !== "app") {
        if (inLegal) return;
        if (access === "auth") {
          if (section !== "auth") router.replace("/auth");
          return;
        }
        // access === "subscribe": signed in, but nothing live — to the paywall.
        if (section !== "paywall") router.replace("/paywall");
        return;
      }
      // access === "app": fall through to the normal consent + onboarding flow.
    }

    if (!legalCurrent() && !inLegal) {
      router.replace("/legal/consent");
      return;
    }
    const inSetup = section === "welcome" || section === "onboarding" || inLegal;
    if (!state.profile.onboarded && !inSetup) {
      router.replace("/welcome");
    }
  }, [
    ready,
    legalCurrent,
    state.profile.onboarded,
    state.subscription,
    state.clockHighWaterMs,
    hasAccount,
    section,
    segments,
    router,
  ]);

  return null;
}

function Shell() {
  const { colors } = useTheme();
  const { ready } = useStore();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style="light" />
      {ready ? <OnboardingGate /> : null}
      {/* Until the saved state is read, the ground colour and nothing else:
          otherwise every launch flashed "no habits yet" and a nameless
          greeting before the real Today arrived. */}
      {!ready ? <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: colors.ground }} /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="habit/[id]" />
        <Stack.Screen name="achievements" options={{ presentation: "modal" }} />
        <Stack.Screen name="rewards" options={{ presentation: "modal" }} />
        <Stack.Screen name="legal/consent" />
        <Stack.Screen name="reset" />
        <Stack.Screen name="legal/privacy" options={{ presentation: "modal" }} />
        <Stack.Screen name="legal/terms" options={{ presentation: "modal" }} />
        <Stack.Screen name="legal/licenses" options={{ presentation: "modal" }} />
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

  useEffect(() => {
    configureNotifications();
  }, []);

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
