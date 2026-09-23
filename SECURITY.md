# APEX — security & hardening

The honest frame first: **client code on a device can always, eventually, be
reverse-engineered.** No obfuscation changes that. So the strategy is not to
make the app uncrackable — it is to make cracking worthless: nothing of value
lives in the client, and anything that must be trusted is decided on the
server. Everything below serves that.

## 1. Code protection & obfuscation

- **Hermes bytecode (on).** Release builds (`preview`/`production` in
  `eas.json`) compile JavaScript to Hermes bytecode, not readable source, and
  minify it. This is the baseline and it is automatic; `jsEngine: "hermes"` is
  pinned in `app.json`. Dev builds ship readable JS — never distribute one.
- **No secrets in the bundle.** The one key the app carries is the Supabase
  *publishable* key, which is safe by design: Row Level Security (see
  `supabase/schema.sql`) means it can only ever read or write the signed-in
  user's own rows. The `service_role` key is never in the app or in git.
- **Optional, if ever needed:** a Metro transform running `javascript-obfuscator`
  over the JS before Hermes. It costs startup time and is rarely worth it on top
  of bytecode; measure before adding.

## 2. Secrets & critical logic on the server

- **`supabase/functions/ai/` — the AI proxy.** The Gemini (or Anthropic) key
  is a real, spendable secret, so it never touches the device. The app names a
  task (`coach` or `meal`) and sends only the person's words or photo; the
  function verifies the caller's JWT, checks every field's type, builds the
  instructions itself (`prompts.ts`), holds the key, and returns only text. A
  client that could send its own system prompt could use the key as a
  general-purpose model, so it cannot.
- **Rate limits live in Postgres** (`ai_count`, `migration-006-security.sql`):
  per user per minute and per day, lower for anonymous accounts (they cost
  nothing to create), and a global daily ceiling that bounds what any number of
  fresh accounts can spend. Tune with the `AI_PER_MINUTE`, `AI_PER_DAY`,
  `AI_PER_DAY_ANONYMOUS` and `AI_GLOBAL_PER_DAY` function secrets.
- **CORS is an allowlist.** Every function echoes the `Origin` only when it is
  in the `ALLOWED_ORIGINS` secret (comma-separated; defaults to the local Expo
  web ports). The phone apps and Stripe send no Origin and are unaffected; the
  hosted web app and the admin console must be listed.
- **Deleting an account needs a recent sign-in.** `delete_my_account()` refuses
  a non-anonymous caller whose token shows no sign-in in the last ten minutes;
  the app asks for the password and signs in again just before. Also turn on
  **Authentication → Providers → Email → Secure password change** in Supabase,
  so a password can only be changed from a recent sign-in or a reset link.
- **The admin console needs a second factor.** The `admin` function refuses any
  token below `aal2`, so the owner's password alone opens nothing; the console
  enrolls an authenticator app (TOTP) on first sign-in and asks for a code on
  every sign-in after. The page loads supabase-js pinned by version *and*
  integrity hash, and its CSP allows only that file and its own inline script
  (by hash) to run, and only the project's Supabase URL to be contacted. The
  tables are built with DOM calls, not innerHTML.
- This is the template for any future logic that must not be forgeable — put
  it behind a function.

## 2b. The pipeline

- **Every GitHub Action is pinned to a commit SHA**, with the release in a
  comment. A tag can be moved to other code; a SHA cannot. Dependabot
  (`.github/dependabot.yml`) proposes the updates, as SHAs.
- **Checks** runs `npm audit --omit=dev --audit-level=high` and a Semgrep scan
  (`scripts/sast.sh`, the security rules of semgrep-rules pinned to one commit)
  over `app`, `src`, `supabase`, `admin`, `public` and the workflows. CodeQL is
  not used because on a private repository it needs GitHub's paid Code
  Security. A false positive is silenced on its line with
  `nosemgrep: <rule> -- <reason>`.
- Workflow `run:` blocks read `github.*` values through `env:`, never pasted
  into the script, so a branch name or commit message cannot become a command.

## 3. Encryption of local data

- **Session in the keystore.** `src/cloud/secureStorage.ts` stores the Supabase
  session in the iOS Keychain / Android Keystore (hardware-backed, encrypted,
  unreadable by other apps or a backup), chunked to fit the keystore's size
  cap, with a browser-storage fallback on web. Needs a native rebuild to take
  effect (it adds `expo-secure-store`).
- **On web the session is in localStorage**, because a browser has no keystore
  and an anonymous account whose token is lost cannot be signed back into. What
  protects it is that no foreign script can run: `public/index.html` carries a
  Content-Security-Policy with `script-src 'self'` and lists exactly the hosts
  the app contacts. `npm run test:csp` fails when the app gains a host the
  policy does not allow, and the e2e suite fails on any refusal in a real
  browser. `public/_headers` adds what a meta tag cannot (frame-ancestors, HSTS,
  nosniff) on hosts that read it; set the same headers elsewhere. Shortening
  the JWT expiry (Supabase → Authentication → Sessions) narrows the window a
  stolen token is good for.
- The rest of local state (habits, weights) is low-value and device-local; its
  authoritative copy is the RLS-protected server, so it is not worth encrypting
  at rest. Never store a token or key in AsyncStorage.

## 4. Anti-cheat / time integrity

- **Client guard (shipped).** `src/time/clock.ts` keeps a high-water mark of the
  furthest instant seen; "today" for anything that feeds a streak is never
  before it, so winding the clock back cannot fabricate a fresh day. Each sync
  feeds the server's own clock (`server_now()`) into the mark, so a rewound
  device is snapped back to real time on its next sync.
- **The durable fix (server-side).** Streaks and any future rewards must be
  recomputed on the server from `synced_at` — the timestamp the database sets,
  which no client can forge — not trusted from the dates the device sends. The
  client streak is display; the server's is truth.

## 5. Input validation

- `src/store/weight.ts`: a hard human range (25–400 kg) the store refuses to
  exceed, plus a soft sanity check that warns on an implausible jump between
  weigh-ins and asks for a confirming tap. Validate the same bounds server-side
  before trusting any weight in an aggregate.

## 6. Food data — modular source

The kitchen reads a local, offline-first food database (`src/kitchen/data.ts`).
To widen it without losing offline use, put a source behind an interface:

```ts
export interface FoodSource {
  search(term: string): Promise<Food[]>;
}
// Default: the bundled local DB (instant, offline).
// Remote: Open Food Facts (free, no key) or USDA FoodData Central,
//   used only to enrich results when online, cached back into local state.
```

Keep the local DB as the primary so the app never depends on a network for a
meal; the remote source is an enrichment layer, not a requirement.
