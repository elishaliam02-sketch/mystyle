import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { OAUTH_PROVIDERS, startOAuth, type OAuthProvider } from "@/cloud/oauth";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/**
 * "Continue with Google / Apple". Draws nothing until a provider is switched
 * on in `OAUTH_PROVIDERS`, so the screens using it are unchanged until then.
 * `next` is the in-app path to land on afterwards.
 */
export function OAuthButtons({
  next = "/",
  mode = "link",
  divider = true,
}: {
  next?: string;
  mode?: "link" | "signin";
  divider?: boolean;
}) {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (OAUTH_PROVIDERS.length === 0) return null;

  async function go(provider: OAuthProvider) {
    setBusy(true);
    setNote(null);
    const res = await startOAuth(provider, next, mode);
    setBusy(false);
    if (!res.ok) setNote(res.message === "local" ? t.account.errLocal : t.account.oauthFailed);
  }

  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      {divider ? (
        <Text style={[type.small, { color: colors.inkFaint, textAlign: "center" }]}>{t.account.orDivider}</Text>
      ) : null}
      {OAUTH_PROVIDERS.includes("apple") ? (
        <Button icon="logo-apple" tone="quiet" label={t.account.continueApple} onPress={() => void go("apple")} disabled={busy} />
      ) : null}
      {OAUTH_PROVIDERS.includes("google") ? (
        <Button icon="logo-google" tone="quiet" label={t.account.continueGoogle} onPress={() => void go("google")} disabled={busy} />
      ) : null}
      {note ? <Text style={[type.small, { color: colors.alert }]}>{note}</Text> : null}
    </View>
  );
}
