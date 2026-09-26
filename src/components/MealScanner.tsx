import { useState } from "react";
import { useRouter } from "expo-router";
import { Image, Platform, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card } from "@/components/Card";
import { PillButton } from "@/components/PillButton";
import { Button } from "@/components/Button";
import { ProGate, ProRemaining } from "@/components/ProGate";
import { mealLabel, type MealAnalysis } from "@/ai/nutrition";
import { manipulator, recognizePhoto, type Recognition } from "@/ai/recognize";
import { FoodThumb } from "@/components/FoodThumb";
import { dailyTarget } from "@/kitchen";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; uri: string }
  | { kind: "read"; uri: string; analysis: MealAnalysis }
  /** Recognised on the phone: the dishes the photo most looks like. */
  | { kind: "guessed"; uri: string; guesses: Recognition[] }
  | { kind: "saved"; kcal: number; goal: number }
  | { kind: "failed"; reason: "quota" | "unavailable" | "unreadable" | "denied" | "off" };

/**
 * Photograph the meal, get the calories.
 *
 * The picture goes to our own server, which holds the model key and returns an
 * estimate; nothing is written to the diary until the person has seen the list
 * and pressed save, because an estimate from a photo is exactly that. When no
 * key is configured, or the free tier's daily quota is spent, the card says so
 * plainly and points at the search box — it never pretends to be broken.
 */
export function MealScanner() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { logMeal, state, goal: goalOf, todayIntake, allowance, noteUsed } = useStore();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const router = useRouter();

  const canPick = Platform.OS !== "web";
  const canScan = allowance("mealPhoto").ok;

  async function scan(fromCamera: boolean) {
    // Checked before the camera or the picker opens: nobody should frame a
    // plate, take the shot and only then be told it will not be read.
    if (!allowance("mealPhoto").ok) return;
    try {
      // With the resizer the photo is shrunk natively before it is read; the
      // full-size base64 is only asked for when it is missing (an older
      // install), because decoding a 12 MP picture in JavaScript is slow.
      const opts = { quality: 0.7, base64: !manipulator() } as const;
      let res;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        // Once the OS has remembered a "no" it stops showing the dialog, so a
        // silent return left the button doing nothing for good.
        if (!perm.granted) {
          setPhase({ kind: "failed", reason: "denied" });
          return;
        }
        res = await ImagePicker.launchCameraAsync(opts);
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
      }
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      setPhase({ kind: "reading", uri: asset.uri });
      // Let the "reading…" state paint before the model takes the thread.
      await new Promise((r) => setTimeout(r, 50));

      // Recognised on the phone itself: no key, no server, no quota — the
      // photo never leaves the device.
      const guesses = await recognizePhoto(asset.uri, asset.base64 ?? null, locale === "he" ? "he" : "en");
      if (guesses.length === 0) {
        setPhase({ kind: "failed", reason: "unreadable" });
        return;
      }
      noteUsed("mealPhoto");
      setPhase({ kind: "guessed", uri: asset.uri, guesses });
    } catch {
      setPhase({ kind: "failed", reason: "unreadable" });
    }
  }

  function save() {
    if (phase.kind !== "read") return;
    const { analysis } = phase;
    logMeal(mealLabel(analysis, t.scan.fallbackLabel), analysis.kcal, analysis.protein);
    // The card collapsing was the only sign anything happened, and the diary it
    // wrote to is a screen away — so the card says where the day stands instead.
    const weightKg = state.weighIns[state.weighIns.length - 1]?.kg ?? state.profile.startKg;
    setPhase({
      kind: "saved",
      kcal: todayIntake().kcal + analysis.kcal,
      goal: dailyTarget(weightKg, goalOf()).kcal,
    });
  }

  return (
    <Card label={t.scan.title}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.scan.body}</Text>

      {!canPick ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.scan.phoneOnly}</Text>
          <PillButton
            tone="soft"
            icon="calculator"
            label={t.kitchen.calcOpen}
            onPress={() => router.push("/calc")}
            style={{ alignSelf: "flex-start" }}
          />
        </View>
      ) : phase.kind === "idle" || phase.kind === "failed" || phase.kind === "saved" ? (
        <>
          {/* At the daily limit the two buttons are replaced outright, rather
              than left on screen to open a camera whose picture we will not
              read. What was already scanned and saved today stays below. */}
          {canScan ? (
            <>
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                <PillButton icon="camera" label={t.scan.take} onPress={() => scan(true)} style={{ flex: 1 }} />
                <PillButton tone="soft" icon="images" label={t.scan.pick} onPress={() => scan(false)} style={{ flex: 1 }} />
              </View>
              <View style={{ marginTop: space.sm }}>
                <ProRemaining feature="mealPhoto" />
              </View>
              <Pressable
                onPress={() => router.push("/calc")}
                accessibilityRole="button"
                style={{ marginTop: space.sm }}
              >
                <Text style={[type.smallStrong, { color: colors.accent }]}>
                  {t.kitchen.calcOpen} · {t.kitchen.calcHint}
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={{ marginTop: space.md }}>
              <ProGate feature="mealPhoto" />
            </View>
          )}
          {phase.kind === "failed" ? (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <Text style={[type.small, { color: colors.orangeInk }]}>
                {phase.reason === "quota"
                  ? t.scan.quota
                  : phase.reason === "unreadable"
                    ? t.scan.unreadable
                    : phase.reason === "denied"
                      ? t.kitchen.cameraDenied
                      : phase.reason === "off"
                        ? t.scan.off
                        : t.scan.unavailable}
              </Text>
              {/* Reading a photograph can fail for half a dozen reasons we do
                  not control. Counting the meal by hand cannot, so every one of
                  those endings offers it rather than stopping here. */}
              <PillButton
                tone="soft"
                icon="calculator"
                label={t.kitchen.calcOpen}
                onPress={() => router.push("/calc")}
                style={{ alignSelf: "flex-start" }}
              />
            </View>
          ) : null}
          {phase.kind === "saved" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>
                {fill(t.kitchen.loggedToast, { kcal: phase.kcal, goal: phase.goal })}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {phase.kind === "reading" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md }}>
          <Image
            source={{ uri: phase.uri }}
            style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
          />
          <Text style={[type.body, { color: colors.inkSoft, flex: 1 }]}>{t.scan.reading}</Text>
        </View>
      ) : null}

      {phase.kind === "guessed" ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Image
              source={{ uri: phase.uri }}
              style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.title, { color: colors.ink }]}>{t.scan.looksLike}</Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>{t.scan.pickOne}</Text>
            </View>
          </View>
          {/* A classifier names what the plate most looks like; the person
              picks the right one and the calculator weighs it with real
              nutrition. The best guess is first and marked. */}
          <View style={{ gap: 6 }}>
            {phase.guesses.map((g, i) => (
              <Pressable
                key={`${g.label}-${i}`}
                onPress={() => {
                  setPhase({ kind: "idle" });
                  if (g.food) {
                    router.push({ pathname: "/calc", params: { items: JSON.stringify([{ label: g.name }]) } });
                  } else {
                    router.push({ pathname: "/calc", params: { q: g.label } });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={g.name}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  paddingVertical: 9,
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  borderWidth: i === 0 ? 1 : 0,
                  borderColor: colors.accent,
                  backgroundColor: pressed ? colors.accentWash : i === 0 ? colors.accentWash : colors.surfaceAlt,
                })}
              >
                {g.food ? <FoodThumb food={g.food} size={30} /> : <Ionicons name="restaurant" size={20} color={colors.inkFaint} />}
                <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text style={[type.small, { color: colors.inkFaint }]}>{Math.round(g.score * 100)}%</Text>
                <Ionicons name="add-circle" size={22} color={colors.accent} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <PillButton
              tone="soft"
              icon="search"
              label={t.scan.noneOfThese}
              onPress={() => {
                setPhase({ kind: "idle" });
                router.push("/calc");
              }}
              style={{ flex: 1 }}
            />
            <PillButton tone="soft" label={t.common.cancel} onPress={() => setPhase({ kind: "idle" })} />
          </View>
          <Text style={[type.small, { color: colors.inkFaint }]}>{t.scan.onDeviceNote}</Text>
        </View>
      ) : null}

      {phase.kind === "read" ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Image
              source={{ uri: phase.uri }}
              style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[type.figure, { color: colors.ink }]}>
                ≈{phase.analysis.kcal}
                <Text style={[type.small, { color: colors.inkFaint }]}> {t.kitchen.kcal}</Text>
              </Text>
              <Text style={[type.small, { color: colors.inkSoft }]}>
                {phase.analysis.protein}
                {t.kitchen.grams} {t.kitchen.protein}
              </Text>
            </View>
          </View>

          {/* what it thinks is on the plate, so the estimate can be judged */}
          <View style={{ gap: 4 }}>
            {phase.analysis.items.map((item, i) => (
              <View key={`${item.label}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Ionicons name="ellipse" size={7} color={colors.accent} />
                <Text style={[type.small, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
                  {item.label}
                  {item.grams > 0 ? ` · ${item.grams}${t.kitchen.grams}` : ""}
                </Text>
                <Text style={[type.small, { color: colors.inkFaint }]}>≈{item.kcal}</Text>
              </View>
            ))}
          </View>

          <Text style={[type.small, { color: colors.inkFaint }]}>
            {fill(t.scan.confidence, { pct: Math.round(phase.analysis.confidence * 100) })} · {t.scan.estimateNote}
          </Text>

          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button icon="add-circle" label={t.scan.save} onPress={save} style={{ flex: 1 }} />
            <PillButton tone="soft" label={t.common.cancel} onPress={() => setPhase({ kind: "idle" })} />
          </View>
          {/* A guess from a photograph is a starting point, not a verdict. This
              opens the same list in the calculator, where every item and every
              weight can be corrected before it reaches the diary. */}
          <PillButton
            tone="soft"
            icon="create"
            label={t.kitchen.calcFromPhoto}
            onPress={() => {
              const items = phase.analysis.items.map((i) => ({
                label: i.label,
                grams: i.grams,
                kcal: i.kcal,
                protein: i.protein,
              }));
              setPhase({ kind: "idle" });
              router.push({ pathname: "/calc", params: { items: JSON.stringify(items) } });
            }}
            style={{ alignSelf: "flex-start" }}
          />
        </View>
      ) : null}
    </Card>
  );
}
