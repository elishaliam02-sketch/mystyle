import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { sessionFromResetLink, setNewPassword } from "@/cloud/client";
import { useTheme } from "@/theme";

/**
 * Where a password-reset link lands.
 *
 * The link Supabase mails carries the proof: either a `code` to exchange
 * (PKCE) or an access/refresh pair in the URL fragment (the older flow). The
 * web build consumes it automatically; a phone hands the app the URL and
 * nothing else, so the tokens are redeemed here. Both shapes are tried, and
 * when neither yields a session the screen says the link is spent rather than
 * showing a password box that could not possibly work.
 *
 * A fragment (`#access_token=…`) never reaches route params, so it is read off
 * `window.location` on the web — the one place that information exists.
 */
export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();

  const [phase, setPhase] = useState<"opening" | "ready" | "expired" | "done">("opening");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const fragment =
        Platform.OS === "web" && typeof window !== "undefined"
          ? new URLSearchParams(window.location.hash.replace(/^#/, ""))
          : null;

      const ok = await sessionFromResetLink({
        code: params.code,
        accessToken: params.access_token ?? fragment?.get("access_token") ?? undefined,
        refreshToken: params.refresh_token ?? fragment?.get("refresh_token") ?? undefined,
      });
      if (alive) setPhase(ok ? "ready" : "expired");
    })();
    return () => {
      alive = false;
    };
  }, [params.code, params.access_token, params.refresh_token]);

  async function save() {
    if (password.length < 6) {
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
