# Publishing APEX — what is done, and what still needs a person

This is the checklist an app has to clear before it can be listed on the App
Store or Google Play without getting rejected or exposing its author. It is
kept next to the code because most of the answers *are* code: where a
requirement is met by a file, the file is named, so a claim in this document
can be checked rather than believed.

**This is not legal advice.** The documents in `src/legal/` were written
against what the app actually does, which is the hard part and the part a
template gets wrong — but a lawyer in your jurisdiction should read them before
you take money or scale. Anything needing a human decision is marked **TODO**.

---

## 1. The documents

| Requirement | Where it lives |
|---|---|
| Privacy policy | `src/legal/documents.he.ts` / `.en.ts`, shown at `app/legal/privacy.tsx` |
| Terms of use / EULA | same files, shown at `app/legal/terms.tsx` |
| Versioning | `LEGAL.version` in `src/legal/config.ts` — raising it makes every existing user re-accept |
| Acceptance recorded | `state.legal` (device-local, never synced), written by `acceptLegal()` |
| Contact for data requests | `danielzanzuri1301@gmail.com`, in `LEGAL.contactEmail` and printed in both documents |

Both documents are readable inside the app with no account and no network,
which is what a reviewer checks. They are written in Hebrew first and typed so
that English cannot fall behind: `documents.en.ts` is typed as `typeof he`, so
a section added in one language fails the build until the other has it.

**TODO (human):** the terms name Israeli law and Israeli courts. Confirm that
matches where you are actually operating from.

**TODO (human):** if you ever publish under a company rather than your own
name, change `LEGAL.publisher` and re-issue with a bumped version.

**TODO (human):** the App Store also wants a privacy policy at a public URL.
The in-app copy satisfies the reviewer's "reachable in the app" test, but the
listing itself needs a link — put the same text on any page you control and
paste that URL into App Store Connect and the Play Console.

## 2. Consent, and what it actually gates

Consent here is not a checkbox that unlocks a screen; it is wired to the two
places data can leave the phone, and withdrawing it stops them.

| Switch | Default | What it gates | Where |
|---|---|---|---|
| Terms + privacy | must accept | the app itself | `app/legal/consent.tsx`, enforced by the gate in `app/_layout.tsx` |
| Cloud backup and sync | **off** | every network round in `useCloud` — sync, account, backup | `src/cloud/useCloud.ts` |
| AI coach and photo scan | **off** | every model call, including meal photos | `src/ai/server.ts` via `aiConsentGiven()` |

Both optional switches are separate from the acceptance, and separate from each
other: bundled consent is not consent. The app is fully usable with both off —
the coach falls back to on-device content and says so on screen.

Withdrawal takes effect immediately, not at the next launch: `allowed` is a
dependency of the sync callback, and the AI transport reads a module-level
mirror the store republishes on every change (`publishAiConsent`).

## 3. Right to deletion

`supabase/migration-004-account-deletion.sql` adds `delete_my_account()`, a
security-definer function that deletes the caller's own `auth.users` row. Every
table cascades from it, so the profile, habits, completions, weigh-ins,
check-ins and the backup blob go with it. The client calls it from
`deleteAccount()` in `src/cloud/client.ts`; the profile screen wipes the device
afterwards and only reports success when the server actually confirmed.

`migration-006-security.sql` replaces it with a version that also requires a
sign-in in the last ten minutes for an email account; the profile screen asks
for the password and signs in again just before calling it.

**TODO (human):** run migrations 004, 006 and 007 in the Supabase SQL editor. Until
you do, the delete button reports a failure rather than pretending — which is
the right behaviour, but it means deletion is not live until the SQL is run.

## 3b. Right to a copy

The profile screen downloads everything the app holds as a JSON file —
`src/legal/export.ts` builds it (pure, and tested for completeness),
`deliver.ts` hands it over: a real file download on the web, the system share
sheet on a phone. Built with what is already installed on purpose; reaching for
expo-file-system would put a portability right behind a store review.

**TODO (human):** the share sheet carries the file as text on a phone. If
exports grow past a few hundred KB, add expo-file-system and a native build.

## 3c. Safeguarding

A goal weight below the healthy floor is refused (`checkGoalWeight`) and the
refusal now comes with a door rather than just a "no": `SupportSignpost` points
to a doctor or dietitian and to ER"N, Israel's 24/7 anonymous emotional-support
line (1201, WhatsApp 052-8451201). Verified against the organisation's own
listing, not remembered.

**TODO (human):** if you publish outside Israel, that number needs a local
equivalent — a helpline printed in a health app has to be real and reachable
where the reader is.

## 4. Store submission answers

### Apple — privacy nutrition labels

Declared in `app.json` under `ios.privacyManifests`, and these are the same
answers to give in App Store Connect:

- **Tracking:** none. No advertising identifier, no analytics SDK, no ad
  network, no tracking domains.
- **Data linked to the user:** email address, name, health & fitness data,
  other user content (habit text, recap notes), photos (only when the meal scan
  is used).
- **Purpose:** app functionality only, for every category.
- **Required-reason APIs:** UserDefaults (CA92.1), file timestamps (C617.1),
  system boot time (35F9.1), disk space (E174.1).

### Google Play — Data safety

The Play Console has no config file; enter it by hand to match the above:

- Data collected: email, name, health and fitness, photos, other user content.
- Data is encrypted in transit: **yes** (HTTPS everywhere).
- Users can request deletion: **yes** — in-app, plus the contact email.
- Data shared with third parties: the AI provider, and only when the user turns
  the AI coach on.

### Age rating

Rate **12+ / Teen** and answer the questionnaire honestly: the app discusses
weight loss and diet. It is **not** directed at children — the terms set a
minimum age of 16 and the privacy policy says so, which keeps COPPA out of
scope. Do not tick any "made for kids" box; that triggers a far stricter
regime.

**TODO (human):** both consoles also want a support URL and a marketing
contact. The email above works for support.

## 5. Third parties that see anything

| Who | What they see | When |
|---|---|---|
| Supabase | account, synced rows, backup blob | only with cloud backup on |
| Google (Gemini) and/or Anthropic (Claude) | the question, relevant numbers, a meal photo | only with the AI coach on |
| Expo (EAS Update) | IP and basic device details on an update check | every launch, if updates are configured |
| YouTube | IP, when a demo thumbnail loads or a video opens | when the training screen is used |
| Wikimedia (`commons.wikimedia.org`, `upload.wikimedia.org`) | IP, and the dish or ingredient name from the app's own cookbook | when the kitchen shows meals, unless the photos switch is off |

All five are named in the privacy policy. The Gemini free tier's terms allow
human review of submitted content, and the policy says so plainly rather than
implying otherwise — that sentence is deliberate, not an oversight.

The meal photos are the one outbound call that starts on rather than off. What
goes out is a line from the app's own recipe list — "chickpea stew" — and
nothing a person wrote, weighed or photographed, so there is no personal data in
it to consent to; the switch exists for the IP address and for anyone on a
metered connection. It is disclosed in the same breath as the others, and
nothing is requested until the stored answer to that switch has loaded: the
consent mirror reads false until the store publishes it, and `fetchMealPhoto`
returns without a request while it does.

## 6. Intellectual property

- Every asset is drawn in code (`MealImage`, `ExerciseThumb`, `BrandLogo`,
  `WaterBottle`) or is an emoji-free vector from `@expo/vector-icons`. No stock
  photography, no borrowed brand marks.
- The meal photographs come from Wikimedia Commons, where everything is openly
  licensed, and not from an image search. This matters: a photograph found on
  Google belongs to whoever took it, and putting one in the app or a store
  listing is somebody else's copyright, licence terms and takedown notice.
- Commons licences are honoured rather than assumed. The search asks for each
  file's licence and photographer, `creditFor` decides what the licence wants,
  and the card prints "Jane Doe · CC BY-SA 4.0" along the bottom of the picture
  whenever one is owed. A photo whose licence asks for a credit that cannot be
  written — no photographer named — is passed over for the next candidate, so
  nothing is ever shown outside its terms. Public-domain and CC0 pictures carry
  no line, because none is asked for.
- Exercise demos are **links to** YouTube, not copies of anyone's video.
- Open-source licences are reproduced at `app/legal/licenses.tsx`, generated
  from the installed tree by `scripts/gen-licenses.mjs`. Re-run it after adding
  or upgrading a dependency; the output is committed so the screen works
  offline.

**TODO (human):** the name "APEX" is not trademark-cleared. Check it before you
spend money on marketing.

## 7. Security

- HTTPS for everything; no cleartext exception is configured.
- Row-level security in `supabase/schema.sql` — one account cannot read
  another's rows, even with a leaked publishable key.
- The session token lives in the device keystore (`src/cloud/secureStorage.ts`),
  not in plain storage.
- The AI provider key never reaches the client; it lives in the edge function
  (`supabase/functions/ai/index.ts`).
- Passwords are hashed by Supabase Auth and are not visible to the app.

**TODO (human):** turn on leaked-password protection and email confirmation in
the Supabase Auth settings, and rotate the publishable key if it was ever
committed anywhere public.

## 8. In-app updates

`src/updates/` checks on launch and on foreground, downloads in the background
and offers a restart — it never restarts the app by itself. `runtimeVersion` is
tied to `version` in `app.json`, so an update is only ever served to a build
that can run it. Both stores permit this: it ships JavaScript and assets, never
native code, and the terms tell people it happens.

**TODO (human):** `eas update --branch production` is what actually publishes
one. Check that `updates.url` in `app.json` points at your EAS project.
