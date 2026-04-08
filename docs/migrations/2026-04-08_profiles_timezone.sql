-- =========================================================================
-- 2026-04-08 — Add time_zone column to profiles
-- -------------------------------------------------------------------------
-- Adds a per-user IANA timezone identifier so the Settings page can let
-- users pick the zone used to render dates/times across the app.
--
-- HOW TO APPLY:
--   1. Open the Supabase Dashboard for the RailCommand project
--   2. Navigate to: SQL Editor → New query
--   3. Paste the statements below and click "Run"
--   4. Reload the Settings page to see the new Time Zone selector
--
-- The final NOTIFY tells PostgREST to reload its schema cache so the new
-- column is visible to the API immediately (no server restart required).
-- =========================================================================

alter table public.profiles
  add column if not exists time_zone text;

comment on column public.profiles.time_zone is
  'IANA timezone identifier (e.g., America/New_York). Used to render dates/times in the user''s local zone.';

notify pgrst, 'reload schema';
