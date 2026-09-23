-- APEX — bounds on what one account may store, and order-safe billing.
--
-- 1. Size limits. Any visitor can mint an anonymous account with the public
--    key, and every table accepted text and JSON of any size and any number
--    of rows. One script could fill the database, and Supabase turns a full
--    database read-only for everyone. The limits sit far above what the app
--    ever writes (the sync clamps to the same numbers before sending), so
--    they only ever stop abuse.
-- 2. Row caps on the two tables whose row count a person drives: habits and
--    completions. Weigh-ins and check-ins are one per day and bounded by the
--    date range below.
-- 3. Subscriptions take a Stripe event's time, and an older event can no
--    longer overwrite a newer one. Stripe does not deliver in order: a late
--    "trialing" arriving after "deleted" used to hand the trial back.
--
-- Paste into the Supabase SQL editor and run once. Safe to run again.
-- Constraints are added NOT VALID: they bind every write from now on without
-- failing on a row that is already stored.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bounds') then
    alter table public.profiles add constraint profiles_bounds check (
      char_length(name) <= 100
      and (start_kg is null or start_kg between 20 and 500)
      and (goal_kg is null or goal_kg between 20 and 500)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habits_bounds') then
    alter table public.habits add constraint habits_bounds check (
      char_length(id) <= 64
      and char_length(title) <= 200
      and (slot is null or char_length(slot) <= 32)
      and (anchor is null or char_length(anchor) <= 200)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'completions_bounds') then
    alter table public.completions add constraint completions_bounds check (
      char_length(habit_id) <= 64
      and date between date '2000-01-01' and date '2100-01-01'
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'weigh_ins_bounds') then
    alter table public.weigh_ins add constraint weigh_ins_bounds check (
      date between date '2000-01-01' and date '2100-01-01'
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'check_ins_bounds') then
    alter table public.check_ins add constraint check_ins_bounds check (
      char_length(note) <= 2000
      and date between date '2000-01-01' and date '2100-01-01'
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'backups_bounds') then
    alter table public.backups add constraint backups_bounds check (
      octet_length(data::text) <= 2000000
    ) not valid;
  end if;
end;
$$;

-- Statement-level, so a sync that upserts a thousand rows counts once per
-- account rather than once per row.
create or replace function public.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := tg_argv[0]::integer;
  over uuid;
begin
  execute format(
    'select t.user_id from %I.%I t where t.user_id in (select distinct user_id from new_rows) group by t.user_id having count(*) > $1 limit 1',
    tg_table_schema, tg_table_name
  ) into over using cap;
  if over is not null then
    raise exception using message = 'row limit reached', errcode = '54000';
  end if;
  return null;
end;
$$;

drop trigger if exists habits_row_cap on public.habits;
create trigger habits_row_cap after insert on public.habits
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap(500);

drop trigger if exists completions_row_cap on public.completions;
create trigger completions_row_cap after insert on public.completions
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap(200000);

-- ------------------------------------------------------------ billing order

alter table public.subscriptions add column if not exists stripe_event_at timestamptz;

-- The webhook's only write path for a subscription change. An event older
-- than the one already applied is ignored, and so is a late "ended" for a
-- previous subscription while a newer one is live.
create or replace function public.apply_subscription_event(
  p_user uuid,
  p_status text,
  p_plan text,
  p_period_end timestamptz,
  p_trial_end timestamptz,
  p_customer text,
  p_subscription text,
  p_event_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  applied integer;
begin
  insert into public.subscriptions as s (
    user_id, status, plan_id, current_period_end, trial_ends_at,
    stripe_customer_id, stripe_subscription_id, stripe_event_at, updated_at
  ) values (
    p_user, p_status, p_plan, p_period_end, p_trial_end,
    p_customer, p_subscription, p_event_at, now()
  )
  on conflict (user_id) do update set
    status = excluded.status,
    plan_id = excluded.plan_id,
    current_period_end = excluded.current_period_end,
    trial_ends_at = excluded.trial_ends_at,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_event_at = excluded.stripe_event_at,
    updated_at = now()
  where (s.stripe_event_at is null or s.stripe_event_at <= excluded.stripe_event_at)
    and not (
      s.stripe_subscription_id is not null
      and s.stripe_subscription_id is distinct from excluded.stripe_subscription_id
      and s.status in ('active', 'trialing')
      and excluded.status in ('expired', 'none')
    );
  get diagnostics applied = row_count;
  return applied > 0;
end;
$$;

revoke all on function public.apply_subscription_event(uuid, text, text, timestamptz, timestamptz, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, text, text, timestamptz, timestamptz, text, text, timestamptz) to service_role;
