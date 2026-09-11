/**
 * The APEX mark, as geometry.
 *
 * A climb, in two strokes: a wide chevron at the top — the summit you are
 * heading for — and a smaller one beneath it, the step taken today. Read
 * quickly it is an arrow pointing up; read slowly it is the app's whole idea,
 * which is that a peak is reached one repeated step at a time. It is not a
 * letter in a box: at 16px in a tab bar a letterform turns to mush, while two
 * chevrons keep a silhouette you can still recognise.
 *
 * The two strokes carry two of the brand's colours, and which ones is not
 * decoration: violet is the app's primary, and lime is the colour every
 * *completed* count wears (see `metrics.ts`) — so the step you have finished is
 * lime and the peak ahead is violet, everywhere the mark appears.
 *
 * Kept here rather than inside the component because the app icon, the splash
 * screen, the favicon and the Android adaptive layers are generated from these
 * same numbers (`scripts/gen-icons.mjs`). One definition, so the icon on the
 * home screen can never drift from the logo inside the app.
 */

/** Everything below is drawn in this coordinate space. */
export const MARK_VIEWBOX = 100;

/** The summit — a wide chevron across the top two-thirds. */
export const MARK_PEAK = "M16 58 L50 18 L84 58";
export const MARK_PEAK_WIDTH = 15;

/** Today's step — the smaller chevron beneath it. */
export const MARK_STEP = "M30 86 L50 64 L70 86";
export const MARK_STEP_WIDTH = 13;
