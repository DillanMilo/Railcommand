-- Additive, profile-scoped in-app notifications.
-- This migration does not alter or backfill any existing application data.

begin;

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type text not null check (type in (
    'submittal_status_changed',
    'rfi_assigned',
    'rfi_response_received',
    'punch_list_assigned',
    'punch_list_status_changed',
    'overdue_reminder',
    'team_update'
  )),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 2000),
  href text check (href is null or (left(href, 1) = '/' and left(href, 2) <> '//')),
  entity_type text,
  entity_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);

create index user_notifications_recipient_created_idx
  on public.user_notifications (recipient_id, created_at desc)
  where dismissed_at is null;

alter table public.user_notifications enable row level security;

revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at, dismissed_at) on public.user_notifications to authenticated;
grant all on public.user_notifications to service_role;

create policy "Users can view own notifications"
  on public.user_notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "Users can update own notification state"
  on public.user_notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

comment on table public.user_notifications is
  'Profile-scoped in-app alerts. Inserts are service-only; recipients may only read and update read/dismissed state.';

commit;
