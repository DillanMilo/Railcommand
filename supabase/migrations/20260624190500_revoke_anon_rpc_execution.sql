-- =============================================================================
-- Migration: Revoke anonymous execution from app RPCs
-- Date:      2026-06-24
--
-- PURPOSE:
--   Remove explicit anon EXECUTE grants that keep SECURITY DEFINER functions
--   callable through /rest/v1/rpc before a user signs in.
-- =============================================================================

revoke execute on function public.can_manage_project(uuid, uuid) from anon;
revoke execute on function public.create_project(text, text, text, text, date, date, numeric) from anon;
revoke execute on function public.get_my_project_ids() from anon;
revoke execute on function public.global_search(text, uuid[], integer) from anon;
revoke execute on function public.has_pending_invitation(uuid, uuid) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.is_project_member(uuid, uuid) from anon;
revoke execute on function public.log_activity(uuid, text, uuid, text, text, uuid) from anon;
revoke execute on function public.setup_organization(text, text) from anon;
revoke execute on function public.shares_project_with(uuid, uuid) from anon;

notify pgrst, 'reload schema';
