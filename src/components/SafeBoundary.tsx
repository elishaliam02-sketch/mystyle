import AsyncStorage from "@react-native-async-storage/async-storage";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/** Where the last error the app caught is kept, for the profile's version card. */
export const LAST_ERROR_KEY = "mystyle.lastError";

/** Keeps the latest caught error on the phone: where, what, when — so a
 * screenshot of the profile says exactly what went wrong on that phone. */
export function recordError(where: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  AsyncStorage.setItem(LAST_ERROR_KEY, JSON.stringify({ where, message: message.slice(0, 300), at: Date.now() })).catch(
    () => {},
  );
}

type Props = {
  /** A name for the place, saved with the error ("scanner", "app"). */
  where: string;
  /** What to show instead of the part that failed; a retry is passed in. */
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
};

/**
 * A part of the screen that may fail without taking the app with it.
 *
 * In a release build an error thrown while drawing closes the whole app. Around
 * the meal scanner (photos, the model, a dish it has never seen) that is the
 * difference between "that photo did not work, try again" and the app
 * vanishing — so the scanner, and the app as a whole, sit inside one of these.
 */
export class SafeBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    recordError(this.props.where, error);
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

/** A plain fallback for when the theme itself may be what failed. */
export function PlainFallback({ title, body, action, onRetry }: { title: string; body: string; action: string; onRetry: () => void }) {
  return (
    <View style={{ padding: 20, gap: 10, borderRadius: 16, backgroundColor: "#FFF4E8" }}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: "#3A2A1A", textAlign: "right" }}>{title}</Text>
      <Text style={{ fontSize: 14, color: "#5A4632", textAlign: "right" }}>{body}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={{ alignSelf: "flex-end", paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: "#6D3BFF" }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{action}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Errors outside drawing — a timer, a callback, a promise nobody awaited.
 * React Native's default handler closes a release build on a "fatal" one; here
 * the error is recorded and the app keeps going, because a pilot user seeing
 * the app disappear learns nothing, and we learn nothing either.
 */
export function installGlobalErrorHandler(): void {
  const g = globalThis as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
      setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void;
    };
    __apexErrorsInstalled?: boolean;
  };
  if (!g.ErrorUtils || g.__apexErrorsInstalled) return;
  g.__apexErrorsInstalled = true;
  const previous = g.ErrorUtils.getGlobalHandler();
  const startedAt = Date.now();
  g.ErrorUtils.setGlobalHandler((error, fatal) => {
    recordError(fatal ? "fatal" : "error", error);
    // Development keeps the red screen, which is how errors get noticed. And a
    // crash in the first seconds after launch still goes the default way: that
    // is how expo-updates spots a broken update and rolls back to the last
    // good one — swallowing it would strand the phone on the broken version.
    if (__DEV__ || (fatal && Date.now() - startedAt < 10_000)) previous(error, fatal);
  });
}
