-- Retours: private purchase/return tracker, one separate space per account.
--
-- Security model: rather than relying on public sign-up being disabled in the dashboard
-- (a setting that moves around between Supabase versions and is easy to lose track of),
-- every policy below checks the session's email against a hardcoded allow-list AND that the
-- row belongs to that same session (user_id = auth.uid()). Anyone else who manages to create
-- an account is still authenticated but matches neither email, so every policy denies them —
-- and each of the two legitimate accounts only ever sees its own rows, never the other's.
--
-- This is a reference copy for version control only — replace REPLACE_WITH_EMAIL_1 and
-- REPLACE_WITH_EMAIL_2 with the two real account emails before running it, and run that
-- filled-in version directly in the Supabase SQL Editor. Don't commit the real emails here;
-- this repo is public.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default '',
  store text not null default '',
  purchase_date date not null,
  deadline date not null,
  alert_d7_sent boolean not null default false,
  alert_d2_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  name text not null,
  icon text not null default 'other',
  refunded boolean not null default false,
  refunded_at timestamptz
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;
alter table public.items enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "authenticated full access" on public.purchases;
drop policy if exists "household accounts only" on public.purchases;
drop policy if exists "own purchases only" on public.purchases;
create policy "own purchases only" on public.purchases
  for all
  using (
    auth.email() = ANY (ARRAY['REPLACE_WITH_EMAIL_1', 'REPLACE_WITH_EMAIL_2'])
    and user_id = auth.uid()
  )
  with check (
    auth.email() = ANY (ARRAY['REPLACE_WITH_EMAIL_1', 'REPLACE_WITH_EMAIL_2'])
    and user_id = auth.uid()
  );

drop policy if exists "authenticated full access" on public.items;
drop policy if exists "household accounts only" on public.items;
drop policy if exists "own items only" on public.items;
create policy "own items only" on public.items
  for all
  using (
    auth.email() = ANY (ARRAY['REPLACE_WITH_EMAIL_1', 'REPLACE_WITH_EMAIL_2'])
    and exists (
      select 1 from public.purchases p
      where p.id = items.purchase_id and p.user_id = auth.uid()
    )
  )
  with check (
    auth.email() = ANY (ARRAY['REPLACE_WITH_EMAIL_1', 'REPLACE_WITH_EMAIL_2'])
    and exists (
      select 1 from public.purchases p
      where p.id = items.purchase_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated full access" on public.push_subscriptions;
drop policy if exists "household accounts only" on public.push_subscriptions;
drop policy if exists "own subscriptions only" on public.push_subscriptions;
create policy "own subscriptions only" on public.push_subscriptions
  for all
  using (
    auth.email() = ANY (ARRAY['REPLACE_WITH_EMAIL_1', 'REPLACE_WITH_EMAIL_2'])
    and user_id = auth.uid()
  )
  with check (
    auth.email() = ANY (ARRAY['REPLACE_WITH_EMAIL_1', 'REPLACE_WITH_EMAIL_2'])
    and user_id = auth.uid()
  );

create index if not exists items_purchase_id_idx on public.items(purchase_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
