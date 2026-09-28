import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

/**
 * Small pieces of motion that make the numbers feel alive: a figure that
 * counts up to its new value, a bar that fills instead of jumping, and a pop
 * when something is added. All of it runs on the JS clock or the native
 * driver where it can, and settles instantly for a first render so a screen
 * never opens mid-animation.
 */

/**
 * A number that counts from its previous value to the new one. With
 * `fromZero` it also counts up from nothing when the screen first opens.
 */
export function useCountUp(value: number, ms = 650, fromZero = false): number {
  const [shown, setShown] = useState(fromZero ? 0 : value);
  const from = useRef(fromZero ? 0 : value);
  const first = useRef(!fromZero);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * eased);
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

/** A progress bar that grows to its value. `ghost` shows a pending extra in a lighter tint. */
export function GrowBar({
  pct,
  color,
  track,
  ghostPct = 0,
  ghostColor,
  height = 10,
  style,
}: {
  pct: number;
  color: string;
  track: string;
  ghostPct?: number;
  ghostColor?: string;
  height?: number;
  style?: ViewStyle;
}) {
  // Starts empty and grows to its value when the screen opens.
  const w = useRef(new Animated.Value(0)).current;
  const g = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(100, pct)), duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(g, { toValue: Math.max(0, Math.min(100, pct + ghostPct)), duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, ghostPct, w, g]);
  const toWidth = (v: Animated.Value) => v.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }, style]}>
      {ghostPct > 0 ? (
        <Animated.View
          style={{ position: "absolute", top: 0, bottom: 0, start: 0, width: toWidth(g), backgroundColor: ghostColor ?? color, opacity: 0.35, borderRadius: height / 2 }}
        />
      ) : null}
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, start: 0, width: toWidth(w), backgroundColor: color, borderRadius: height / 2 }} />
    </Animated.View>
  );
}

/** Pops its children (a quick grow and settle) whenever `trigger` changes. */
export function Pop({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: ViewStyle }) {
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    s.setValue(1);
    Animated.sequence([
      Animated.timing(s, { toValue: 1.12, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [trigger, s]);
  return <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>;
}

/** Fades and lifts its children in once, on mount. */
export function Rise({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View
      style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}
    >
      {children}
    </Animated.View>
  );
}
