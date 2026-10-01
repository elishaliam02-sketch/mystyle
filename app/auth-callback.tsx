import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { finishOAuth, startOAuth } from "@/cloud/oauth";
import { isProvider, paramsOf, safeNext } from "@/cloud/oauthlink";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

/**
 * Where Google and Apple send the person back. The code is redeemed into a
 * session and the person is taken on to `next`. When an anonymous account
 * tried to link an identity that already has an account, that account is
 * signed in to instead.
 */
export default function AuthCallback() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [failed, setFailed] = useState(false);
  const next = safeNext(params.next);

  useEffect(() => {
    let alive = true;
    (async () => {
      // On the web an error can arrive in the fragment, which the router does
      // not read.
      const hash = Platform.OS === "web" && typeof window !== "undefined" ? paramsOf(window.location.hash) : {};
      const result = await finishOAuth({ ...hash, ...params });
      if (!alive) return;
      if (result === "ok") {
        router.replace(next as never);
      } else if (result === "alreadyLinked" && isProvider(params.p)) {
        const again = await startOAuth(params.p, next, "signin");
        if (alive && !again.ok) setFailed(true);
      } else if (result === "cancelled") {
        router.replace(next as never);
      } else {
        setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
    // Runs once per arrival; the params do not change under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen title={t.account.title}>
      <Card>
        <Text style={[type.body, { color: failed ? colors.alert : colors.inkSoft }]}>
          {failed ? t.account.oauthFailed : t.account.oauthOpening}
        </Text>
        {failed ? (
          <Button icon="arrow-back" label={t.common.done} onPress={() => router.replace(next as never)} style={{ marginTop: space.md }} />
        ) : null}
      </Card>
    </Screen>
  );
}
