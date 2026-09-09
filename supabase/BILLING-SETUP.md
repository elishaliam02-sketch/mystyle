# Turning on subscriptions

This is what makes APEX a paid app: a free week, then ₪29.90 a month or ₪249 a
year. The prices live in one file (`src/billing/plans.ts`) and the paywall
screen reads them from there, so changing a price is one edit in one place.

Follow the steps in order. It takes about half an hour. You do not need to
write any code.

---

## Read this first — three things that are true

**1. Stripe is free to start, not free.** There is no monthly fee and no
setup fee. Stripe takes a cut of every payment instead — for Israeli cards
roughly **2.9% + ₪1.20** per transaction, more for foreign cards. On a ₪29.90
subscription that is about ₪2.07, so you keep about ₪27.83. Check the current
numbers at <https://stripe.com/il/pricing> before you rely on them. "Free to
start" is the honest phrase. "Free" is not.

**2. The server really is free.** The subscription code runs as a Supabase Edge
Function on Supabase's free tier, alongside the AI function that is already
there. Unless the app gets very popular, it costs nothing.

**3. ⚠️ IF YOU PUT THIS APP ON GOOGLE PLAY OR THE APP STORE, YOU MAY NOT SELL
THE SUBSCRIPTION THROUGH STRIPE.** This is the important one, so read it
twice.

Both stores require that a digital subscription — anything unlocking features
inside the app — is sold through **their** billing system: Google Play Billing
on Android, StoreKit / In-App Purchase on iOS. They take about 15–30% instead
of Stripe's ~3%, and that is not negotiable. An app that takes a card payment
for in-app features through Stripe **gets rejected in review, or removed
later**, under Google Play's Payments policy and App Store Review Guideline
3.1.1.

So:

- **Web only** (the app opened in a browser, installed as a PWA, or sold from
  your own site) → Stripe is fine, and this setup is all you need.
- **Google Play or the App Store** → you must add the stores' own billing. The
  usual way is **RevenueCat**, which wraps both stores behind one API and is
  **free up to $2,500 of monthly tracked revenue** (<https://revenuecat.com>).
  It is a different piece of work from this one; the pure logic in
  `src/billing/plans.ts` and the paywall screen stay exactly as they are, and
  only the part that opens the payment page changes.

Nothing below stops you shipping to the stores later. Just do not ship the
Stripe checkout inside a store build.

---

## 1. Open a Stripe account

1. Go to <https://dashboard.stripe.com/register> and sign up.
2. Fill in the business details Stripe asks for. Until you do, the account is
   in **test mode** — which is exactly where you want to be while setting this
   up. Test mode uses fake cards and moves no real money.
3. Leave the toggle at the top of the dashboard on **Test mode** for now.

## 2. Create the two products

In the Stripe dashboard: **Product catalogue** → **Add product**.

**Monthly:**
- Name: `APEX Pro — monthly`
- Price: `29.90`, currency **ILS**, **Recurring**, billing period **Monthly**
- Save. Then open the price and copy its id — it looks like `price_1AbCd…`

**Yearly:**
- Name: `APEX Pro — yearly`
- Price: `249.00`, currency **ILS**, **Recurring**, billing period **Yearly**
- Save, and copy that price id too.

Keep both ids in a note for step 5. They are not secret, but they are easy to
mix up.

> The amounts in `src/billing/plans.ts` must match what you typed here. The
> file draws the screen; Stripe charges the card. If they disagree, the screen
> is lying. Change both together.

## 3. Create the database tables

Supabase dashboard → **SQL Editor** → **New query**. Paste this whole block and
press **Run**. It is safe to run twice.

```sql
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users on delete cascade,
  status                 text not null default 'none',
  plan_id                text,
  current_period_end     timestamptz,
  trial_ends_at          timestamptz,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- You may read your own subscription and nothing else. Nobody may write one
-- from the app at all: only the server function, holding the service key,
-- writes here — which is what stops a person granting themselves a year.
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Every Stripe event that has already been applied. Stripe retries until it
-- gets a success, so the same event arrives more than once; the primary key
-- here is what makes applying it twice impossible.
create table if not exists public.billing_events (
  event_id    text primary key,
  type        text,
  received_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
-- No policy at all: the app can never read or write this table.
```

## 4. Deploy the function

The code is in `supabase/functions/billing/index.ts`.

- From the dashboard: **Edge Functions** → **Deploy a new function** → name it
  exactly `billing` → paste the file's contents.
- Or from your computer: `supabase functions deploy billing --no-verify-jwt`

`--no-verify-jwt` is needed because Stripe's webhook is not a signed-in user.
It is not a hole: the webhook proves who it is with a cryptographic signature
instead, and the function checks the signed-in user itself on every other
route.

## 5. Put the keys into Supabase (never into the app)

Supabase dashboard → **Edge Functions** → **Secrets** → add these four:

| Name | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe → **Developers** → **API keys** → *Secret key* |
| `STRIPE_PRICE_MONTHLY` | the monthly price id from step 2 |
| `STRIPE_PRICE_YEARLY` | the yearly price id from step 2 |
| `STRIPE_WEBHOOK_SECRET` | step 6 gives you this one |

Optionally add `BILLING_RETURN_URL` — the address Stripe sends people back to
after paying. It defaults to `mystyle://paywall`, which reopens the app.

**Rules about these keys, which do not bend:**

- The secret key starts with `sk_`. It can move money. It goes into Supabase
  Secrets and nowhere else — never into the app's code, never into a chat,
  never into a screenshot, never emailed to anybody, including anyone claiming
  to be support. **Nobody ever needs you to send them a key.** You paste it in
  yourself.
- If a key does get out, Stripe → **API keys** → **Roll key**. It takes ten
  seconds and the old key stops working immediately.
- The keys visible in the app (`src/cloud/config.ts`) are the *publishable*
  ones. Those are meant to be public. The `sk_` one is not.

## 6. Point Stripe at the webhook

This is how the app finds out that somebody actually paid. Without it, a
payment goes through and nothing unlocks.

1. Copy your function's address. It is your Supabase project URL with
   `/functions/v1/billing/webhook` on the end, e.g.
   `https://vesdfboxetdwymsulpsc.supabase.co/functions/v1/billing/webhook`
2. Stripe → **Developers** → **Webhooks** → **Add endpoint**.
3. Paste the address.
4. Under events to send, choose these four:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Add the endpoint, then click **Reveal** on its **Signing secret**. It starts
   with `whsec_`.
6. Put that value into Supabase Secrets as `STRIPE_WEBHOOK_SECRET` (step 5).

The function refuses to believe any webhook whose signature does not check out,
so getting this secret right is what stops a stranger POSTing "this user paid"
at your server.

## 7. Test it with a fake card

With Stripe still in **Test mode**:

1. Open the app, sign in, and go to the paywall.
2. Pick a plan and press the start button. The Stripe page opens.
3. Card number `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
4. Finish. Stripe → **Payments** should show the subscription, and Stripe →
   **Webhooks** → your endpoint should show four green deliveries.
5. Reopen the paywall. It should now say the subscription is active.

If the payment worked but nothing unlocked, it is almost always step 6: check
the webhook endpoint's address and that the signing secret in Supabase matches
the one Stripe shows.

## 8. Go live

1. Finish Stripe's account activation (bank details, ID).
2. Flip the dashboard out of **Test mode**.
3. **The live keys are different keys.** Repeat step 2 (products), step 5
   (`STRIPE_SECRET_KEY`, the two price ids) and step 6 (a new endpoint and a new
   `whsec_`) in live mode. Test-mode ids do not work in live mode and the
   failure is silent from the outside.
4. Buy your own subscription once with a real card to prove the whole path,
   then refund yourself from the Stripe dashboard.

---

## What the free version still does

Set in `src/billing/plans.ts`, so this list and the app cannot drift apart:

- 3 habits
- 30 days of history and charts
- 3 coach replies a day
- 1 meal photo read a day
- 5 progress photos
- 3 exercises of your own
- No cloud backup or multi-device sync

Everything else — the training plan, water, steps, the exercise library, the
food search — is free and stays free. That is deliberate: a free tier nobody
can use does not sell anything.

## Things worth knowing

- **A cancelled subscription is not switched off immediately.** The person keeps
  everything until the end of the period they already paid for. That is both
  fair and what Stripe does by default.
- **Refunds are yours to give**, from the Stripe dashboard. Stripe's per-payment
  fee is not returned to you on a refund.
- **VAT.** The prices on the screen are stated as including VAT. If you register
  for VAT, that is a conversation with your accountant, not with the code — but
  the screen must keep saying whichever is true.
- **You still owe the legal lines.** The paywall already carries them: that the
  subscription renews by itself, how to cancel, and links to the terms and the
  privacy policy. Do not remove them; both stores and Israeli consumer law
  require them.
- **Nobody's card details ever reach this app or this server.** The card is
  typed on Stripe's own page. All that comes back here is "this user is paid up
  until this date".
