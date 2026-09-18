/**
 * The one switch that turns APEX from "generous free app" into "subscribers
 * only", and a couple of related launch-time flags.
 *
 * Why a flag and not just code: the subscriber-only gate, once on, locks the
 * whole app behind a signed-in account with a live trial or subscription. That
 * is exactly what launch wants — and exactly what must NOT happen a moment
 * before, because an over-the-air update ships to phones in minutes and would
 * lock out every existing user (and the owner's own test device) the instant
 * Stripe is not yet fully wired. So the gate is built, tested, and dormant. On
 * launch day this becomes `true` in one edit, once billing is live end to end.
 *
 * Keep this a plain compile-time constant, not a remote value: a kill-switch
 * for access that itself depends on the network is a way to lock everyone out
 * when the network hiccups.
 */

/**
 * When true, the app is subscribers-only: no guest use, no free tier — a person
 * must be signed in to a real account and inside a trial or paid period to
 * reach any screen. When false (the default, pre-launch), the app behaves as it
 * always has and the gate is inert.
 *
 * FLIP TO TRUE ONLY WHEN, ON A REAL DEVICE, END TO END:
 *   1. Sign up / sign in works and mail arrives.
 *   2. The paywall opens Stripe checkout and a test card starts a trial.
 *   3. After checkout the app unlocks (the webhook wrote the entitlement).
 * Until all three are true, leaving this false is what keeps the app usable.
 */
export const SUBSCRIPTION_REQUIRED = false;

/**
 * Whether an account is required before the paywall (identity before money).
 * Always true under the subscriber-only model; kept as its own flag so the
 * login screen can be exercised on its own before the full gate is switched on.
 */
export const ACCOUNT_REQUIRED = SUBSCRIPTION_REQUIRED;
