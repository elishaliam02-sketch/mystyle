import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { TextField } from "@/components/TextField";
import { useCloud } from "@/cloud/useCloud";
import { SelectTile } from "@/components/SelectTile";
import {
  bmi,
  checkGoalWeight,
  healthyRange,
  isHeightCm,
  MAX_HEIGHT_CM,
  MIN_HEIGHT_CM,
} from "@/health";
import { useI18n, type Locale, fill } from "@/i18n";
import { useReminders } from "@/notifications/useReminders";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

const LOCALES: { id: Locale; label: string }[] = [
  { id: "he", label: "עברית" },
  { id: "en", label: "English" },
];

export default function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const { state, saveProfile, reset } = useStore();
  const reminders = useReminders();
  const cloud = useCloud();

  // Seeded empty and filled once the store has loaded from disk: reading state
  // on the first render caught the profile before it hydrated, so the fields
  // showed blank — and pressing save then wrote that blank over a real name.
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [height, setHeight] = useState("");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (state.profile.name) setName(state.profile.name);
    if (state.profile.goalKg) setGoal(String(state.profile.goalKg));
    if (state.profile.heightCm) setHeight(String(state.profile.heightCm));
  }, [state.profile.name, state.profile.goalKg, state.profile.heightCm]);

  // The weight the goal is judged against: the last time they stepped on a
  // scale, or the figure they started with.
  const currentKg =
    [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ??
    state.profile.startKg;
  const heightCm = height.trim() ? Number(height.replace(",", ".")) : undefined;
  const nowBmi = currentKg ? bmi(currentKg, heightCm) : null;
  const band = heightCm && isHeightCm(heightCm) ? healthyRange(heightCm) : null;

  function persist() {
    const cm = height.trim() ? Number(height.replace(",", ".")) : undefined;
    if (cm !== undefined && !isHeightCm(cm)) {
      setNote(fill(t.profile.heightRange, { min: MIN_HEIGHT_CM, max: MAX_HEIGHT_CM }));
      return;
    }
    const kg = goal.trim() ? Number(goal.replace(",", ".")) : undefined;
    if (kg !== undefined) {
      // A target under the healthy floor is refused outright — there is no
      // "tap again to confirm" for a number that would make someone ill.
      const verdict = checkGoalWeight(kg, currentKg, cm);
      if (verdict.status === "out-of-range") {
        setNote(fill(t.profile.goalRange, { min: verdict.min, max: verdict.max }));
        return;
      }
      if (verdict.status === "needs-height") {
        setNote(t.profile.goalNeedsHeight);
        return;
      }
      if (verdict.status === "too-low") {
        setNote(fill(t.profile.goalTooLow, { floor: verdict.floor }));
        return;
      }
      if (verdict.status === "too-high") {
        setNote(fill(t.profile.goalTooHigh, { ceiling: verdict.ceiling }));
        return;
      }
    }
    saveProfile({ name: name.trim(), goalKg: kg, heightCm: cm });
    setNote(null);
  }

  function confirmReset() {
    Alert.alert(t.profile.dangerTitle, t.profile.dangerConfirm, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.profile.dangerYes, style: "destructive", onPress: reset },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.profile.heading}>
        <View style={{ alignItems: "center", paddingVertical: space.md }}>
          <BrandLogo size={72} onBand={false} />
        </View>
        <Card>
          <View style={{ gap: space.lg }}>
            <TextField
              value={name}
              onChangeText={setName}
              label={t.profile.nameTitle}
              placeholder={t.profile.namePlaceholder}
            />
            <TextField
              value={height}
              onChangeText={setHeight}
              label={t.profile.heightTitle}
              placeholder={t.profile.heightPlaceholder}
              keyboardType="numeric"
            />
            <TextField
              value={goal}
              onChangeText={setGoal}
              label={t.profile.goalTitle}
              placeholder={t.profile.goalPlaceholder}
              keyboardType="numeric"
            />
            {band ? (
              <Text style={[type.small, { color: colors.inkSoft }]}>
                {fill(t.profile.healthyBand, { min: band.min, max: band.max })}
                {nowBmi ? ` · ${fill(t.profile.bmiNow, { bmi: nowBmi })}` : ""}
              </Text>
            ) : null}
            {note ? (
              <Text style={[type.small, { color: colors.amber, fontWeight: "700" }]}>{note}</Text>
            ) : null}
            <Button label={t.profile.saved} onPress={persist} tone="quiet" />
          </View>
        </Card>

        <Card label={t.profile.languageTitle}>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {LOCALES.map(({ id, label }) => {
              const selected = locale === id;
              return (
                <SelectTile
                  key={id}
                  selected={selected}
                  onPress={() => void setLocale(id)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.rule,
                    borderRadius: radius.pill,
                    paddingVertical: space.md,
                  }}
                >
                  <Text
                    style={[
                      type.bodyStrong,
                      { color: selected ? colors.onAccent : colors.ink },
                    ]}
                  >
                    {label}
                  </Text>
                </SelectTile>
              );
            })}
          </View>
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
            {t.profile.languageNote}
          </Text>
        </Card>

        <Card label={t.profile.notificationsTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>
            {t.profile.notificationsBody}
          </Text>
          {reminders.supported ? (
            <>
              <Text
                style={[
                  type.bodyStrong,
                  { color: reminders.enabled ? colors.accent : colors.inkFaint, marginTop: space.sm },
                ]}
              >
                {reminders.enabled ? t.profile.notificationsOn : t.profile.notificationsOff}
              </Text>
              {reminders.enabled && reminders.count > 0 ? (
                <Text style={[type.small, { color: colors.inkFaint }]}>
                  {fill(t.profile.notificationsCount, { count: reminders.count })}
                </Text>
              ) : null}
              {reminders.denied ? (
                <Text style={[type.small, { color: colors.amber, marginTop: space.xs }]}>
                  {t.profile.notificationsDenied}
                </Text>
              ) : null}
              <Button
                icon={reminders.enabled ? "notifications-off-outline" : "notifications-outline"}
                label={
                  reminders.enabled
                    ? t.profile.notificationsDisable
                    : t.profile.notificationsEnable
                }
                tone={reminders.enabled ? "quiet" : "primary"}
                onPress={() => void reminders.toggle()}
                style={{ marginTop: space.md }}
              />
            </>
          ) : (
            <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
              {t.profile.notificationsWeb}
            </Text>
          )}
        </Card>

        <Card label={t.profile.cloudTitle}>
          <Text
            style={[
              type.bodyStrong,
              {
                color:
                  cloud.status === "synced"
                    ? colors.accent
                    : cloud.status === "error"
                      ? colors.alert
                      : colors.inkSoft,
              },
            ]}
          >
            {cloud.status === "connecting"
              ? t.profile.cloudConnecting
              : cloud.status === "synced"
                ? t.profile.cloudSynced
                : cloud.status === "error"
                  ? t.profile.cloudError
                  : t.profile.cloudLocal}
          </Text>
          {cloud.lastSync ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {fill(t.profile.cloudLastSync, {
                time: cloud.lastSync.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </Text>
          ) : null}
          <Button
            icon="cloud-upload-outline"
            label={t.profile.cloudSyncNow}
            tone="quiet"
            onPress={() => void cloud.sync()}
            style={{ marginTop: space.md }}
          />
        </Card>

        <StubNote>{t.profile.localNote}</StubNote>

        <Card label={t.profile.dangerTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.profile.dangerBody}</Text>
          <Button
            label={t.profile.dangerCta}
            tone="danger"
            onPress={confirmReset}
            style={{ marginTop: space.md }}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
