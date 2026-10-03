-- APEX — the days of the week a habit is due.
--
-- Every habit used to be due every day, so "the gym, three times a week"
-- broke its streak on each rest day. `days` holds the weekdays a habit is due
-- on, 0 = Sunday … 6 = Saturday (the same numbering as JavaScript's getDay);
-- null means every day, which is what every existing row keeps. An app that
-- predates this never sends the column, and an upsert that does not name a
-- column leaves it as it was.
--
-- Safe to run again.

alter table public.habits add column if not exists days smallint[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habits_days_bounds') then
    alter table public.habits add constraint habits_days_bounds check (
      days is null
      or (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    ) not valid;
  end if;
end;
$$;

-- The API learns about the new column now rather than at its next restart.
notify pgrst, 'reload schema';
