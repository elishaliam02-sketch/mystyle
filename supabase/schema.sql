-- MyStyle — database schema.
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Every table is keyed by the signed-in user and protected by row level
-- security, so one person's rows are unreachable to anyone else even if a key
-- leaks. Ids for habits are generated on the device, which lets the app keep
-- working offline and sync afterwards without renumbering anything.

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text        not null default '',
  start_kg    numeric,
  goal_kg     numeric,
  reminders   boolean     not null default false,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ habits

create table if not exists public.habits (
  id          text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  title       text        not null,
  slot        text,
  anchor      text,
  created_at  date        not null,
  archived    boolean     not null default false,
  -- When the device wrote this row. Used to settle a clash between two
  -- devices, never to decide what to send: it is the device's clock.
  updated_at  timestamptz not null default now(),
  -- When this server recorded it. Used to decide what to send, never to
  -- settle a clash: it is one clock for the whole account.
  synced_at   timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits (user_id);

-- ------------------------------------------------------------- completions

-- One row per habit per day. The composite key makes ticking twice a no-op
-- rather than a duplicate.
-- `done` is written out rather than implied by the row existing. Presence as
-- truth could not express "I unticked this": the row vanished on the device
-- and the server's copy brought the tick straight back on the next sync.
create table if not exists public.completions (
  user_id     uuid        not null references auth.users on delete cascade,
  habit_id    text        not null,
  date        date        not null,
  done        boolean     not null default true,
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  primary key (user_id, habit_id, date)
);

create index if not exists completions_user_date_idx on public.completions (user_id, date);

-- ---------------------------------------------------------------- weigh-ins

-- One weight per day: logging again the same day replaces it.
create table if not exists public.weigh_ins (
  user_id     uuid        not null references auth.users on delete cascade,
  date        date        not null,
  kg          numeric     not null check (kg > 0 and kg < 500),
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------- check-ins

create table if not exists public.check_ins (
  user_id     uuid        not null references auth.users on delete cascade,
  date        date        not null,
  mood        text        not null check (mood in ('good', 'ok', 'hard')),
  note        text        not null default '',
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  primary key (user_id, date)
);

-- ------------------------------------------------------- the server's clock

-- Every sync asks "what have you recorded since?", and the answer has to be in
-- one clock or devices disagree about what they have already seen. `synced_at`
-- is set here, by the database, on every insert and update — a client cannot
-- set it even if it tries, which is the point.
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

-- The device reads the server's clock at the start of every pull, so the
-- cursor it stores is comparable with the column above.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.server_now() to authenticated;

-- ------------------------------------------------------- sync-shaped indexes

-- Every pull after the first is "my rows, recorded since X". Leading with
-- user_id keeps each user's scan inside their own rows; without these, one
-- sync reads the whole table, and at ten thousand users that is the difference
-- between a few milliseconds and a timeout.
create index if not exists habits_sync_idx      on public.habits      (user_id, synced_at);
create index if not exists completions_sync_idx on public.completions (user_id, synced_at);
create index if not exists weigh_ins_sync_idx   on public.weigh_ins   (user_id, synced_at);
create index if not exists check_ins_sync_idx   on public.check_ins   (user_id, synced_at);

-- --------------------------------------------------------- row level security

alter table public.profiles    enable row level security;
alter table public.habits      enable row level security;
alter table public.completions enable row level security;
alter table public.weigh_ins   enable row level security;
alter table public.check_ins   enable row level security;

-- A single policy per table: you may touch a row only if it is yours.
-- `to authenticated` keeps anonymous REST callers out entirely.

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own completions" on public.completions;
create policy "own completions" on public.completions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own weigh_ins" on public.weigh_ins;
create policy "own weigh_ins" on public.weigh_ins
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own check_ins" on public.check_ins;
create policy "own check_ins" on public.check_ins
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------- profile row on sign-up

-- Creating the profile in a trigger means the app never has to check whether
-- one exists before writing to it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
