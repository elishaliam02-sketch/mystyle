-- APEX — two server-side guards.
--
-- 1. A durable counter for the AI function. Its old limiter was a map in one
--    instance's memory: reset by every cold start, never shared between
--    instances. Only the service role (the function itself) may touch it.
-- 2. Deleting an account needs a recent sign-in. A phone left unlocked, or a
--    stolen session token, could otherwise erase an account in one tap. The
--    app asks for the password and signs in again just before; this is the
--    check that holds even for a caller that skips the app.
--
-- 3. The read-your-own-row policies from migration-005 are scoped to signed-in
--    callers. They were already safe (auth.uid() is null without a session),
--    but a policy should name who it is for rather than rely on that.
--
-- Paste into the Supabase SQL editor and run once. Safe to run again.
-- Written without quoted identifiers, like the other migrations.

create table if not exists public.ai_usage (
  key text primary key,
  n integer not null default 0,
  expires_at timestamptz not null
);

-- RLS on with no policies: invisible to anon and authenticated alike.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Adds one to each key and returns the new counts, in order. A key whose
-- window has ended starts again at one.
create or replace function public.ai_count(keys text[], seconds integer[])
returns integer[]
language plpgsql
security definer
set search_path = public
as $$
declare
  counts integer[] := array[]::integer[];
  c integer;
begin
  if random() < 0.01 then
    delete from public.ai_usage where expires_at < now();
  end if;

  for i in 1 .. coalesce(array_length(keys, 1), 0) loop
    insert into public.ai_usage as u (key, n, expires_at)
    values (keys[i], 1, now() + make_interval(secs => seconds[i]))
    on conflict (key) do update
      set n = case when u.expires_at < now() then 1 else u.n + 1 end,
          expires_at = case when u.expires_at < now() then excluded.expires_at else u.expires_at end
    returning n into c;
    counts := counts || c;
  end loop;
  return counts;
end;
$$;

revoke all on function public.ai_count(text[], integer[]) from public, anon, authenticated;
grant execute on function public.ai_count(text[], integer[]) to service_role;

-- Replaces the version in migration-004, adding the recency check.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
  anonymous boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  recent boolean;
begin
  if me is null then
    raise exception using message = 'not authenticated', errcode = '28000';
  end if;

  -- amr lists how and when this session proved who it is. A password
  -- sign-in or a reset link in the last ten minutes counts. An anonymous
  -- account has no password to ask for; nothing but this device can reach it.
  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as a(entry)
    where (entry ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 600
  ) into recent;

  if not anonymous and not recent then
    raise exception using message = 'recent sign-in required', errcode = '42501';
  end if;

  delete from public.backups where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- The three names below are the ones migration-005 gave these policies, so
-- they are quoted; type them with straight quotes.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'read own subscription') then
    alter policy "read own subscription" on public.subscriptions to authenticated;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admins' and policyname = 'see whether i am an admin') then
    alter policy "see whether i am an admin" on public.admins to authenticated;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'read own invoices') then
    alter policy "read own invoices" on public.invoices to authenticated;
  end if;
end;
$$;
