-- =============================================================================
-- Migration: Allow team members to see each other's profiles
-- Date: 2026-04-16
-- Purpose: The Team page queries project_members JOIN profiles, but the
--          profiles RLS policy only allows users to see their own profile.
--          This results in empty Team pages because the profile JOIN fails.
--
-- Fix: Allow users to read profiles of fellow project members (via the
--      is_project_member helper function — no recursion).
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run — uses DROP POLICY IF EXISTS.
-- =============================================================================

-- Helper: check if two users share at least one project ──────────────────
CREATE OR REPLACE FUNCTION public.shares_project_with(p_other_profile_id uuid, p_current_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.profile_id = p_other_profile_id
      AND pm2.profile_id = p_current_profile_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.shares_project_with(uuid, uuid) TO authenticated;

-- Drop existing profiles SELECT policies ──────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

-- New SELECT policy: own profile, admins, or fellow project members ──────
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.shares_project_with(id, auth.uid())
  );

-- Reload PostgREST ────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
