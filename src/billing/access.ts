/**
 * The one rule that decides whether a person may use the app at all.
 *
 * APEX is subscribers-only: there is no guest, and no permanent free tier. A
 * person reaches the app itself only when BOTH are true — they are signed in to
 * a real, recoverable account, and that account is inside a paid period or its
 * free trial. Everyone else is sent to the door they need: to sign in, or to
 * start a subscription.
 *
 * This is deliberately pure — no React, no network, no clock of its own. It is
 * handed "now" and what is already known, so the same inputs always give the
 * same answer and every boundary can be tested to the millisecond. The gate
 * component in the router is the only thing that turns this answer into a
 * redirect; keeping the decision here means there is exactly one place the rule
 * lives, and it can be trusted offline from the last-known state rather than
 * locking out a paying customer because the wifi dropped.
 */
import { entitlement, type Entitlement, type EntitlementState } from "./plans";

/** Where a person belongs right now. */
export type Access =
  /** No usable account yet — must sign in or register. */
  | "auth"
  /** Signed in, but nothing entitles them — must start the trial/subscription. */
  | "subscribe"
  /** Trial or paid: the app is theirs. */
  | "app";

export type AccessInput = {
  /**
   * Whether there is a real, recoverable account: signed in AND not anonymous.
   * An anonymous session is how the app talks to the server before anyone has
   * registered; it is not an account a person could ever sign back in to, so it
   * does not open the door on its own.
   */
  hasAccount: boolean;
  /** What the billing rules say this account may use right now. */
  entitlement: Entitlement;
};

/**
 * The whole rule, in one place.
 *
 * The order matters and is not an accident: identity is checked before money.
 * Someone with no account is sent to sign in even if a stale subscription blob
 * is lying around, because a subscription belongs to an account and there is no
 * account here yet. Only once there is a real account does entitlement decide
 * between the app and the paywall.
 */
export function accessFor(input: AccessInput): Access {
  if (!input.hasAccount) return "auth";
  if (input.entitlement === "trial" || input.entitlement === "pro") return "app";
  return "subscribe";
}

/**
 * The same rule, composed with the billing entitlement logic, for the common
 * case where the caller holds the stored subscription blob and the current
 * instant rather than a pre-computed entitlement.
 *
 * `entitlement()` already fails in the safe direction — every unknown, missing
 * or malformed value lands on "free", never "pro" — so a corrupt or absent
 * subscription sends a signed-in person to the paywall, not into the app for
 * nothing.
 */
export function accessForAccount(args: {
  hasAccount: boolean;
  nowIso: string;
  subscription?: {
    status?: EntitlementState["status"];
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
  } | null;
}): Access {
  const ent = entitlement({
    nowIso: args.nowIso,
    status: args.subscription?.status ?? null,
    currentPeriodEnd: args.subscription?.currentPeriodEnd ?? null,
    trialEndsAt: args.subscription?.trialEndsAt ?? null,
  });
  return accessFor({ hasAccount: args.hasAccount, entitlement: ent });
}

/** True when the app itself should be reachable. A convenience for the gate. */
export function appUnlocked(access: Access): boolean {
  return access === "app";
}
