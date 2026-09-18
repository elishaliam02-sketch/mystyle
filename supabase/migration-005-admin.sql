-- Migration 005 — subscriptions, admins, audit trail, invoices
--
-- Everything the paid, operated service needs on top of the app's own data:
-- who is subscribed, who may run the owner console, an append-only record of
-- what happened, and the legal invoices issued for payments.
--
-- Safe to run more than once. Every object is guarded, so pasting this whole
-- block into the Supabase SQL editor a second time changes nothing and errors
-- on nothing.
--
-- The security shape, in one sentence: a person can read only their OWN
-- subscription and invoices and whether they themselves are an admin, and can
-- write NONE of these tables — every write here is the server's, holding the
-- service-role key, which is what stops anyone granting themselves a
-- subscription or admin rights from the app.

-- 1) Subscriptions. The billing function writes it from Stripe; a person reads
--    only their own row. (Idempotent copy of the BILLING-SETUP table, so the
--    billing tables exist even if that manual step was never run.)
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
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- 2) Billing events. The idempotency ledger for Stripe's webhook retries. No
--    policy at all: the app can neither read nor write it.
create table if not exists public.billing_events (
  event_id    text primary key,
  type        text,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;

-- 3) Admins. Who may use the owner console. The server checks this with the
--    service key; a signed-in person may read only their OWN row, so the app
--    can tell whether to show the admin door without being able to see, or
--    become, anyone else.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "see whether i am an admin" on public.admins;
create policy "see whether i am an admin" on public.admins
  for select using (auth.uid() = user_id);

-- 4) Audit log. The append-only trail: logins, subscription changes, and every
--    admin action, with who/when/what. No client policy — it is read only
--    through the admin function, and written only by the server. The mirror of
--    src/admin/audit.ts, which guarantees no secret is ever put in `meta`.
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  kind       text not null,
  actor_id   uuid,
  target_id  uuid,
  meta       jsonb
);
alter table public.audit_log enable row level security;
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_id);

-- 5) Invoices. One legal Israeli tax invoice (Green Invoice) per payment. A
--    person reads their own; the server writes them. The unique index on the
--    originating payment event is what stops a webhook retry issuing a second
--    invoice for the same charge.
create table if not exists public.invoices (
  id           text primary key,          -- Green Invoice document id
  user_id      uuid references auth.users on delete set null,
  number       text,                      -- the human-facing invoice number
  amount_minor integer,                    -- agorot; money is always an integer
  currency     text,
  url          text,                       -- link to the invoice PDF
  stripe_event text,                       -- the payment event it was issued for
  issued_at    timestamptz not null default now()
);
create unique index if not exists invoices_stripe_event_idx on public.invoices (stripe_event);
alter table public.invoices enable row level security;
drop policy if exists "read own invoices" on public.invoices;
create policy "read own invoices" on public.invoices
  for select using (auth.uid() = user_id);
