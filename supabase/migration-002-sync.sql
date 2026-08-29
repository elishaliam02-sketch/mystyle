-- MyStyle — migration 002: real sync.
--
-- Run this once in the Supabase SQL editor if you already ran schema.sql.
-- On a fresh project, schema.sql alone is enough — it contains all of this.
-- Every statement is safe to run twice.
--
-- What it changes:
--   * completions get an explicit `done`, so unticking a habit survives a sync
--     instead of being resurrected by the server's copy
--   * every table gets `updated_at` (the device's clock, to settle a clash)
--     and `synced_at` (the server's clock, to decide what to send)
--   * indexes shaped like the query every sync actually runs

-- ------------------------------------------------------------- new columns

alter table public.completions add column if not exists done       boolean     not null default true;
alter table public.completions add column if not exists updated_at timestamptz not null default now();
alter table public.completions add column if not exists synced_at  timestamptz not null default now();

alter table public.habits      add column if not exists synced_at  timestamptz not null default now();

alter table public.weigh_ins   add column if not exists updated_at timestamptz not null default now();
alter table public.weigh_ins   add column if not exists synced_at  timestamptz not null default now();

alter table public.check_ins   add column if not exists updated_at timestamptz not null default now();
alter table public.check_ins   add column if not exists synced_at  timestamptz not null default now();

-- ------------------------------------------------------- the server's clock

-- Set by the database on every write, so a client cannot set it even if it
-- tries. That is what makes it usable as one cursor for the whole account.
create or replace function public.stamp_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_habits      on public.habits;
drop trigger if exists stamp_completions on public.completions;
drop trigger if exists stamp_weigh_ins   on public.weigh_ins;
drop trigger if exists stamp_check_ins   on public.check_ins;

create trigger stamp_habits      before insert or update on public.habits
  for each row execute function public.stamp_synced_at();
create trigger stamp_completions before insert or update on public.completions
  for each row execute function public.stamp_synced_at();
create trigger stamp_weigh_ins   before insert or update on public.weigh_ins
  for each row execute function public.stamp_synced_at();
create trigger stamp_check_ins   before insert or update on public.check_ins
  for each row execute function public.stamp_synced_at();

create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.server_now() to authenticated;

-- ------------------------------------------------------- sync-shaped indexes

create index if not exists habits_sync_idx      on public.habits      (user_id, synced_at);
create index if not exists completions_sync_idx on public.completions (user_id, synced_at);
create index if not exists weigh_ins_sync_idx   on public.weigh_ins   (user_id, synced_at);
create index if not exists check_ins_sync_idx   on public.check_ins   (user_id, synced_at);
