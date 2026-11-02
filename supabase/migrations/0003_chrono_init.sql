-- Chrono Prises: shoot timer with colour markers, exported as Premiere Pro XML.
--
-- Two fixed accounts, same model as 0002_materiel_init.sql (made-up logins, created once from the
-- Supabase dashboard: Authentication → Add user → email + password, "Auto Confirm User" ticked;
-- never through public sign-up). The login emails are not secret — like the anon key in
-- chrono/index.html they grant nothing without the password. The app only asks for a password and
-- tries the admin account first, then the guest account.
--
--   chrono-admin@prises.local   → Martin: reads his own takes AND the guests' takes
--   chrono-invite@prises.local  → guests: read and write only the guest takes
--
-- Every account writes only its own rows (user_id = auth.uid()). Anyone else who manages to create
-- an account matches neither email, so every policy denies them.
--
-- Run this whole file once in the Supabase SQL Editor. It is safe to run again.

create table if not exists public.chrono_takes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,   -- the take: name, markers, chrono state
  deleted boolean not null default false,    -- soft delete, so a deletion syncs to every device
  updated_at timestamptz not null default now()
);

create table if not exists public.chrono_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,   -- session name, frame rate, button names and colours
  updated_at timestamptz not null default now()
);

create index if not exists chrono_takes_user_id_idx on public.chrono_takes(user_id);

alter table public.chrono_takes enable row level security;
alter table public.chrono_settings enable row level security;

-- Reading takes: the admin reads everything (his own and the guests'); the guest reads only its own.
drop policy if exists "chrono takes read" on public.chrono_takes;
create policy "chrono takes read" on public.chrono_takes
  for select
  using (
    lower(auth.email()) = 'chrono-admin@prises.local'
    or (lower(auth.email()) = 'chrono-invite@prises.local' and user_id = auth.uid())
  );

-- Writing takes: each of the two accounts only ever writes its own rows.
drop policy if exists "chrono takes insert" on public.chrono_takes;
create policy "chrono takes insert" on public.chrono_takes
  for insert
  with check (
    lower(auth.email()) = ANY (ARRAY['chrono-admin@prises.local', 'chrono-invite@prises.local'])
    and user_id = auth.uid()
  );

drop policy if exists "chrono takes update" on public.chrono_takes;
create policy "chrono takes update" on public.chrono_takes
  for update
  using (
    lower(auth.email()) = ANY (ARRAY['chrono-admin@prises.local', 'chrono-invite@prises.local'])
    and user_id = auth.uid()
  )
  with check (
    lower(auth.email()) = ANY (ARRAY['chrono-admin@prises.local', 'chrono-invite@prises.local'])
    and user_id = auth.uid()
  );

drop policy if exists "chrono takes delete" on public.chrono_takes;
create policy "chrono takes delete" on public.chrono_takes
  for delete
  using (
    lower(auth.email()) = ANY (ARRAY['chrono-admin@prises.local', 'chrono-invite@prises.local'])
    and user_id = auth.uid()
  );

-- Settings: strictly per account.
drop policy if exists "chrono own settings only" on public.chrono_settings;
create policy "chrono own settings only" on public.chrono_settings
  for all
  using (
    lower(auth.email()) = ANY (ARRAY['chrono-admin@prises.local', 'chrono-invite@prises.local'])
    and user_id = auth.uid()
  )
  with check (
    lower(auth.email()) = ANY (ARRAY['chrono-admin@prises.local', 'chrono-invite@prises.local'])
    and user_id = auth.uid()
  );
