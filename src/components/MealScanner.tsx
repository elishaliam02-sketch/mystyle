import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Platform, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card } from "@/components/Card";
import { fileSystem, imagePicker } from "@/native/optional";
import { PillButton } from "@/components/PillButton";
import { Button } from "@/components/Button";
import { ProGate, ProRemaining } from "@/components/ProGate";
import { mealLabel, type MealAnalysis } from "@/ai/nutrition";
import { fastRecognition, needsPhotoData, recognizePhoto, simulateLegacyInstall, type Recognition, type ScanStage } from "@/ai/recognize";
import { FoodThumb } from "@/components/FoodThumb";
import { gramsNutrition, portion, scaledHousehold, type Food } from "@/kitchen";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";
/** Where a photo reading got to while it runs; see readPhoto. */
export const SCAN_STAGE_KEY = "mystyle.scan.stage";
/** The last reading that stopped half-way, for the profile's version card. */
export const SCAN_LAST_CRASH_KEY = "mystyle.scan.lastCrash";

/**
 * Whether the app was closed while the camera was open. Android does this to
 * a background app when the phone runs short of memory — the camera app is
 * heavy — and the app then starts from scratch on its first screen, which to
 * the person is the app crashing. The root layout asks this on launch and
 * brings them back to the scanner, which picks up the photo the camera took.
 */
export async function cameraWasInterrupted(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_STAGE_KEY);
    return !!raw && (JSON.parse(raw) as { stage?: string }).stage === "camera";
  } catch {
    return false;
  }
}

/** The photo the camera took before Android closed the app, read once for
 * every scanner on screen (the kitchen and the calculator both have one). */
let pendingOnce: Promise<{ uri: string; base64?: string | null } | null> | null = null;
function pendingPhoto() {
  pendingOnce ??= (async () => {
    const picker = imagePicker();
    if (!picker || Platform.OS !== "android") return null;
    const pending = await picker.getPendingResultAsync();
    if (pending && "assets" in pending && !pending.canceled && pending.assets?.[0]) {
      return { uri: pending.assets[0].uri, base64: pending.assets[0].base64 };
    }
    return null;
  })().catch(() => null);
  return pendingOnce;
}
let pendingClaimed = false;

/**
 * The photo the camera saved when Android had already killed the app.
 *
 * The picker can hand a photo back after its screen was destroyed, but not
 * after the whole app process was killed for memory — its bookkeeping is only
 * saved on a normal close, so on a real phone short of memory the photo was
 * simply lost (reproduced on the test emulator). The camera still writes the
 * picture into the file the picker gave it, in the app's own cache
 * ("ImagePicker/"), so the newest non-empty photo there, taken after the
 * camera was opened, is the one.
 */
async function orphanCameraPhoto(sinceMs: number): Promise<{ uri: string; base64: string } | null> {
  const fs = fileSystem();
  if (!fs?.cacheDirectory || Platform.OS !== "android") return null;
  const dir = `${fs.cacheDirectory}ImagePicker/`;
  const names = await fs.readDirectoryAsync(dir).catch(() => [] as string[]);
  let best: { uri: string; t: number; size: number } | null = null;
  for (const name of names) {
    if (!/\.jpe?g$/i.test(name)) continue;
    const info = await fs.getInfoAsync(`${dir}${name}`).catch(() => null);
    if (!info || !info.exists || info.isDirectory || !info.size) continue;
    const t = (info.modificationTime ?? 0) * 1000;
    if (t < sinceMs - 10_000) continue;
    if (!best || t > best.t) best = { uri: `${dir}${name}`, t, size: info.size };
  }
  // A photo past 30 MB is not a phone camera's; leave it rather than risk memory.
  if (!best || best.size > 30 * 1024 * 1024) return null;
  const base64 = await fs.readAsStringAsync(best.uri, { encoding: fs.EncodingType.Base64 });
  return { uri: best.uri, base64 };
}

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; uri: string }
  | { kind: "read"; uri: string; analysis: MealAnalysis }
  /** Recognised on the phone: the dishes the photo most looks like. */
  | { kind: "guessed"; uri: string; guesses: Recognition[] }
  | { kind: "saved"; kcal: number; goal: number }
  | {
      kind: "failed";
      reason: "quota" | "unavailable" | "unreadable" | "denied" | "off" | "oldApp" | "crashed" | "cameraLost";
      stage?: string;
    };

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
  const { logMeal, todayIntake, calorieTarget, allowance, noteUsed } = useStore();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // The guess being weighed and how many portions of it: the best guess is
  // open from the start, so a correct photo is two taps from the diary.
  const [chosen, setChosen] = useState(0);
  const [mult, setMult] = useState(1);
  const router = useRouter();

  // The browser (an iPhone on the web version) picks or takes a photo through
  // its own file picker and reads it with the JavaScript model.
  const canPick = true;
  const canScan = allowance("mealPhoto").ok;

  // Where the reading of a photo got to, kept on the phone while it runs. If
  // the app is closed mid-way (out of memory, or Android killing it while the
  // camera was open), the next opening finds it, says so, and the profile can
  // show which step it was — rather than the scanner silently doing nothing.
  const mark = (stage: "camera" | "picked" | ScanStage) =>
    AsyncStorage.setItem(SCAN_STAGE_KEY, JSON.stringify({ stage, at: Date.now() })).catch(() => {});
  const unmark = () => AsyncStorage.removeItem(SCAN_STAGE_KEY).catch(() => {});

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        // The device test's switch for driving the older-install path.
        simulateLegacyInstall((await AsyncStorage.getItem("mystyle.debug.legacyScan")) === "1");
        const raw = await AsyncStorage.getItem(SCAN_STAGE_KEY);
        const mark0 = raw ? (JSON.parse(raw) as { stage?: string; at?: number }) : null;
        const stage = mark0?.stage ?? "";
        // Android may close the app while the camera is open; the photo it
        // took is waiting here, and is read as if nothing had happened.
        const pending = await pendingPhoto();
        if (pending && !pendingClaimed) {
          pendingClaimed = true;
          if (live) void readPhoto(pending.uri, pending.base64);
          return;
        }
        if (!raw || pendingClaimed) return;
        if (stage === "camera") {
          // Killed with the camera open: the photo is still in the app's cache.
          pendingClaimed = true;
          const orphan = await orphanCameraPhoto(mark0?.at ?? 0).catch(() => null);
          await unmark();
          if (orphan) {
            if (live) void readPhoto(orphan.uri, orphan.base64);
            return;
          }
          // Closed while the camera was open and the photo did not survive.
          if (live) setPhase({ kind: "failed", reason: "cameraLost" });
          return;
        }
        await unmark();
        await AsyncStorage.setItem(SCAN_LAST_CRASH_KEY, JSON.stringify({ stage, at: Date.now() })).catch(() => {});
        if (live) setPhase({ kind: "failed", reason: "crashed", stage });
      } catch {
        // Nothing to recover.
      }
    })();
    return () => {
      live = false;
    };
    // Once, when the scanner first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readPhoto(uri: string, photoBase64?: string | null) {
    setPhase({ kind: "reading", uri });
    await mark("picked");
    // Let the "reading…" state paint before the model takes the thread.
    await new Promise((r) => setTimeout(r, 50));
    try {
      // Recognised on the phone itself: no key, no server, no quota — the
      // photo never leaves the device.
      const guesses = await recognizePhoto(
        uri,
        locale === "he" ? "he" : "en",
        (stage) => void mark(stage),
        photoBase64,
      );
      await unmark();
      if (guesses.length === 0) {
        setPhase({ kind: "failed", reason: "unreadable" });
        return;
      }
      noteUsed("mealPhoto");
      setChosen(Math.max(0, guesses.findIndex((g) => g.food)));
      setMult(1);
      setPhase({ kind: "guessed", uri, guesses });
    } catch {
      await unmark();
      setPhase({ kind: "failed", reason: "unreadable" });
    }
  }

  async function scan(fromCamera: boolean) {
    // Checked before the camera or the picker opens: nobody should frame a
    // plate, take the shot and only then be told it will not be read.
    if (!allowance("mealPhoto").ok) return;
    const ImagePicker = imagePicker();
    // Only an install from before the camera was added cannot take a photo.
    if (!ImagePicker) {
      setPhase({ kind: "failed", reason: "oldApp" });
      return;
    }
    try {
      // On a phone the camera's file comes back untouched, as bytes: any
      // quality below 1 makes the picker decode the whole photo into a bitmap
      // to re-compress it (48 MB for 12 MP, far more on a 50 MP camera) —
      // that, not the recognition, is what closed the app on real phones.
      // The bytes are then read small (recognize.ts → photoPixels).
      const opts = needsPhotoData(Platform.OS)
        ? ({ quality: 1, base64: true, exif: false } as const)
        : ({ quality: 0.8 } as const);
      let res;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        // Once the OS has remembered a "no" it stops showing the dialog, so a
        // silent return left the button doing nothing for good.
        if (!perm.granted) {
          setPhase({ kind: "failed", reason: "denied" });
          return;
        }
        await mark("camera");
        res = await ImagePicker.launchCameraAsync(opts);
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
      }
      if (res.canceled || !res.assets[0]) {
        await unmark();
        return;
      }
      await readPhoto(res.assets[0].uri, res.assets[0].base64);
    } catch {
      await unmark();
      setPhase({ kind: "failed", reason: "unreadable" });
    }
  }

  /** One portion of a recognised food, scaled — what the row shows and logs. */
  function amountOf(food: Food, m: number) {
    const std = portion(food.id);
    const grams = Math.round(std.g * m);
    const lang = locale === "he" ? "he" : "en";
    return { grams, text: scaledHousehold(lang === "he" ? std.he : std.en, m, lang), ...gramsNutrition(food, grams) };
  }

  function logGuess(g: Recognition) {
    if (!g.food) return;
    const a = amountOf(g.food, mult);
    logMeal(`${g.name} · ${a.grams} ${t.kitchen.gram}`, a.kcal, a.protein);
    setPhase({ kind: "saved", kcal: todayIntake().kcal + a.kcal, goal: calorieTarget().kcal });
  }

  function save() {
    if (phase.kind !== "read") return;
    const { analysis } = phase;
    logMeal(mealLabel(analysis, t.scan.fallbackLabel), analysis.kcal, analysis.protein);
    // The card collapsing was the only sign anything happened, and the diary it
    // wrote to is a screen away — so the card says where the day stands instead.
    setPhase({
      kind: "saved",
      kcal: todayIntake().kcal + analysis.kcal,
      goal: calorieTarget().kcal,
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
                        : phase.reason === "oldApp"
                          ? t.common.needsNewInstall
                          : phase.reason === "cameraLost"
                            ? t.scan.cameraLost
                          : phase.reason === "crashed"
                            ? t.scan.crashed
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
          <Text style={[type.body, { color: colors.inkSoft, flex: 1 }]}>{fastRecognition() ? t.scan.reading : t.scan.readingSlow}</Text>
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
            {phase.guesses.map((g, i) => {
              const open = i === chosen && !!g.food;
              const one = g.food ? amountOf(g.food, 1) : null;
              const now = g.food && open ? amountOf(g.food, mult) : null;
              return (
                <View
                  key={`${g.label}-${i}`}
                  style={{
                    borderRadius: radius.md,
                    borderWidth: open ? 1 : 0,
                    borderColor: colors.accent,
                    backgroundColor: open ? colors.accentWash : colors.surfaceAlt,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (g.food) {
                        setChosen(i);
                        setMult(1);
                      } else {
                        setPhase({ kind: "idle" });
                        router.push({ pathname: "/calc", params: { q: g.label } });
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={g.name}
                    accessibilityState={{ selected: open }}
                    style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 9, paddingHorizontal: space.md }}
                  >
                    {g.food ? <FoodThumb food={g.food} size={30} /> : <Ionicons name="restaurant" size={20} color={colors.inkFaint} />}
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
                        {one ? `≈${one.kcal} ${t.kitchen.kcal} · ${one.text}` : t.scan.searchIt}
                      </Text>
                    </View>
                    <Text style={[type.small, { color: colors.inkFaint }]}>{Math.round(g.score * 100)}%</Text>
                    <Ionicons name={g.food ? (open ? "checkmark-circle" : "ellipse-outline") : "search"} size={22} color={colors.accent} />
                  </Pressable>

                  {open && now ? (
                    <View style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm }}>
                      <Text style={[type.smallStrong, { color: colors.inkSoft }]}>{t.scan.howMuch}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {[0.5, 1, 1.5, 2].map((m) => (
                          <Pressable
                            key={m}
                            onPress={() => setMult(m)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: mult === m }}
                            style={{
                              flex: 1,
                              alignItems: "center",
                              paddingVertical: 8,
                              borderRadius: radius.pill,
                              backgroundColor: mult === m ? colors.accent : colors.surface,
                            }}
                          >
                            <Text style={[type.smallStrong, { color: mult === m ? colors.onAccent : colors.ink }]}>
                              {m === 0.5 ? "½" : m === 1.5 ? "1½" : String(m)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.md }}>
                        <Text style={[type.figure, { color: colors.ink }]}>≈{now.kcal}</Text>
                        <Text style={[type.small, { color: colors.inkSoft }]}>
                          {t.kitchen.kcal} · {now.protein}
                          {t.kitchen.grams} {t.kitchen.protein} · {now.text} ({now.grams} {t.kitchen.gram})
                        </Text>
                      </View>
                      {g.food?.src === "ai" ? (
                        <Text style={[type.small, { color: colors.inkFaint }]}>{t.scan.estimated}</Text>
                      ) : null}
                      <Button icon="add-circle" label={t.scan.save} onPress={() => logGuess(g)} />
                      <Pressable
                        onPress={() => {
                          setPhase({ kind: "idle" });
                          router.push({ pathname: "/calc", params: { items: JSON.stringify([{ label: g.name, grams: now.grams }]) } });
                        }}
                        accessibilityRole="button"
                      >
                        <Text style={[type.smallStrong, { color: colors.accent }]}>{t.scan.addMore}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
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
