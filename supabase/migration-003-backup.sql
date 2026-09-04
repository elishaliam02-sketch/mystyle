-- Migration 003 — full-state backup blob
--
-- The row-by-row sync (schema.sql, migration-002) keeps habits, completions,
-- weigh-ins, check-ins and the profile merged across devices. Everything else
-- the app now holds — the training plan and set log, the food diary, water,
-- steps, measurements, goals and preferences — is backed up here as one JSON
-- blob per account, so a reinstalled or new phone gets it all back.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query →
-- paste → Run). It is safe to run more than once.

create table if not exists public.backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

-- Each person can read and write only their own backup row.
drop policy if exists "own backup" on public.backups;
create policy "own backup" on public.backups
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
