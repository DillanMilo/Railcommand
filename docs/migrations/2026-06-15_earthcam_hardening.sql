-- =============================================================================
-- Migration: EarthCam enterprise hardening
-- Date:      2026-06-15
--
-- PURPOSE: Add server-only credential storage metadata, optional API sync
--          configuration, and activity-log support for EarthCam events.
--
-- NOTES:
--   * API keys and signing secrets are stored encrypted by the app before insert.
--   * The app must use server actions/admin client for sensitive columns.
--   * Re-runnable after the base EarthCam integration migration.
-- =============================================================================

-- 1. Secure connection metadata ----------------------------------------------
alter table public.earthcam_connections
  add column if not exists api_base_url text,
  add column if not exists api_key_encrypted text,
  add column if not exists api_key_iv text,
  add column if not exists api_key_tag text,
  add column if not exists embed_signing_secret_encrypted text,
  add column if not exists embed_signing_secret_iv text,
  add column if not exists embed_signing_secret_tag text,
  add column if not exists credentials_updated_at timestamptz,
  add column if not exists sync_error text;

comment on column public.earthcam_connections.api_base_url is
  'Optional EarthCam/partner API base URL used by server-side camera sync.';
comment on column public.earthcam_connections.api_key_encrypted is
  'Encrypted EarthCam API key ciphertext. Never select into client payloads.';
comment on column public.earthcam_connections.embed_signing_secret_encrypted is
  'Encrypted signing secret for vendor-supported secure embeds. Never select into client payloads.';

-- 2. Activity log support -----------------------------------------------------
do $$
begin
  if to_regclass('public.activity_log') is not null then
    alter table public.activity_log
      drop constraint if exists activity_log_entity_type_check;

    alter table public.activity_log
      add constraint activity_log_entity_type_check
      check (entity_type in (
        'submittal',
        'rfi',
        'daily_log',
        'punch_list',
        'milestone',
        'project',
        'earthcam_connection',
        'earthcam_camera',
        'earthcam_evidence'
      ));

    alter table public.activity_log
      drop constraint if exists activity_log_action_check;

    alter table public.activity_log
      add constraint activity_log_action_check
      check (action in (
        'created',
        'updated',
        'status_changed',
        'commented',
        'approved',
        'rejected',
        'submitted',
        'assigned',
        'deleted'
      ));
  end if;
end $$;

notify pgrst, 'reload schema';
