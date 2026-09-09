import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConsentSwitch } from "@/components/ConsentSwitch";
import { Screen } from "@/components/Screen";
import { SupportSignpost } from "@/components/SupportSignpost";
import { UpdateBanner } from "@/components/UpdateBanner";
import { TextField } from "@/components/TextField";
import { useCloud } from "@/cloud/useCloud";
import {
  requestPasswordReset,
  resendConfirmation,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from "@/cloud/client";
import { deleteAccount } from "@/cloud/client";
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
import { useAppUpdate } from "@/updates";
import { LEGAL } from "@/legal";
import { buildExport, exportFilename, serializeExport } from "@/legal/export";
import { deliverExport } from "@/legal/deliver";
import { confirm } from "@/ui/confirm";

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
  const router = useRouter();

  // Seeded empty and filled once the store has loaded from disk: reading state
  // on the first render caught the profile before it hydrated, so the fields
  // showed blank — and pressing save then wrote that blank over a real name.
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [height, setHeight] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Set once someone asks for a goal below the healthy floor, and left set:
  // the signpost stays for the rest of the visit rather than blinking away
  // with the error message.
  const [needsSupport, setNeedsSupport] = useState(false);
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
        // Sticky for the rest of the visit: the refusal on its own leaves
        // someone with a wish and nowhere to take it.
        setNeedsSupport(true);
        return;
      }
      if (verdict.status === "too-high") {
        setNote(fill(t.profile.goalTooHigh, { ceiling: verdict.ceiling }));
        return;
      }
    }
    saveProfile({ name: name.trim(), goalKg: kg, heightCm: cm });
    setNote(t.profile.savedNote);
  }

  // cloud.sync() silently drops a second call while one is in flight, so the
  // button has to look busy rather than sit there looking tappable.
  async function syncNow() {
    setSyncing(true);
    await cloud.sync();
    setSyncing(false);
  }

  function confirmReset() {
    confirm({
      title: t.profile.dangerTitle,
      message: t.profile.dangerConfirm,
      confirmLabel: t.profile.dangerYes,
      cancelLabel: t.common.cancel,
      destructive: true,
      onConfirm: reset,
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.profile.heading}>
        <UpdateBanner />
        <View style={{ alignItems: "center", paddingVertical: space.md }}>
          <BrandLogo size={72} onBand={false} />
        </View>
        <Card>
          <View style={{ gap: space.lg }}>
            <TextField
              value={name}
              onChangeText={(v) => { setName(v); if (note) setNote(null); }}
              label={t.profile.nameTitle}
              placeholder={t.profile.namePlaceholder}
            />
            <TextField
              value={height}
              onChangeText={(v) => { setHeight(v); if (note) setNote(null); }}
              label={t.profile.heightTitle}
              placeholder={t.profile.heightPlaceholder}
              keyboardType="numeric"
            />
            <TextField
              value={goal}
              onChangeText={(v) => { setGoal(v); if (note) setNote(null); }}
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
              <Text
                style={[
                  type.small,
                  {
                    // a confirmation is not a warning: the saved note is the
                    // accent, everything else in this line is an error
                    color: note === t.profile.savedNote ? colors.accent : colors.orangeInk,
                    fontWeight: "700",
                  },
                ]}
              >
                {note}
              </Text>
            ) : null}
            {needsSupport ? <SupportSignpost /> : null}
            <Button label={t.profile.saveAction} onPress={persist} tone="quiet" />
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
                <Text style={[type.small, { color: colors.orangeInk, marginTop: space.xs }]}>
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

        <AccountCard cloud={cloud} />

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
            label={syncing ? t.profile.syncing : t.profile.cloudSyncNow}
            tone="quiet"
            onPress={() => void syncNow()}
            disabled={syncing}
            style={{ marginTop: space.md }}
          />
        </Card>

        {/* the way in to the subscription — a paywall nobody can reach is not
            a paywall, and this is the screen people look for it on */}
        <Pressable onPress={() => router.push("/paywall")} accessibilityRole="button">
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accentWash,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="sparkles" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.ink }]}>
                  {locale === "he" ? "APEX Pro" : "APEX Pro"}
                </Text>
                <Text style={[type.small, { color: colors.inkSoft }]}>
                  {locale === "he"
                    ? "כל האפליקציה בלי גבולות · שבוע ראשון חינם"
                    : "The whole app, no limits · first week free"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
            </View>
          </Card>
        </Pressable>

        <PrivacyCard cloud={cloud} />

        <UpdatesCard />

        {/* ordinary footnote copy, not the unfinished-feature warning strip it
            used to wear — users read that yellow bar as "this part is broken" */}
        <Text style={[type.small, { color: colors.inkFaint, paddingHorizontal: space.xs }]}>
          {t.profile.localNote}
        </Text>

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

/**
 * Privacy, consent and the way out.
 *
 * Everything a data-protection law asks to be reachable, in one card: what is
 * switched on, the documents themselves, who to write to, and a delete button
 * that really deletes. Withdrawing a consent here takes effect immediately —
 * the sync stops at the next round and the AI transport refuses on its very
 * next call — rather than at the next launch.
 */
function PrivacyCard({ cloud }: { cloud: ReturnType<typeof useCloud> }) {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const { state, consent, setConsent, reset } = useStore();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = consent();

  function confirmDelete() {
    confirm({
      title: t.legal.deleteTitle,
      message: t.legal.deleteConfirm,
      confirmLabel: t.legal.deleteYes,
      cancelLabel: t.common.cancel,
      destructive: true,
      onConfirm: () => void wipe(),
    });
  }

  async function wipe() {
    setBusy(true);
    setNote(null);
    // Server first: if it fails, the person still has their account and can
    // try again. Wiping the device first would leave an orphaned account on
    // the server with no signed-in device left to delete it from.
    const hadAccount = !!cloud.account;
    const gone = await deleteAccount();
    if (hadAccount && !gone) {
      setNote(t.legal.deleteFailed);
      setBusy(false);
      return;
    }
    reset();
    cloud.refreshAccount();
    setNote(hadAccount ? t.legal.deleteDone : t.legal.deleteLocalOnly);
    setBusy(false);
  }

  /**
   * The right to a copy, answered by the app rather than by an inbox. The
   * whole stored state goes out verbatim — a copy that quietly omits fields
   * would be worse than none, because nobody can tell what is missing.
   */
  async function exportData() {
    setBusy(true);
    setNote(null);
    const file = exportFilename();
    const ok = await deliverExport(
      serializeExport(buildExport(state, { email: cloud.account?.email ?? null })),
      file,
    );
    setBusy(false);
    setNote(ok ? fill(t.legal.exportDone, { file }) : t.legal.exportFailed);
  }

  return (
    <Card label={t.legal.consentTitle}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.legal.consentBody}</Text>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        <ConsentSwitch
          label={t.legal.cloudLabel}
          body={t.legal.cloudBody}
          value={choices.cloud}
          onChange={(next) => setConsent({ cloud: next })}
        />
        <ConsentSwitch
          label={t.legal.aiLabel}
          body={t.legal.aiBody}
          value={choices.ai}
          onChange={(next) => setConsent({ ai: next })}
        />
      </View>

      <Text style={[type.label, { color: colors.inkFaint, marginTop: space.lg }]}>
        {t.legal.documentsTitle}
      </Text>
      <View style={{ gap: space.xs, marginTop: space.xs }}>
        {(
          [
            [t.legal.privacyLink, "/legal/privacy"],
            [t.legal.termsLink, "/legal/terms"],
            [t.legal.licensesLink, "/legal/licenses"],
          ] as const
        ).map(([label, href]) => (
          <Pressable
            key={href}
            onPress={() => router.push(href)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              paddingVertical: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[type.bodyStrong, { color: colors.accent, flex: 1 }]}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>

      <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
        {fill(t.legal.contactBody, { email: LEGAL.contactEmail })}
      </Text>

      <Text style={[type.label, { color: colors.inkFaint, marginTop: space.lg }]}>
        {t.legal.exportTitle}
      </Text>
      <Text style={[type.small, { color: colors.inkSoft, marginTop: space.xs }]}>
        {t.legal.exportBody}
      </Text>
      <Button
        icon="download-outline"
        label={t.legal.exportCta}
        tone="quiet"
        disabled={busy}
        onPress={() => void exportData()}
        style={{ marginTop: space.md }}
      />

      <Text style={[type.label, { color: colors.inkFaint, marginTop: space.lg }]}>
        {t.legal.deleteTitle}
      </Text>
      <Text style={[type.small, { color: colors.inkSoft, marginTop: space.xs }]}>
        {t.legal.deleteBody}
      </Text>
      <Button
        icon="trash"
        label={t.legal.deleteCta}
        tone="danger"
        disabled={busy}
        onPress={confirmDelete}
        style={{ marginTop: space.md }}
      />
      {note ? (
        <Text style={[type.small, { color: colors.orangeInk, marginTop: space.sm }]}>{note}</Text>
      ) : null}
    </Card>
  );
}

/**
 * Version and updates. The app can update itself: a new bundle is fetched
 * quietly and applied when the person says so. This card is where that becomes
 * visible — what is running, and a button for someone who does not want to
 * wait for the automatic check.
 */
function UpdatesCard() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const update = useAppUpdate();
  const { version, channel, embedded } = update.running;

  const status =
    update.state === "checking"
      ? t.updates.checking
      : update.state === "downloading"
        ? t.updates.downloading
        : update.state === "ready"
          ? t.updates.bannerTitle
          : update.state === "current"
            ? t.updates.upToDate
            : update.state === "failed"
              ? t.updates.failed
              : null;

  return (
    <Card label={t.updates.aboutTitle}>
      <Text style={[type.bodyStrong, { color: colors.ink }]}>
        {fill(t.updates.version, { version })}
      </Text>
      <Text style={[type.small, { color: colors.inkSoft }]}>
        {embedded ? t.updates.embedded : t.updates.fromUpdate}
      </Text>
      {channel ? (
        <Text style={[type.small, { color: colors.inkFaint }]}>
          {fill(t.updates.channelLine, { channel })}
        </Text>
      ) : null}

      {update.supported ? (
        <>
          <Button
            icon="refresh"
            label={update.state === "ready" ? t.updates.restart : t.updates.checkCta}
            tone="quiet"
            onPress={() => (update.state === "ready" ? void update.apply() : void update.check())}
            style={{ marginTop: space.md }}
          />
          {status ? (
            <Text
              style={[
                type.small,
                {
                  color: update.state === "failed" ? colors.orangeInk : colors.inkSoft,
                  marginTop: space.xs,
                },
              ]}
            >
              {status}
            </Text>
          ) : null}
          <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
            {t.updates.note}
          </Text>
        </>
      ) : (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.sm }]}>
          {t.updates.unsupported}
        </Text>
      )}
    </Card>
  );
}

/**
 * The account: sign up with an email to back everything up and move it to a new
 * phone, sign in on another device to pull it down, or sign out. Without an
 * email the app still works and still syncs — but only to an anonymous account
 * that a reinstall cannot recover, which is exactly what an email fixes.
 */
function AccountCard({ cloud }: { cloud: ReturnType<typeof useCloud> }) {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // The address a confirmation is outstanding for. Set after a signup that
  // came back without a session, which is what an unconfirmed account looks
  // like — the moment where the old code said "backed up" and was wrong.
  const [awaiting, setAwaiting] = useState<string | null>(null);

  const account = cloud.account;
  const signedIn = !!account && !account.anonymous;
  // Signed in but the link was never clicked: the account exists, nothing
  // syncs, and saying nothing about it is how people lose data they believe
  // is safe.
  const unconfirmed = signedIn && account!.confirmed === false;

  const errorText = (code: string): string => {
    switch (code) {
      case "exists": return t.account.errExists;
      case "badLogin": return t.account.errBadLogin;
      case "weakPassword": return t.account.errWeakPassword;
      case "badEmail": return t.account.errBadEmail;
      case "local": return t.account.errLocal;
      case "noSession": return t.account.errNoSession;
      default: return t.account.errGeneric;
    }
  };

  async function submit() {
    if (!email.trim()) {
      setNote(t.account.errBadEmail);
      return;
    }
    if (password.length < 6) {
      setNote(t.account.errWeakPassword);
      return;
    }
    setBusy(true);
    setNote(null);
    const res = mode === "up"
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);
    setBusy(false);
    if (!res.ok) {
      setNote(errorText(res.message));
      return;
    }
    setPassword("");
    if (res.needsConfirmation) {
      // Not signed in, not backed up, and the screen must not pretend
      // otherwise: the account only becomes real when the link is clicked.
      setAwaiting(res.email ?? email.trim());
      setNote(null);
      return;
    }
    setNote(t.account.done);
    cloud.refreshAccount();
    void cloud.sync();
  }

  /** Sends the confirmation email again, for a link that never arrived. */
  async function resend(address: string) {
    setBusy(true);
    const res = await resendConfirmation(address);
    setBusy(false);
    setNote(res.ok ? t.account.confirmResent : errorText(res.message));
  }

  /**
   * Starts a password reset. The link has to come back to *this* app, so the
   * redirect is built from the app's own scheme on a phone and the site's
   * origin on the web — `Linking.createURL` knows which it is.
   */
  async function forgotPassword() {
    if (!email.trim()) {
      setNote(t.account.errBadEmail);
      return;
    }
    setBusy(true);
    setNote(null);
    const res = await requestPasswordReset(email, Linking.createURL("/reset"));
    setBusy(false);
    setNote(res.ok ? fill(t.account.resetSent, { email: email.trim() }) : errorText(res.message));
  }

  async function doSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
    cloud.refreshAccount();
  }

  if (awaiting) {
    return (
      <Card label={t.account.confirmTitle}>
        <Text style={[type.body, { color: colors.ink }]}>
          {fill(t.account.confirmBody, { email: awaiting })}
        </Text>
        <Button
          icon="mail-outline"
          label={t.account.confirmResend}
          tone="quiet"
          onPress={() => void resend(awaiting)}
          disabled={busy}
          style={{ marginTop: space.md }}
        />
        {note ? (
          <Text style={[type.small, { color: colors.inkSoft, marginTop: space.sm }]}>{note}</Text>
        ) : null}
      </Card>
    );
  }

  if (signedIn) {
    return (
      <Card label={t.account.title}>
        <Text style={[type.bodyStrong, { color: colors.ink }]}>{account!.email}</Text>
        {unconfirmed ? (
          <>
            <Text style={[type.small, { color: colors.orangeInk, marginTop: 2 }]}>
              {t.account.unconfirmed}
            </Text>
            <Button
              icon="mail-outline"
              label={t.account.confirmResend}
              tone="quiet"
              onPress={() => void resend(account!.email ?? "")}
              disabled={busy}
              style={{ marginTop: space.md }}
            />
          </>
        ) : (
          <Text style={[type.small, { color: colors.inkSoft, marginTop: 2 }]}>{t.account.backedUp}</Text>
        )}
        <Button
          icon="log-out-outline"
          label={busy ? t.profile.cloudConnecting : t.account.signOut}
          tone="quiet"
          onPress={doSignOut}
          disabled={busy}
          style={{ marginTop: space.md }}
        />
      </Card>
    );
  }

  return (
    <Card label={t.account.title}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{t.account.why}</Text>

      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        <SelectTile selected={mode === "up"} onPress={() => setMode("up")}
          style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 }}>
          <Text style={[type.smallStrong, { color: mode === "up" ? colors.onAccent : colors.inkSoft }]}>
            {t.account.tabSignUp}
          </Text>
        </SelectTile>
        <SelectTile selected={mode === "in"} onPress={() => setMode("in")}
          style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 }}>
          <Text style={[type.smallStrong, { color: mode === "in" ? colors.onAccent : colors.inkSoft }]}>
            {t.account.tabSignIn}
          </Text>
        </SelectTile>
      </View>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        <TextField
          value={email}
          onChangeText={(v) => { setEmail(v); if (note) setNote(null); }}
          label={t.account.email}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <TextField
          value={password}
          onChangeText={(v) => { setPassword(v); if (note) setNote(null); }}
          label={t.account.password}
          placeholder={t.account.passwordHint}
          secureTextEntry
        />
      </View>

      {note ? (
        <Text style={[type.small, { color: note === t.account.done ? colors.accent : colors.alert, marginTop: space.xs }]}>
          {note}
        </Text>
      ) : null}

      <Button
        icon="cloud-done-outline"
        label={
          busy
            ? t.profile.cloudConnecting
            : mode === "up"
              ? t.account.createCta
              : t.account.signInCta
        }
        onPress={submit}
        disabled={busy}
        style={{ marginTop: space.md }}
      />

      {mode === "in" ? (
        <Pressable
          onPress={() => void forgotPassword()}
          accessibilityRole="button"
          disabled={busy}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: space.sm })}
        >
          <Text style={[type.small, { color: colors.accent, fontWeight: "700", textAlign: "center" }]}>
            {t.account.forgot}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
