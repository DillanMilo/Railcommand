-- =============================================================================
-- Migration: Supabase security advisor hardening
-- Date:      2026-06-24
--
-- PURPOSE:
--   Tighten exposed RPC/storage/API surfaces flagged by Supabase's security
--   advisor without deleting or modifying application data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers: only answer questions about the current caller.
-- These helpers are still usable by RLS policies, but anonymous clients cannot
-- call them as metadata oracles with arbitrary UUIDs.
-- ---------------------------------------------------------------------------

create or replace function public.is_project_member(
  p_project_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when p_project_id is null or p_profile_id is null then false
    when coalesce(auth.role(), 'anon') <> 'service_role'
      and p_profile_id <> auth.uid() then false
    else exists (
      select 1
      from public.project_members
      where project_id = p_project_id
        and profile_id = p_profile_id
    )
  end;
$$;

create or replace function public.can_manage_project(
  p_project_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when p_project_id is null or p_profile_id is null then false
    when coalesce(auth.role(), 'anon') <> 'service_role'
      and p_profile_id <> auth.uid() then false
    else exists (
      select 1
      from public.project_members
      where project_id = p_project_id
        and profile_id = p_profile_id
        and can_edit = true
    )
  end;
$$;

create or replace function public.is_admin(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when p_profile_id is null then false
    when coalesce(auth.role(), 'anon') <> 'service_role'
      and p_profile_id <> auth.uid() then false
    else exists (
      select 1
      from public.profiles
      where id = p_profile_id
        and role = 'admin'
    )
  end;
$$;

create or replace function public.has_pending_invitation(
  p_project_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when p_project_id is null or p_profile_id is null then false
    when coalesce(auth.role(), 'anon') <> 'service_role'
      and p_profile_id <> auth.uid() then false
    else exists (
      select 1
      from public.project_invitations pi
      join public.profiles p on p.email = pi.email
      where pi.project_id = p_project_id
        and p.id = p_profile_id
        and pi.status = 'pending'
        and pi.expires_at > now()
    )
  end;
$$;

create or replace function public.shares_project_with(
  p_other_profile_id uuid,
  p_current_profile_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when p_other_profile_id is null or p_current_profile_id is null then false
    when coalesce(auth.role(), 'anon') <> 'service_role'
      and p_current_profile_id <> auth.uid() then false
    else exists (
      select 1
      from public.project_members pm1
      join public.project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.profile_id = p_other_profile_id
        and pm2.profile_id = p_current_profile_id
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Activity logging RPC: clients may only write activity as themselves and only
-- for projects they belong to. Service role remains allowed for server-side
-- maintenance/demo tooling.
-- ---------------------------------------------------------------------------

create or replace function public.log_activity(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_performed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(auth.role(), 'anon');
begin
  if v_role <> 'service_role' then
    if v_actor is null or p_performed_by is distinct from v_actor then
      raise exception 'not allowed to log activity for another user'
        using errcode = '42501';
    end if;

    if not public.is_project_member(p_project_id, v_actor)
      and not public.is_admin(v_actor) then
      raise exception 'not allowed to log activity for this project'
        using errcode = '42501';
    end if;
  end if;

  insert into public.activity_log (
    project_id,
    entity_type,
    entity_id,
    action,
    description,
    performed_by
  ) values (
    p_project_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_description,
    p_performed_by
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC execution grants.
-- PUBLIC includes anon/authenticated by default, so revoke broadly first.
-- Grant back only the RPCs that the signed-in application flow needs.
-- ---------------------------------------------------------------------------

revoke execute on function public.can_manage_project(uuid, uuid) from public;
revoke execute on function public.create_project(text, text, text, text, date, date, numeric) from public;
revoke execute on function public.get_my_project_ids() from public;
revoke execute on function public.global_search(text, uuid[], integer) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.has_pending_invitation(uuid, uuid) from public;
revoke execute on function public.is_admin(uuid) from public;
revoke execute on function public.is_project_member(uuid, uuid) from public;
revoke execute on function public.log_activity(uuid, text, uuid, text, text, uuid) from public;
revoke execute on function public.log_daily_log_activity() from public;
revoke execute on function public.log_milestone_activity() from public;
revoke execute on function public.log_project_status_change() from public;
revoke execute on function public.log_punch_list_activity() from public;
revoke execute on function public.log_rfi_activity() from public;
revoke execute on function public.log_rfi_response_activity() from public;
revoke execute on function public.log_submittal_activity() from public;
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.setup_organization(text, text) from public;
revoke execute on function public.shares_project_with(uuid, uuid) from public;
revoke execute on function public.update_conversation_timestamp() from public;

grant execute on function public.can_manage_project(uuid, uuid) to authenticated;
grant execute on function public.create_project(text, text, text, text, date, date, numeric) to authenticated;
grant execute on function public.get_my_project_ids() to authenticated;
grant execute on function public.global_search(text, uuid[], integer) to authenticated;
grant execute on function public.has_pending_invitation(uuid, uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.log_activity(uuid, text, uuid, text, text, uuid) to authenticated;
grant execute on function public.setup_organization(text, text) to authenticated;
grant execute on function public.shares_project_with(uuid, uuid) to authenticated;

-- Trigger/internal functions should not be directly callable from the API.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.log_daily_log_activity() from anon, authenticated;
revoke execute on function public.log_milestone_activity() from anon, authenticated;
revoke execute on function public.log_project_status_change() from anon, authenticated;
revoke execute on function public.log_punch_list_activity() from anon, authenticated;
revoke execute on function public.log_rfi_activity() from anon, authenticated;
revoke execute on function public.log_rfi_response_activity() from anon, authenticated;
revoke execute on function public.log_submittal_activity() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke execute on function public.update_conversation_timestamp() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Other Supabase security advisor hardening items.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.update_conversation_timestamp()') is not null then
    alter function public.update_conversation_timestamp()
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.update_updated_at()') is not null then
    alter function public.update_updated_at()
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.assign_entity_number()') is not null then
    alter function public.assign_entity_number()
      set search_path = public, pg_temp;
  end if;
end $$;

-- Organization creation should go through setup_organization(), which performs
-- the atomic profile/org linkage. Avoid direct broad INSERT access.
drop policy if exists "Authenticated users can create organizations"
  on public.organizations;

-- Keep search_index available to owner-backed RPCs but not directly selectable
-- through the Data API.
revoke select on table public.search_index from anon, authenticated;

-- Public avatar URLs still work for public buckets without a broad list policy.
drop policy if exists "Avatar images are publicly accessible"
  on storage.objects;
drop policy if exists "Avatars are readable by authenticated users"
  on storage.objects;
drop policy if exists "Avatars are readable by everyone"
  on storage.objects;

notify pgrst, 'reload schema';
