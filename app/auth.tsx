import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SelectTile } from "@/components/SelectTile";
import { TextField } from "@/components/TextField";
import {
  resendConfirmation,
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  MIN_NEW_PASSWORD,
} from "@/cloud/client";
import { fill, useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/**
 * The front door for the subscribers-only build: a first-class screen to sign
 * up or sign in, instead of the account form buried in Profile. The access gate
 * in the root layout sends anyone without an account here; on success it does
 * nothing clever itself — it just steps out of the way and lets the gate route
 * the now-signed-in person on to the paywall or the app.
 *
 * It reuses the exact same auth calls the Profile card uses, so there is one
 * behaviour, not two: the anonymous→email upgrade that keeps a person's data,
 * the honest "check your mail" state when confirmation is outstanding, and the
 * readable error mapping.
 */
export default function Auth() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();

  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState<string | null>(null);

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
    if (!email.trim()) { setNote(t.account.errBadEmail); return; }
    if (password.length < (mode === "up" ? MIN_NEW_PASSWORD : 6)) { setNote(t.account.errWeakPassword); return; }
    setBusy(true);
    setNote(null);
    const res = mode === "up"
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);
    setBusy(false);
    if (!res.ok) { setNote(errorText(res.message)); return; }
    setPassword("");
    if (res.needsConfirmation) {
      // Signed up but the link is not clicked yet: nothing syncs, and there is
      // no session to move on with, so we say so rather than send them onward.
      setAwaiting(res.email ?? email.trim());
      return;
    }
    // Signed in. Hand back to the gate, which will place them at the paywall
    // (no subscription yet) or the app (trial/paid) — the one rule, one place.
    router.replace("/");
  }

  async function resend(address: string) {
    setBusy(true);
    const res = await resendConfirmation(address);
    setBusy(false);
    setNote(res.ok ? t.account.confirmResent : errorText(res.message));
  }

  async function forgotPassword() {
    if (!email.trim()) { setNote(t.account.errBadEmail); return; }
    setBusy(true);
    setNote(null);
    const res = await requestPasswordReset(email, Linking.createURL("/reset"));
    setBusy(false);
    setNote(res.ok ? fill(t.account.resetSent, { email: email.trim() }) : errorText(res.message));
  }

  if (awaiting) {
    return (
      <Screen eyebrow={t.authScreen.eyebrow} title={t.account.confirmTitle}>
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
      </Screen>
    );
  }

  return (
    <Screen eyebrow={t.authScreen.eyebrow} title={t.authScreen.title} subtitle={t.authScreen.subtitle}>
      {/* The mark, above the form: a sign-in page with no brand on it reads
          like a phishing page, which is the last thing a payment app wants. */}
      <View style={{ alignItems: "center", marginBottom: space.md }}>
        <BrandLogo size={64} onBand={false} />
      </View>
      <Card>
        <View style={{ flexDirection: "row", gap: space.sm }}>
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
          <Text style={[type.small, { color: colors.alert, marginTop: space.xs }]}>{note}</Text>
        ) : null}

        <Button
          icon={mode === "up" ? "person-add-outline" : "log-in-outline"}
          label={busy ? t.profile.cloudConnecting : mode === "up" ? t.authScreen.createCta : t.account.signInCta}
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
    </Screen>
  );
}
