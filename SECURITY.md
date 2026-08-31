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

- **`supabase/functions/ai/` — the AI proxy.** The Anthropic key is a real,
  spendable secret, so it never touches the device. The app sends a prompt to
  this Edge Function; the function verifies the caller's JWT, rate-limits per
  user, holds the key in its own environment, calls Claude, and returns only
  text. Deploy: `supabase functions deploy ai`; set the secret with
  `supabase secrets set ANTHROPIC_API_KEY=…`. This is the template for any
  future logic that must not be forgeable — put it behind a function.

## 3. Encryption of local data

- **Session in the keystore.** `src/cloud/secureStorage.ts` stores the Supabase
  session in the iOS Keychain / Android Keystore (hardware-backed, encrypted,
  unreadable by other apps or a backup), chunked to fit the keystore's size
  cap, with a browser-storage fallback on web. Needs a native rebuild to take
  effect (it adds `expo-secure-store`).
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
