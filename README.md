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
```

## Layout

```
app/                 screens — the file tree is the navigation tree
  _layout.tsx        providers: safe area, i18n, theme
  (tabs)/            today · checkin · progress · profile
src/
  i18n/              he.ts, en.ts and the provider that switches them
  theme/             colour tokens, spacing, type scale (light + dark)
  components/        Screen, Card, TaskRow, StubNote
```

## Two rules worth keeping

**No literal colours outside `src/theme/tokens.ts`.** Every colour has a light
and a dark value. A hex typed into a component works in one theme and breaks
in the other, and nobody notices until a user reports a white-on-white screen.
`Colors` is a typed contract, so a token added to light and forgotten in dark
fails the typecheck.

**No literal user-facing strings outside `src/i18n/`.** Adding the string to
`he.ts` makes `en.ts` fail to typecheck until it is translated too. That is
the point — it is why the second language costs nothing to keep current.

## Direction handling

React Native fixes writing direction at native startup, so switching language
between Hebrew and English needs a reload. `src/i18n/index.tsx` reloads at
most once per launch and asks the user to restart if the flip does not take —
reloading unconditionally is an infinite loop, which is exactly what happened
the first time this was written. On web the document owns direction and
`I18nManager` does nothing, so that path is handled separately.
