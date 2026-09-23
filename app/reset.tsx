import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { MIN_NEW_PASSWORD, sessionFromResetLink, setNewPassword } from "@/cloud/client";
import { useTheme } from "@/theme";

/**
 * Where a password-reset link lands.
 *
 * The link Supabase mails carries a PKCE `code`, which only redeems on the
 * device that asked for the reset. The web build redeems it automatically; a
 * phone hands the app the URL and nothing else, so it is redeemed here. When
 * no fresh session results, the screen says the link is spent rather than
 * showing a password box that could not possibly work.
 */
export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  const [phase, setPhase] = useState<"opening" | "ready" | "expired" | "done">("opening");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await sessionFromResetLink({ code: params.code });
      if (alive) setPhase(ok ? "ready" : "expired");
    })();
    return () => {
      alive = false;
    };
  }, [params.code]);

  async function save() {
    if (password.length < MIN_NEW_PASSWORD) {
      setNote(t.account.errWeakPassword);
      return;
    }
    setBusy(true);
    setNote(null);
    const res = await setNewPassword(password);
    setBusy(false);
    if (!res.ok) {
      setNote(res.message === "noSession" ? t.account.errNoSession : t.account.errGeneric);
      return;
    }
    setPassword("");
    setPhase("done");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.account.resetTitle} subtitle={t.account.resetBody}>
        <Card>
          {phase === "opening" ? (
            <Text style={[type.body, { color: colors.inkSoft }]}>{t.common.loading}</Text>
          ) : phase === "expired" ? (
            <Text style={[type.body, { color: colors.orangeInk }]}>{t.account.resetNoSession}</Text>
          ) : phase === "done" ? (
            <>
              <Text style={[type.body, { color: colors.ink }]}>{t.account.resetDone}</Text>
              <Button
                icon="arrow-back"
                label={t.common.done}
                onPress={() => router.replace("/(tabs)")}
                style={{ marginTop: space.md }}
              />
            </>
          ) : (
            <View style={{ gap: space.md }}>
              <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.account.resetChoose}</Text>
              <TextField
                value={password}
                onChangeText={setPassword}
                placeholder={t.account.password}
                secureTextEntry
                autoFocus
              />
              <Text style={[type.small, { color: colors.inkFaint }]}>{t.account.passwordHint}</Text>
              <Button
                icon="checkmark"
                label={t.account.resetSave}
                onPress={() => void save()}
                disabled={busy}
              />
            </View>
          )}
          {note ? (
            <Text style={[type.small, { color: colors.orangeInk, marginTop: space.sm }]}>{note}</Text>
          ) : null}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
