-- APEX — the right to be forgotten, done properly.
--
-- Deleting rows from the client is not enough: the account itself lives in
-- auth.users, which no client key may touch, and an app that leaves the login
-- behind has not deleted anything a privacy law would recognise. So deletion
-- happens here, in a function that runs with the owner's rights and deletes
-- exactly one row — the caller's own. Every table in schema.sql references
-- auth.users with on delete cascade, so removing that row takes the profile,
-- habits, completions, weigh-ins, check-ins and the backup blob with it.
--
-- Paste into the Supabase SQL editor and run once. Safe to run again.
-- Written without quoted identifiers or quoted defaults, like the other
-- migrations, so a phone keyboard that turns straight quotes into curly ones
-- cannot break it.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
begin
  -- No session, no deletion. Without this the function would happily run as
  -- the owner with a null id and delete nothing at all, silently.
  if me is null then
    raise exception using message = 'not authenticated', errcode = '28000';
  end if;

  -- The cascade does the rest. Listed explicitly anyway for the two tables
  -- added by later migrations, so a project that ran them out of order still
  -- ends up empty rather than half-deleted.
  delete from public.backups where user_id = me;
  delete from auth.users where id = me;
end;
$$;

-- Only a signed-in caller may run it, and it can only ever act on that
-- caller's own id.
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
