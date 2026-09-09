# MyStyle — working notes

A daily-routine coach for weight loss. Read `docs/PLAN.md` before making
scope decisions; it records what v1 contains and, more usefully, what it
deliberately does not.

## Conventions

**Colours live only in `src/theme/tokens.ts`.** Every token has a light and a
dark value, and `Colors` is a typed contract — adding a token to light and
forgetting dark fails the typecheck. A hex literal in a component is a bug.

**Four colours, and no fifth.** Electric blue, vibrant orange, neon lime, deep
charcoal. Every neutral is charcoal thinned or lifted, so the greys belong to
the family too. Each bright ships in two weights: a vivid `fill` for solid
blocks, and an `ink` (`orangeInk`, `limeInk`) that is the same hue darkened
until it clears 4.5:1 as text on paper — neon lime on white is 1.2:1, so a
lime *fill* belongs on a charcoal ground and `metricFill` hands out `limeInk`
on a light theme instead. `npm run test:theme` measures every pairing and every
hue: a stray colour or a bright that drifts under the bar fails a test.

**Each metric family owns one hue, app-wide** (`src/theme/metrics.ts`). Load is
blue (kg, volume, 1RM, bodyweight, water), counts are lime (reps, sets, steps,
ticks, the day score), time and cost are orange (the rest clock, minutes,
pace, calories, streaks, a PR). Read a figure's colour with `metricInk` /
`metricFill` / `onMetric` rather than picking a token by hand — the point is
that kilos are the same blue on every screen, so a glance mid-set lands.

**User-facing strings live only in `src/i18n/`.** `en.ts` is typed as
`typeof he`, so a string added to Hebrew fails the build until English has it
too. Use `fill(template, vars)` for `{placeholder}` interpolation.

**A self-assigned task is scanned, not guessed at.** `src/tasks/difficulty.ts`
reads what the person wrote — the numbers and their units, the verbs, whether
it is a thing done or resisted — and prices it easy / moderate / hard. It is
pure, offline, bilingual, and runs on every keystroke. `src/rewards` turns the
ticks into points and levels the same way the achievements board works: a pure
function of stored state, so unticking a day takes its points back and there is
no ledger to keep in step.

**Nothing leaves the device without an explicit opt-in.** `src/legal/` holds
the privacy policy and terms (Hebrew first, `documents.en.ts` typed as
`typeof he`), the accepted-version record, and the consent mirror the AI
transport reads. Two switches, both off by default and separate from accepting
the terms: cloud backup gates every round in `useCloud`, the AI coach gates
every call in `src/ai/server.ts`. Raising `LEGAL.version` makes every existing
user re-accept. Adding a network call means adding it to a gate and to the
policy — `npm run test:legal` checks the documents stay in step, name every
processor, and carry no placeholder text.

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
npm run test:theme     # palette: four hues, and every pairing readable
npm run test:tasks     # the difficulty scanner, in both languages
npm run test:rewards   # points, levels and the streak bonus
npm run test:legal     # the documents, both languages, and the consent mirror
npm run test:kitchen   # the food library: no food shadows another's words
```

After adding or upgrading a dependency, regenerate the licence list that the
profile screen shows: `npm run licenses`.

`expo install` cannot reach the Expo API from some networks. When it fails,
read the SDK-compatible version out of
`node_modules/expo/bundledNativeModules.json` and `npm install` that exact
version instead — do not let npm pick latest.

## Platforms

iOS, Android and web from one bundle. Anything native-only needs a web branch,
and the failure mode is silence rather than a crash: `Alert` has no
implementation on web, so a confirm dialog simply never appeared and the action
never ran. Use `confirm` / `notify` from `src/ui/confirm.ts` rather than
`Alert` directly. `expo-notifications`, the pedometer, the image picker and
secure storage all already carry their own web branch.

## Updating a shipped app

`src/updates/` checks on launch and on foreground, downloads in the background
and *offers* a restart — it never restarts on its own, and it no-ops in Expo Go
and on web. `runtimeVersion` follows `version` in app.json, so an update only
ever reaches a build that can run it. JavaScript, strings, the palette and the
food library ship this way; native changes still need a store build.

## Before publishing

`docs/COMPLIANCE.md` is the checklist: what the code already satisfies, and the
handful of things that need a person (running the deletion migration, the store
console answers, an age rating, a lawyer's read).

## Not yet built

The routine on the Today screen is hardcoded. Phases 1–3 in `docs/PLAN.md`
cover what is left, in order.
