import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useI18n } from "@/i18n";
import { daysUsed, nextSetup, type SetupStep } from "@/insight/setup";
import { useReminders } from "@/notifications/useReminders";
import { webPushSupport } from "@/notifications/webpush";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

/** Device-local: what this phone has put aside is nobody else's business. */
const KEY = "apex.setup.snoozed";

/**
 * The one setup step worth doing next, offered on the home screen — install
 * on an iPhone, then reminders, then a backup — instead of left in Profile for
 * someone to stumble on. "Not now" puts it aside for two weeks.
 */
export function SetupCard() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { state, consent } = useStore();
  const reminders = useReminders();
  const [snoozed, setSnoozed] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        let parsed: Record<string, string> = {};
        try {
          const v = raw ? JSON.parse(raw) : {};
          if (v && typeof v === "object" && !Array.isArray(v)) parsed = v;
        } catch {
          parsed = {};
        }
        if (live) setSnoozed(parsed);
      })
      .catch(() => live && setSnoozed({}));
    return () => {
      live = false;
    };
  }, []);

  // Nothing until the stored answers are in, so a step put aside never flashes.
  if (!snoozed) return null;
  const web = Platform.OS === "web";
  const step = nextSetup({
    web,
    webSupport: web ? webPushSupport() : "no",
    nativeReminders: !web && reminders.supported,
    remindersOn: reminders.enabled,
    cloudOn: consent().cloud,
    daysUsed: daysUsed(state),
    snoozed,
    now: new Date(),
  });
  if (!step) return null;

  const later = (s: SetupStep) => {
    const next = { ...snoozed, [s]: new Date().toISOString() };
    setSnoozed(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  const copy = {
    install: { icon: "phone-portrait-outline" as const, title: t.setup.installTitle, body: t.setup.installBody },
    reminders: { icon: "notifications-outline" as const, title: t.setup.remindersTitle, body: t.setup.remindersBody },
    backup: { icon: "cloud-upload-outline" as const, title: t.setup.backupTitle, body: t.setup.backupBody },
  }[step];

  return (
    <Card tone="accent">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name={copy.icon} size={20} color={colors.accent} />
        <Text style={[type.title, { color: colors.ink, flex: 1 }]}>{copy.title}</Text>
      </View>
      <Text style={[type.body, { color: colors.ink, marginTop: space.sm }]}>{copy.body}</Text>
      {step === "reminders" && reminders.denied ? (
        <Text style={[type.small, { color: colors.orangeInk, marginTop: space.xs }]}>
          {reminders.web ? t.profile.notificationsDeniedWeb : t.profile.notificationsDenied}
        </Text>
      ) : null}
      {step === "reminders" && reminders.failed ? (
        <Text style={[type.small, { color: colors.orangeInk, marginTop: space.xs }]}>{t.profile.notificationsFailed}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md, flexWrap: "wrap" }}>
        {step === "reminders" ? (
          <Button
            icon="notifications-outline"
            label={reminders.busy ? t.profile.notificationsBusy : t.profile.notificationsEnable}
            disabled={reminders.busy}
            onPress={() => void reminders.toggle()}
          />
        ) : step === "backup" ? (
          <Button icon="cloud-upload-outline" label={t.setup.backupGo} onPress={() => router.push("/profile")} />
        ) : null}
        <Button label={step === "install" ? t.setup.gotIt : t.setup.later} tone="quiet" onPress={() => later(step)} />
      </View>
    </Card>
  );
}
