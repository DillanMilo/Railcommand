-- Migration: create demo_accounts table
-- Date: 2026-04-15
-- Purpose: Enterprise demo account system for prospect demonstrations

-- 1. Table Definition ---------------------------------------------------
create table if not exists public.demo_accounts (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,          -- e.g. 'up', 'tva', 'team'
  company_name    text not null,                 -- e.g. 'Union Pacific'
  description     text not null default '',       -- internal notes
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete cascade,
  demo_user_id    uuid references public.profiles(id), -- primary PM login
  is_active       boolean not null default true,
  is_team_demo    boolean not null default false, -- multi-user team demo
  demo_password   text not null,                 -- hashed or plaintext for auto-login
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,                   -- optional expiration
  last_accessed_at timestamptz,
  access_count    integer not null default 0
);

-- 2. Demo team members (for multi-user team demos) ----------------------
create table if not exists public.demo_team_logins (
  id              uuid primary key default gen_random_uuid(),
  demo_account_id uuid not null references public.demo_accounts(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  email           text not null,
  display_name    text not null,
  project_role    text not null,
  demo_password   text not null,
  created_at      timestamptz not null default now()
);

-- 3. Indexes ------------------------------------------------------------
create index if not exists demo_accounts_slug_idx on public.demo_accounts(slug);
create index if not exists demo_accounts_active_idx on public.demo_accounts(is_active);
create index if not exists demo_team_logins_account_idx on public.demo_team_logins(demo_account_id);
create index if not exists demo_team_logins_email_idx on public.demo_team_logins(email);

-- 4. Row-Level Security -------------------------------------------------
alter table public.demo_accounts enable row level security;
alter table public.demo_team_logins enable row level security;

-- Demo accounts are readable by anyone (needed for /demo/[slug] lookup)
-- but only admins can modify them (enforced at application level via service role)
create policy "demo_accounts_select"
  on public.demo_accounts for select
  using (true);

create policy "demo_team_logins_select"
  on public.demo_team_logins for select
  using (true);

-- Only service role can insert/update/delete (no anon/authenticated insert)
-- All mutations go through the admin API using the service-role client

-- 5. Schema Notification ------------------------------------------------
notify pgrst, 'reload schema';
