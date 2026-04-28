-- Migration: lock down direct reads of demo credential tables
-- Date: 2026-04-28
-- Purpose:
--   The public /api/admin/demo/lookup route already uses the service-role
--   client to return only the demo data required for a known slug. Direct
--   anonymous SELECT policies on demo_accounts and demo_team_logins expose all
--   demo slugs and demo passwords through the anon key, so remove them.
--
-- Data safety:
--   This migration does not delete, update, or insert any rows. It only removes
--   permissive SELECT policies.

drop policy if exists "demo_accounts_select"
  on public.demo_accounts;

drop policy if exists "demo_team_logins_select"
  on public.demo_team_logins;

notify pgrst, 'reload schema';
