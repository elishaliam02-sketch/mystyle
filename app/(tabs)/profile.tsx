import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { TextField } from "@/components/TextField";
import { useCloud } from "@/cloud/useCloud";
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

  const [name, setName] = useState(state.profile.name);
  const [goal, setGoal] = useState(state.profile.goalKg ? String(state.profile.goalKg) : "");

  function persist() {
    saveProfile({
      name: name.trim(),
      goalKg: goal.trim() ? Number(goal.replace(",", ".")) : undefined,
    });
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
              value={goal}
              onChangeText={setGoal}
              label={t.profile.goalTitle}
              placeholder={t.profile.goalPlaceholder}
              keyboardType="numeric"
            />
            <Button label={t.profile.saved} onPress={persist} tone="quiet" />
          </View>
        </Card>

        <Card label={t.profile.languageTitle}>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {LOCALES.map(({ id, label }) => {
              const selected = locale === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => void setLocale(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    backgroundColor: selected ? colors.accent : "transparent",
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.rule,
                    borderRadius: radius.pill,
                    paddingVertical: space.md,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    style={[
                      type.bodyStrong,
                      { color: selected ? colors.onAccent : colors.ink },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
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
