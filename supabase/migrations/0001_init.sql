-- Retours: shared purchase/return tracker for two trusted household accounts.
--
-- Security model: public sign-up must be disabled in Authentication settings, and only the
-- two accounts created by hand in the dashboard should ever exist. Because of that, every
-- policy below simply checks "is this a logged-in user" (auth.role() = 'authenticated')
-- rather than scoping rows to auth.uid() — both accounts are meant to see the shared list.

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
create policy "authenticated full access" on public.purchases
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on public.items;
create policy "authenticated full access" on public.items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on public.push_subscriptions;
create policy "authenticated full access" on public.push_subscriptions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists items_purchase_id_idx on public.items(purchase_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
