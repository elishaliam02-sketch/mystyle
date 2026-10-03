-- APEX — reminders for the web app, by Web Push.
--
-- A browser cannot wake itself to remind anyone; a server has to push. These
-- tables hold the least that takes: where to reach each browser, and the ids
-- and times of the reminders it asked for ("water@2026-10-03" at 15:00). The
-- words of a reminder are never stored here — the browser keeps them.
--
-- Only the push function (service role) reads or writes them: row level
-- security is on with no policies, so the app's own key can do neither.
--
-- Safe to run again.

create table if not exists public.push_subscriptions (
  endpoint    text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  p256dh      text        not null,
  auth        text        not null,
  created_at  timestamptz not null default now(),
  constraint push_subscriptions_bounds check (
    char_length(endpoint) <= 1000 and char_length(p256dh) <= 200 and char_length(auth) <= 100
  )
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.push_queue (
  user_id   uuid        not null references auth.users on delete cascade,
  reminder  text        not null,
  at        timestamptz not null,
  sent_at   timestamptz,
  primary key (user_id, reminder),
  constraint push_queue_bounds check (char_length(reminder) <= 64)
);
create index if not exists push_queue_due on public.push_queue (at) where sent_at is null;
alter table public.push_queue enable row level security;

-- One row: when the sender last ran, so overlapping calls skip themselves.
create table if not exists public.push_runs (
  id        int         primary key default 1,
  last_run  timestamptz not null default 'epoch',
  constraint push_runs_one_row check (id = 1)
);
insert into public.push_runs (id) values (1) on conflict do nothing;
alter table public.push_runs enable row level security;

revoke all on public.push_subscriptions, public.push_queue, public.push_runs from anon, authenticated;

-- Every minute, ask the function to send what is due. pg_net makes the call;
-- the function needs no key for it (see supabase/functions/push).
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'push-send',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://vesdfboxetdwymsulpsc.supabase.co/functions/v1/push',
      body := '{"action":"send"}'::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  $job$
);
