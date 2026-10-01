import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { ensureSession, supabase, type AuthResult } from "./client";
import { callbackPath, readCallback, type OAuthProvider } from "./oauthlink";

export type { OAuthProvider } from "./oauthlink";

/**
 * Which "continue with …" buttons the app shows. Empty until the provider is
 * switched on in Supabase (Authentication → Providers) with its keys — a button
 * for a provider the server refuses is a dead end. Add "google" and/or "apple"
 * here once it is. Also add the app's return addresses under Authentication →
 * URL Configuration → Redirect URLs: https://mystyle.expo.app/auth-callback
 * and mystyle://auth-callback.
 */
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [];

/**
 * Sends the person to Google or Apple. An anonymous account is *linked* to the
 * provider, which keeps its user id and so everything already logged; anyone
 * else signs in. The web leaves the page; a phone opens the browser and comes
 * back through mystyle://auth-callback, where `finishOAuth` takes over.
 */
export async function startOAuth(
  provider: OAuthProvider,
  next = "/",
  mode: "link" | "signin" = "link",
): Promise<AuthResult> {
  const db = supabase();
  if (!db) return { ok: false, message: "local" };
  const native = Platform.OS !== "web";
  const options = { redirectTo: Linking.createURL(callbackPath(provider, next)), skipBrowserRedirect: native };
  try {
    let url: string | null = null;
    if (mode === "link") {
      await ensureSession();
      const { data } = await db.auth.getSession();
      if (data.session?.user?.is_anonymous) {
        // Fails at once when manual linking is off in the project; signing in
        // is the fallback, and only costs the anonymous id.
        const linked = await db.auth.linkIdentity({ provider, options });
        if (!linked.error) url = linked.data.url ?? null;
      }
    }
    if (!url) {
      const res = await db.auth.signInWithOAuth({ provider, options });
      if (res.error) return { ok: false, message: "generic" };
      url = res.data.url ?? null;
    }
    if (native) {
      if (!url) return { ok: false, message: "generic" };
      await Linking.openURL(url);
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "local" };
  }
}

export type FinishResult = "ok" | "alreadyLinked" | "cancelled" | "failed";

/** Turns the provider's return into a session. */
export async function finishOAuth(params: Record<string, string | string[] | undefined>): Promise<FinishResult> {
  const db = supabase();
  if (!db) return "failed";
  const back = readCallback(params);
  if (back.kind === "alreadyLinked" || back.kind === "cancelled") return back.kind;
  if (back.kind === "error") return "failed";
  try {
    // The web client redeems the code from the address bar by itself; a second
    // redemption would fail, so only a phone does it here.
    if (back.kind === "code" && Platform.OS !== "web") {
      const { error } = await db.auth.exchangeCodeForSession(back.code);
      if (error) return "failed";
    }
    const { data } = await db.auth.getSession();
    return data.session && !data.session.user.is_anonymous ? "ok" : "failed";
  } catch {
    return "failed";
  }
}
