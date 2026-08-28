# MyStyle — working notes

A daily-routine coach for weight loss. Read `docs/PLAN.md` before making
scope decisions; it records what v1 contains and, more usefully, what it
deliberately does not.

## Conventions

**Colours live only in `src/theme/tokens.ts`.** Every token has a light and a
dark value, and `Colors` is a typed contract — adding a token to light and
forgetting dark fails the typecheck. A hex literal in a component is a bug.

**User-facing strings live only in `src/i18n/`.** `en.ts` is typed as
`typeof he`, so a string added to Hebrew fails the build until English has it
too. Use `fill(template, vars)` for `{placeholder}` interpolation.

**Screens that are not wired up yet render a `<StubNote>`** naming the
roadmap phase where they get built, so a tester never reports an unbuilt
phase as a bug.

## Direction

Writing direction is fixed at native startup, so a Hebrew/English switch needs
a reload. `applyDirection` in `src/i18n/index.tsx` reloads at most once per
launch — an unconditional reload is an infinite loop when the flip does not
take, which is how it was first written. Web is handled separately because
`I18nManager.forceRTL` does nothing there.

## Checks before pushing

```bash
npx tsc --noEmit
npx expo export --platform web
```

`expo install` cannot reach the Expo API from some networks. When it fails,
read the SDK-compatible version out of
`node_modules/expo/bundledNativeModules.json` and `npm install` that exact
version instead — do not let npm pick latest.

## Not yet built

No server, no auth, no database, no AI calls. The routine on the Today screen
is hardcoded. Phases 1–3 in `docs/PLAN.md` cover those in order.
