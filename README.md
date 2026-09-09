# MyStyle

A daily-routine coach for weight loss. The app gives you three things to do
today, notices when your day tends to go wrong, and asks four questions in the
evening — then rebuilds tomorrow from your answers.

Hebrew and English, right-to-left and left-to-right, from the first commit.

- **Plan and scope:** [`docs/PLAN.md`](docs/PLAN.md)
- **Getting it running:** [`docs/SETUP.md`](docs/SETUP.md) (Hebrew)

## Where the project is

Phase 0–1 of the roadmap: a running skeleton. Navigation, both languages,
the design system and all four screens are real. Nothing talks to a server
yet, and the routine is fixed rather than generated — every screen that is
deliberately unfinished says so on screen, so a tester never mistakes an
unbuilt phase for a bug.

## Running it

```bash
npm install
npm start          # then press i for iOS, a for Android, w for web
```

```bash
npx tsc --noEmit                   # typecheck
npx expo export --platform web     # verify it bundles
npm run test:theme                 # the palette measures itself
npm run test:tasks                 # the difficulty scanner
npm run test:rewards               # points and levels
npm run test:legal                 # the legal documents and the consent gates
npm run test:export                # the "download my data" copy is complete
```

Every push runs all of it in CI, and the over-the-air publish waits for that
run to pass — an OTA update reaches phones without store review, so it is the
only gate there is.

One bundle runs on iOS, Android and the web. Native-only APIs are the thing to
watch: they tend to fail silently on web rather than loudly, which is why every
confirmation goes through `src/ui/confirm.ts`.

## Layout

```
app/                 screens — the file tree is the navigation tree
  _layout.tsx        providers: safe area, i18n, theme
  (tabs)/            today · checkin · progress · profile
src/
  i18n/              he.ts, en.ts and the provider that switches them
  theme/             colour tokens, spacing, type scale (light + dark)
                     metrics.ts — one hue per metric family
  tasks/             reads a self-written task and prices its difficulty
  rewards/           points, levels and streak bonuses, from the ticks alone
  legal/             the privacy policy and terms, and what gates on them
  updates/           over-the-air updates, offered rather than forced
  ui/                confirm.ts — dialogs that work on web as well as native
  components/        Screen, Card, TaskRow, TaskScan, StubNote
```

## Two rules worth keeping

**No literal colours outside `src/theme/tokens.ts`.** Every colour has a light
and a dark value. A hex typed into a component works in one theme and breaks
in the other, and nobody notices until a user reports a white-on-white screen.
`Colors` is a typed contract, so a token added to light and forgotten in dark
fails the typecheck.

The palette is four colours — electric blue, vibrant orange, neon lime, deep
charcoal — and each metric family owns one of them for the life of the app:
load is blue, counts are lime, time and cost are orange. Colour tells you what
a number is before you have read the word under it, which is the difference
between glancing at your phone between sets and stopping to read it.
`npm run test:theme` measures the contrast of every pairing and the hue of
every token, so the rule is enforced rather than remembered.

**No literal user-facing strings outside `src/i18n/`.** Adding the string to
`he.ts` makes `en.ts` fail to typecheck until it is translated too. That is
the point — it is why the second language costs nothing to keep current.

## Consent is wiring, not a checkbox

Two things can send data off the phone — cloud backup and the AI coach — and
both are off until someone turns them on, separately from accepting the terms.
The switches are not decoration: `useCloud` will not open a round without the
first, and `src/ai/server.ts` refuses every call without the second, so there
is no second path out. Withdrawing either takes effect on the next call rather
than the next launch. `docs/COMPLIANCE.md` says what else publishing needs.

## Direction handling

React Native fixes writing direction at native startup, so switching language
between Hebrew and English needs a reload. `src/i18n/index.tsx` reloads at
most once per launch and asks the user to restart if the flip does not take —
reloading unconditionally is an infinite loop, which is exactly what happened
the first time this was written. On web the document owns direction and
`I18nManager` does nothing, so that path is handled separately.
