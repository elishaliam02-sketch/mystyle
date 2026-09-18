---
name: stripe-billing
description: How subscriptions and money work in APEX, and how to change them safely. Use whenever a task touches prices, plans, the free trial, the free-vs-paid line, the paywall, Stripe checkout/portal/webhooks, entitlement, refunds, or going live with payments — or when configuring the billing edge function and its secrets.
---

# Stripe billing in APEX

The paid/free line is defined in ONE place and enforced by a server the client cannot
lie to. Learn the map before touching anything.

## The files
| File | Role |
| --- | --- |
| `src/billing/plans.ts` | Single source of truth: prices (minor units), trial length, entitlement rules, free-tier limits. Pure. |
| `src/billing/entitlement.ts` | Parses the server's entitlement answer. Unknown → not pro. |
| `src/billing/gate.ts` (+ `gatetest.ts`) | Enforces the free-tier limits in the app. |
| `supabase/functions/billing/index.ts` | Edge function: `checkout`, `portal`, `status`, and the signed `webhook`. Holds the service-role + Stripe secrets. |
| `src/cloud/entitlementPort.ts` | The app's call to `status` and back. |
| `app/paywall.tsx` | The screen. Renders `plans.ts`; invents nothing. |
| `supabase/BILLING-SETUP.md` | The owner runbook. Must stay truthful. |

## Non-negotiable invariants
1. Money is an integer (minor units). Never keep a float. `formatPrice` is the only
   place a decimal appears.
2. The client sends a plan id, never a price. The Stripe price id is resolved from env
   server-side.
3. Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, service-role) live only in the
   function's env. Never in the repo, a log, or a chat.
4. The webhook checks the signature first, and is idempotent via the `billing_events`
   primary key.
5. Every failure grants LESS. A dropped network never overwrites a real subscription
   with "none".
6. A cancelled subscription stays pro until the paid period ends.

## Common tasks
**Change a price:** edit `plans.ts` AND the Stripe product price together; they must
agree or the screen lies. Update `BILLING-SETUP.md` if the number is quoted there.

**Add/adjust the free tier:** edit `FREE_LIMITS` in `plans.ts`, extend the gate tests,
and make sure the paywall copy still matches.

**Trace a "paid but nothing unlocked" bug:** almost always the webhook — check the
endpoint URL ends in `/functions/v1/billing/webhook`, that the four subscription events
are subscribed, and that `STRIPE_WEBHOOK_SECRET` in Supabase matches Stripe's signing
secret. Then check `billing_events` recorded the event and `subscriptions` updated.

**Test mode:** card `4242 4242 4242 4242`, any future expiry/CVC. Verify four green
webhook deliveries and that the paywall then reads active.

**Go live:** live keys are DIFFERENT keys — redo products, secrets, and the webhook
endpoint in live mode. Test-mode ids fail silently in live mode.

## The store-policy fork (decides whether Stripe can be used at all)
- Web / PWA build → Stripe is fine (already built).
- Google Play / App Store build → the subscription MUST be sold through the store
  (RevenueCat/Play Billing/StoreKit), not Stripe. Keep `plans.ts` and the paywall; swap
  only the "open payment" step, and reconcile entitlement from the store receipt too.

## Always, before you finish
Run `npm run test:billing`, `npm run test:gate`, `npm test`, and `npx tsc --noEmit`.
Never weaken an invariant to make a test pass.
