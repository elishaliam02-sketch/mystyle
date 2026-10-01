# Turning on "Continue with Google" and "Continue with Apple"

The code is in the app and switched off. The buttons appear on the sign-in
screen and in Profile → My account as soon as a provider is listed in
`OAUTH_PROVIDERS` (`src/cloud/oauth.ts`). Do the steps below first: a button
for a provider Supabase has not been set up for is a dead end.

What it does: someone using the app without an account who taps a button gets
their Google/Apple identity *linked* to the account they already have, so
nothing they logged is lost. Anyone else is signed in. Deleting a Google- or
Apple-only account asks them to sign in with that provider again instead of a
password.

## 1. Supabase, once

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://mystyle.expo.app`
- **Redirect URLs:** add `https://mystyle.expo.app/**` and `mystyle://**`

Supabase → **Authentication → Sign In / Providers**: turn on **Allow manual
linking**. Without it, signing in with Google starts a new, empty account
instead of keeping what was logged without one.

## 2. Google (free)

1. <https://console.cloud.google.com> → create a project → **APIs & Services →
   OAuth consent screen**: External, app name APEX, your email.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   Under **Authorized redirect URIs** paste the callback URL shown in Supabase
   → Providers → Google (it ends in `/auth/v1/callback`).
3. Copy the client ID and secret into Supabase → Providers → Google, and enable it.

## 3. Apple (needs the $99/year Apple Developer account)

1. developer.apple.com → **Identifiers**: an App ID with *Sign in with Apple*,
   then a **Services ID** (e.g. `com.mystyle.app.web`) with *Sign in with
   Apple* configured: domain `vesdfboxetdwymsulpsc.supabase.co`, return URL the
   Supabase callback from Providers → Apple.
2. **Keys** → new key with *Sign in with Apple* → download the `.p8`.
3. Supabase → Providers → Apple: Services ID as the client ID, and generate the
   secret from the key as Supabase's page describes. **That secret expires
   every 6 months**. Put a reminder in your calendar, or Apple sign-in stops working.

The App Store asks apps that offer Google sign-in to offer Sign in with Apple
too, so turn on both together for a store build.

## 4. Switch the buttons on

In `src/cloud/oauth.ts`:

```ts
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ["apple", "google"];
```

Commit and push. The web site and phones get it with the next update. Try it
on the web first: tap Continue with Google, pick an account, and you should land
back in the app signed in.
