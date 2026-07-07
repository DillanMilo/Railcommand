create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'unknown',
  recipient_email text,
  recipient_count integer not null default 1,
  subject text,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint email_events_recipient_count_check check (recipient_count > 0),
  constraint email_events_status_check check (status in ('sent', 'failed', 'suppressed', 'skipped'))
);

create index if not exists email_events_created_at_idx
  on public.email_events (created_at desc);

create index if not exists email_events_status_created_at_idx
  on public.email_events (status, created_at desc);

create index if not exists email_events_type_created_at_idx
  on public.email_events (type, created_at desc);

alter table public.email_events enable row level security;

revoke all on table public.email_events from anon, authenticated;
grant all on table public.email_events to service_role;
