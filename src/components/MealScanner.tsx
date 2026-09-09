import { useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card } from "@/components/Card";
import { PillButton } from "@/components/PillButton";
import { Button } from "@/components/Button";
import { askServer } from "@/ai/server";
import { mealLabel, mealPhotoPrompt, parseMealAnalysis, type MealAnalysis } from "@/ai/nutrition";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; uri: string }
  | { kind: "read"; uri: string; analysis: MealAnalysis }
  | { kind: "failed"; reason: "quota" | "unavailable" | "unreadable" };

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
  const { logMeal } = useStore();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const canPick = Platform.OS !== "web";

  async function scan(fromCamera: boolean) {
    try {
      const opts = { quality: 0.5, base64: true } as const;
      let res;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        res = await ImagePicker.launchCameraAsync(opts);
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
      }
      if (res.canceled || !res.assets[0]?.base64) return;
      const asset = res.assets[0];
      setPhase({ kind: "reading", uri: asset.uri });

      const answer = await askServer({
        prompt: mealPhotoPrompt(locale),
        imageBase64: asset.base64!,
        mimeType: asset.mimeType ?? "image/jpeg",
      });

      if (!answer.ok) {
        setPhase({ kind: "failed", reason: answer.reason === "quota" ? "quota" : "unavailable" });
        return;
      }
      const analysis = parseMealAnalysis(answer.text);
      if (!analysis) {
        setPhase({ kind: "failed", reason: "unreadable" });
        return;
      }
      setPhase({ kind: "read", uri: asset.uri, analysis });
    } catch {
      setPhase({ kind: "failed", reason: "unavailable" });
    }
  }

  function save() {
    if (phase.kind !== "read") return;
    const { analysis } = phase;
    logMeal(mealLabel(analysis, t.scan.fallbackLabel), analysis.kcal, analysis.protein);
    setPhase({ kind: "idle" });
  }

  return (
    <Card label={t.scan.title}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.scan.body}</Text>

      {!canPick ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.scan.phoneOnly}
        </Text>
      ) : phase.kind === "idle" || phase.kind === "failed" ? (
        <>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <PillButton icon="camera" label={t.scan.take} onPress={() => scan(true)} style={{ flex: 1 }} />
            <PillButton tone="soft" icon="images" label={t.scan.pick} onPress={() => scan(false)} style={{ flex: 1 }} />
          </View>
          {phase.kind === "failed" ? (
            <Text style={[type.small, { color: colors.orangeInk, marginTop: space.sm }]}>
              {phase.reason === "quota"
                ? t.scan.quota
                : phase.reason === "unreadable"
                  ? t.scan.unreadable
                  : t.scan.unavailable}
            </Text>
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
        </View>
      ) : null}
    </Card>
  );
}
