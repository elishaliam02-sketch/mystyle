import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import * as Updates from "expo-updates";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, I18nManager, Platform } from "react-native";
import { en } from "./en";
import { he } from "./he";

export type Locale = "he" | "en";
type Dict = typeof he;

const DICTS: Record<Locale, Dict> = { he, en };
const STORAGE_KEY = "mystyle.locale";

function deviceLocale(): Locale {
  return Localization.getLocales()[0]?.languageCode === "he" ? "he" : "en";
}

/**
 * Fills {placeholders} in a translated string.
 *   fill(t.today.doneCount, { done: 2, total: 3 })
 */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

type I18nValue = {
  t: Dict;
  locale: Locale;
  isRTL: boolean;
  ready: boolean;
  setLocale: (next: Locale) => Promise<void>;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * React Native decides writing direction once, at native startup, so changing
 * it costs a reload. Two things make that dangerous, and both are handled here:
 * on web I18nManager.forceRTL never takes effect, and on any platform a reload
 * that fails to flip the direction would reload again on the next launch —
 * forever. We reload at most once per launch and fall back to asking.
 */
let directionReloadAttempted = false;

async function applyDirection(locale: Locale, restartMessage: () => void) {
  const shouldBeRTL = locale === "he";

  if (Platform.OS === "web") {
    // The document owns direction on web; I18nManager is a no-op there.
    if (typeof document !== "undefined") {
      document.documentElement.dir = shouldBeRTL ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
    return;
  }

  if (I18nManager.isRTL === shouldBeRTL) return;

  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);

  if (directionReloadAttempted) {
    // The flip did not survive the last reload. Reloading again would loop.
    restartMessage();
    return;
  }
  directionReloadAttempted = true;

  try {
    await Updates.reloadAsync();
  } catch {
    // Expected in Expo Go and in dev builds without an update channel.
    restartMessage();
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  const [ready, setReady] = useState(false);

  const restartMessage = useCallback(() => {
    Alert.alert(
      he.common.restartNeeded,
      he.common.restartBody,
      [{ text: he.common.ok }],
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(STORAGE_KEY);
      } catch {
        // Storage unavailable — fall back to the device locale.
      }

      const initial: Locale = stored === "he" || stored === "en" ? stored : deviceLocale();
      if (cancelled) return;

      setLocaleState(initial);
      setReady(true);
      await applyDirection(initial, restartMessage);
    })();

    return () => {
      cancelled = true;
    };
  }, [restartMessage]);

  const setLocale = useCallback(
    async (next: Locale) => {
      setLocaleState(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, next);
      } catch {
        // A failed write only costs the preference on next launch.
      }
      await applyDirection(next, restartMessage);
    },
    [restartMessage],
  );

  const value = useMemo<I18nValue>(
    () => ({
      t: DICTS[locale],
      locale,
      isRTL: locale === "he",
      ready,
      setLocale,
    }),
    [locale, ready, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return value;
}
