-- Matériel: TV studio equipment inventory, private to a single shared account.
--
-- Same security model as 0001_init.sql: every policy checks the session's email against a
-- hardcoded allow-list AND that the row belongs to that same session (user_id = auth.uid()).
-- Anyone else who creates an account matches neither check, so every policy denies them.
--
-- Unlike 0001_init.sql, the email below isn't a personal address — it's a fixed, made-up login
-- for the single account this app uses (create it once from the Supabase dashboard:
-- Authentication → Add user → this email + a password of your choice; never through public
-- sign-up). It's safe to commit as-is: like the anon key already in materiel/index.html, knowing
-- it grants nothing without the password, and the app never asks for or displays it — the login
-- screen only asks for the password. Change it here (and match it in materiel/index.html's
-- APP_LOGIN_EMAIL) only if you want a different one.

create table if not exists public.materiel_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  description text not null default '',
  category text not null default '',
  specs jsonb not null default '{}'::jsonb,
  location text not null default '',
  photo_paths text[] not null default '{}',
  status text not null default 'pending', -- pending | analyzed | error
  analysis_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.materiel_items enable row level security;

drop policy if exists "own materiel items only" on public.materiel_items;
create policy "own materiel items only" on public.materiel_items
  for all
  using (
    lower(auth.email()) = ANY (ARRAY['studio-materiel@inventaire.local'])
    and user_id = auth.uid()
  )
  with check (
    lower(auth.email()) = ANY (ARRAY['studio-materiel@inventaire.local'])
    and user_id = auth.uid()
  );

create index if not exists materiel_items_user_id_idx on public.materiel_items(user_id);
create index if not exists materiel_items_location_idx on public.materiel_items(location);

-- Trigger to keep updated_at current on every edit (analysis results, manual corrections, etc).
create or replace function public.materiel_items_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists materiel_items_updated_at on public.materiel_items;
create trigger materiel_items_updated_at
  before update on public.materiel_items
  for each row execute function public.materiel_items_set_updated_at();

-- Private bucket for item photos: one folder per user (<user_id>/<item_id>/<file>), enforced below.
insert into storage.buckets (id, name, public)
values ('materiel-photos', 'materiel-photos', false)
on conflict (id) do nothing;

drop policy if exists "own materiel photos only" on storage.objects;
create policy "own materiel photos only" on storage.objects
  for all
  using (
    bucket_id = 'materiel-photos'
    and lower(auth.email()) = ANY (ARRAY['studio-materiel@inventaire.local'])
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'materiel-photos'
    and lower(auth.email()) = ANY (ARRAY['studio-materiel@inventaire.local'])
    and (storage.foldername(name))[1] = auth.uid()::text
  );
