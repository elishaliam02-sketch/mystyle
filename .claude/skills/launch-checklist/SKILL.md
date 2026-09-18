---
name: launch-checklist
description: The go-live gate for APEX as a paid service — what must be true before real users and real money. Use before a public launch, before flipping payments to live mode, before a store submission, or when someone asks "are we ready to launch / what's left". Covers config, email, monitoring, backups, abuse, legal/compliance, and store policy.
---

# APEX launch checklist

Do not treat "the app works" as "the service is ready". Work top to bottom; each item is
verifiable, not a vibe. Report the true state of each — done / not done / N/A — never a
blanket "ready".

## 1. Configuration is real (not placeholder)
- [ ] Supabase project live; RLS on every user table; `delete_my_account` deployed.
- [ ] Stripe in LIVE mode: live secret key, live price ids, live webhook + `whsec_`, all
      in Supabase secrets (never in the repo). Test-mode ids fail silently in live.
- [ ] AI keys (Gemini/Anthropic) server-side only; free-tier per-day caps enforced on the
      server, not just the client.
- [ ] `app.json` / EAS carry no secrets.

## 2. Email actually arrives
- [ ] Confirmation and password-reset mail delivered on a real sender (Supabase built-in
      SMTP is rate-limited → wire Resend/Postmark), not landing in spam.
- [ ] Reset/confirm deep links are registered redirect URLs in Supabase for both web
      origin and the app scheme, and tested end to end.

## 3. You can see what's happening
- [ ] Crash reporting (Sentry) wired, consent-gated, source maps uploaded.
- [ ] Product analytics (privacy-respecting, consent-gated) for the funnel that matters:
      install → account → trial → paid.
- [ ] Uptime/health checks on the site and the `ai`/`billing` edge functions, with an
      alert that reaches a human.

## 4. Data is safe
- [ ] Postgres point-in-time recovery / backups confirmed, and the restore steps are
      written down and have been tried once.
- [ ] Account export and delete both work (they exist — verify on a live account).

## 5. Abuse can't sink you
- [ ] Rate limits on auth and on the AI/billing functions.
- [ ] A CAPTCHA/Turnstile on sign-up before public launch.
- [ ] AI spend cap: a runaway or hostile user cannot run up an unbounded bill.

## 6. Legal / compliance
- [ ] Privacy policy + terms hosted at public URLs and linked from the paywall and
      onboarding.
- [ ] Auto-renew disclosure, price, and cancellation instructions on the paywall (both
      stores and Israeli consumer law require them).
- [ ] Israeli tax invoice issued per payment (see the israeli-invoicing skill) if billing
      as a registered business.
- [ ] Israeli Privacy Protection Law + GDPR basics: consent, export, delete — all real.
- [ ] A support contact that a person actually reads.

## 7. The release path itself
- [ ] The CI gate (`checks.yml`) is green on the exact commit; e2e is hermetic (no
      external-host dependency). Never disable a check to ship.
- [ ] You know whether the pending change is OTA-eligible (JS only) or needs a native
      build (permissions, native modules, SDK/icon/splash, app.json native keys).
- [ ] Store builds do NOT sell the subscription via Stripe (policy → rejection). Store
      billing (RevenueCat) is wired if shipping to a store.

## Recommended launch order for a solo builder
1. Web / PWA with Stripe (start charging with what's built) + Israeli invoicing.
2. A dedicated login/signup screen (keep "continue as guest").
3. Admin/support console.
4. The SaaS infra above (email, monitoring, backups, abuse).
5. Public web launch.
6. Stores later: RevenueCat + Apple/Google sign-in + native build.

Output a per-item status list, then the single most important blocker to fix next.
