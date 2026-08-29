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
  updated_at  timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits (user_id);

-- ------------------------------------------------------------- completions

-- One row per habit per day. The composite key makes ticking twice a no-op
-- rather than a duplicate.
create table if not exists public.completions (
  user_id   uuid not null references auth.users on delete cascade,
  habit_id  text not null,
  date      date not null,
  primary key (user_id, habit_id, date)
);

create index if not exists completions_user_date_idx on public.completions (user_id, date);

-- ---------------------------------------------------------------- weigh-ins

-- One weight per day: logging again the same day replaces it.
create table if not exists public.weigh_ins (
  user_id  uuid    not null references auth.users on delete cascade,
  date     date    not null,
  kg       numeric not null check (kg > 0 and kg < 500),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------- check-ins

create table if not exists public.check_ins (
  user_id  uuid not null references auth.users on delete cascade,
  date     date not null,
  mood     text not null check (mood in ('good', 'ok', 'hard')),
  note     text not null default '',
  primary key (user_id, date)
);

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
