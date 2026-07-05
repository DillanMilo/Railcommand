


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."assign_entity_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _prefix TEXT;
  _type   TEXT;
  _next   INT;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'submittals'       THEN _prefix := 'SUB'; _type := 'submittal';
    WHEN 'rfis'             THEN _prefix := 'RFI'; _type := 'rfi';
    WHEN 'punch_list_items' THEN _prefix := 'PL';  _type := 'punch_list';
    ELSE RAISE EXCEPTION 'assign_entity_number: unsupported table %', TG_TABLE_NAME;
  END CASE;

  INSERT INTO public.entity_number_sequences (project_id, entity_type, current_value)
  VALUES (NEW.project_id, _type, 1)
  ON CONFLICT (project_id, entity_type)
  DO UPDATE SET current_value = public.entity_number_sequences.current_value + 1
  RETURNING current_value INTO _next;

  NEW.number := _prefix || '-' || LPAD(_next::TEXT, 3, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_entity_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_project"("p_project_id" "uuid", "p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."can_manage_project"("p_project_id" "uuid", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_project"("p_name" "text", "p_description" "text" DEFAULT ''::"text", "p_location" "text" DEFAULT ''::"text", "p_client" "text" DEFAULT ''::"text", "p_start_date" "date" DEFAULT CURRENT_DATE, "p_target_end_date" "date" DEFAULT CURRENT_DATE, "p_budget_total" numeric DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_project projects%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO projects (
    name, description, location, client,
    start_date, target_end_date, budget_total,
    budget_spent, status, created_by
  ) VALUES (
    p_name, p_description, p_location, p_client,
    p_start_date, p_target_end_date, p_budget_total,
    0, 'active', v_user_id
  )
  RETURNING * INTO v_project;

  INSERT INTO project_members (project_id, profile_id, project_role, can_edit)
  VALUES (v_project.id, v_user_id, 'manager', true)
  ON CONFLICT DO NOTHING;

  RETURN row_to_json(v_project);
END;
$$;


ALTER FUNCTION "public"."create_project"("p_name" "text", "p_description" "text", "p_location" "text", "p_client" "text", "p_start_date" "date", "p_target_end_date" "date", "p_budget_total" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_project_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT project_id FROM project_members WHERE profile_id = auth.uid() $$;


ALTER FUNCTION "public"."get_my_project_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."global_search"("search_query" "text", "project_ids" "uuid"[], "result_limit" integer DEFAULT 10) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  tsquery_val tsquery;
  result JSON;
  calling_user_id UUID;
  authorized_project_ids UUID[];
BEGIN
  calling_user_id := auth.uid();
  
  SELECT array_agg(pm.project_id) INTO authorized_project_ids
  FROM project_members pm
  WHERE pm.profile_id = calling_user_id
    AND pm.project_id = ANY(project_ids);
  
  IF authorized_project_ids IS NULL THEN
    RETURN json_build_object(
      'submittals', '[]'::json,
      'rfis', '[]'::json,
      'punch_list', '[]'::json,
      'daily_logs', '[]'::json,
      'milestones', '[]'::json,
      'matched_profiles', '[]'::json
    );
  END IF;

  tsquery_val := plainto_tsquery('english', search_query);

  SELECT json_build_object(
    'submittals', (
      SELECT coalesce(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT id, project_id, number, title, spec_section, status, submitted_by,
               ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(spec_section,'') || ' ' || coalesce(number,'')), tsquery_val) as rank
        FROM submittals
        WHERE project_id = ANY(authorized_project_ids)
          AND (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(spec_section,'') || ' ' || coalesce(number,'')) @@ tsquery_val
               OR title ILIKE '%' || search_query || '%'
               OR number ILIKE '%' || search_query || '%')
        ORDER BY rank DESC
        LIMIT result_limit
      ) s
    ),
    'rfis', (
      SELECT coalesce(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT id, project_id, number, subject, status, assigned_to,
               ts_rank(to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(question,'') || ' ' || coalesce(answer,'') || ' ' || coalesce(number,'')), tsquery_val) as rank
        FROM rfis
        WHERE project_id = ANY(authorized_project_ids)
          AND (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(question,'') || ' ' || coalesce(answer,'') || ' ' || coalesce(number,'')) @@ tsquery_val
               OR subject ILIKE '%' || search_query || '%'
               OR number ILIKE '%' || search_query || '%')
        ORDER BY rank DESC
        LIMIT result_limit
      ) r
    ),
    'punch_list', (
      SELECT coalesce(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT id, project_id, number, title, location, description, status, assigned_to,
               ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'') || ' ' || coalesce(number,'') || ' ' || coalesce(resolution_notes,'')), tsquery_val) as rank
        FROM punch_list_items
        WHERE project_id = ANY(authorized_project_ids)
          AND (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'') || ' ' || coalesce(number,'') || ' ' || coalesce(resolution_notes,'')) @@ tsquery_val
               OR title ILIKE '%' || search_query || '%'
               OR number ILIKE '%' || search_query || '%')
        ORDER BY rank DESC
        LIMIT result_limit
      ) p
    ),
    'daily_logs', (
      SELECT coalesce(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT id, project_id, log_date, work_summary, created_by,
               ts_rank(to_tsvector('english', coalesce(work_summary,'') || ' ' || coalesce(safety_notes,'')), tsquery_val) as rank
        FROM daily_logs
        WHERE project_id = ANY(authorized_project_ids)
          AND (to_tsvector('english', coalesce(work_summary,'') || ' ' || coalesce(safety_notes,'')) @@ tsquery_val
               OR work_summary ILIKE '%' || search_query || '%'
               OR log_date::text ILIKE '%' || search_query || '%')
        ORDER BY rank DESC
        LIMIT result_limit
      ) d
    ),
    'milestones', (
      SELECT coalesce(json_agg(row_to_json(m)), '[]'::json)
      FROM (
        SELECT id, project_id, name, status,
               ts_rank(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')), tsquery_val) as rank
        FROM milestones
        WHERE project_id = ANY(authorized_project_ids)
          AND (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')) @@ tsquery_val
               OR name ILIKE '%' || search_query || '%')
        ORDER BY rank DESC
        LIMIT result_limit
      ) m
    ),
    'matched_profiles', (
      SELECT coalesce(json_agg(row_to_json(pr)), '[]'::json)
      FROM (
        SELECT id, full_name
        FROM profiles
        WHERE full_name ILIKE '%' || search_query || '%'
        LIMIT 20
      ) pr
    )
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."global_search"("search_query" "text", "project_ids" "uuid"[], "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
                                                     BEGIN
                                                       INSERT INTO public.profiles (id, email, full_name, avatar_url)
                                                         VALUES (
                                                             NEW.id,
                                                                 NEW.email,
                                                                     COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
                                                                         COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
                                                                           );

                                                                             INSERT INTO public.user_preferences (user_id)
                                                                               VALUES (NEW.id);

                                                                                 RETURN NEW;
                                                                                 END;
                                                                                 $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_pending_invitation"("p_project_id" "uuid", "p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."has_pending_invitation"("p_project_id" "uuid", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."is_admin"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"("p_project_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_description" "text", "p_performed_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."log_activity"("p_project_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_description" "text", "p_performed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_daily_log_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
  VALUES (
    NEW.project_id, 'daily_log', NEW.id, 'created',
    'Daily log created for ' || TO_CHAR(NEW.log_date, 'Mon DD, YYYY'),
    auth.uid()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_daily_log_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_milestone_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'milestone', NEW.id, 'created',
      'New milestone created: ' || NEW.name,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'milestone', NEW.id, 'status_changed',
      'Milestone "' || NEW.name || '" status changed to ' || REPLACE(NEW.status, '_', ' '),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_milestone_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_project_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.id, 'project', NEW.id, 'status_changed',
      'Project "' || NEW.name || '" status changed to ' || REPLACE(NEW.status, '_', ' '),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_project_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_punch_list_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'punch_list', NEW.id, 'created',
      'New punch list item created: ' || NEW.number || ' - ' || NEW.title,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'punch_list', NEW.id, 'status_changed',
      'Punch list item ' || NEW.number || ' status changed to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_punch_list_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_rfi_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'rfi', NEW.id, 'created',
      'New RFI created: ' || NEW.number || ' - ' || NEW.subject,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'rfi', NEW.id, 'status_changed',
      'RFI ' || NEW.number || ' status changed to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_rfi_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_rfi_response_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_project_id UUID;
  v_rfi_number TEXT;
BEGIN
  SELECT project_id, number INTO v_project_id, v_rfi_number
  FROM public.rfis WHERE id = NEW.rfi_id;

  INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
  VALUES (
    v_project_id, 'rfi', NEW.rfi_id, 'commented',
    'New response added to RFI ' || v_rfi_number,
    auth.uid()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_rfi_response_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_submittal_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'submittal', NEW.id, 'created',
      'New submittal created: ' || NEW.number || ' - ' || NEW.title,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id, 'submittal', NEW.id, 'status_changed',
      'Submittal ' || NEW.number || ' status changed to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_submittal_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_organization"("org_name" "text", "org_type" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE new_org public.organizations; BEGIN INSERT INTO public.organizations (name, type, tier) VALUES (org_name, org_type, 'free') RETURNING * INTO new_org; UPDATE public.profiles SET organization_id = new_org.id WHERE id = auth.uid(); RETURN row_to_json(new_org); END; $$;


ALTER FUNCTION "public"."setup_organization"("org_name" "text", "org_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shares_project_with"("p_other_profile_id" "uuid", "p_current_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."shares_project_with"("p_other_profile_id" "uuid", "p_current_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now(),
      message_count = message_count + 1
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
    RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_log_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'status_changed'::"text", 'commented'::"text", 'approved'::"text", 'rejected'::"text", 'submitted'::"text", 'assigned'::"text", 'deleted'::"text"]))),
    CONSTRAINT "activity_log_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['submittal'::"text", 'rfi'::"text", 'daily_log'::"text", 'punch_list'::"text", 'milestone'::"text", 'project'::"text", 'earthcam_connection'::"text", 'earthcam_camera'::"text", 'earthcam_evidence'::"text"])))
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "photo_category" "text" DEFAULT 'standard'::"text" NOT NULL,
    "uploaded_by" "uuid",
    "geo_lat" double precision,
    "geo_lng" double precision,
    "captured_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid",
    CONSTRAINT "attachments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['submittal'::"text", 'rfi'::"text", 'daily_log'::"text", 'punch_list'::"text", 'safety_incident'::"text", 'project_photo'::"text", 'project_document'::"text"]))),
    CONSTRAINT "attachments_photo_category_check" CHECK (("photo_category" = ANY (ARRAY['standard'::"text", 'thermal'::"text", 'document'::"text"])))
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."change_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "submitted_by" "uuid",
    "approved_by" "uuid",
    "linked_milestone_id" "uuid",
    "submit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "approval_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "change_orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."change_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'New Conversation'::"text" NOT NULL,
    "model" "text" DEFAULT 'gpt-4.1-mini'::"text" NOT NULL,
    "message_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_log_equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "daily_log_id" "uuid" NOT NULL,
    "equipment_type" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "daily_log_equipment_count_check" CHECK (("count" >= 0))
);


ALTER TABLE "public"."daily_log_equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_log_personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "daily_log_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "headcount" integer DEFAULT 0 NOT NULL,
    "company" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "daily_log_personnel_headcount_check" CHECK (("headcount" >= 0))
);


ALTER TABLE "public"."daily_log_personnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_log_work_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "daily_log_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "unit" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."daily_log_work_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "created_by" "uuid",
    "weather_temp" numeric(5,1) DEFAULT 0 NOT NULL,
    "weather_conditions" "text" DEFAULT ''::"text" NOT NULL,
    "weather_wind" "text" DEFAULT ''::"text" NOT NULL,
    "work_summary" "text" DEFAULT ''::"text" NOT NULL,
    "safety_notes" "text" DEFAULT ''::"text" NOT NULL,
    "geo_tag" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "organization_id" "uuid",
    "project_id" "uuid",
    "demo_user_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_team_demo" boolean DEFAULT false NOT NULL,
    "demo_password" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "last_accessed_at" timestamp with time zone,
    "access_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."demo_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_team_logins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "demo_account_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "project_role" "text" NOT NULL,
    "demo_password" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."demo_team_logins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."earthcam_cameras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "earthcam_camera_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "location_label" "text" DEFAULT ''::"text" NOT NULL,
    "rail_area" "text" DEFAULT ''::"text" NOT NULL,
    "live_embed_url" "text" DEFAULT ''::"text" NOT NULL,
    "live_stream_url" "text" DEFAULT ''::"text" NOT NULL,
    "thumbnail_url" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'online'::"text" NOT NULL,
    "ptz_enabled" boolean DEFAULT false NOT NULL,
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "earthcam_cameras_status_check" CHECK (("status" = ANY (ARRAY['online'::"text", 'offline'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."earthcam_cameras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."earthcam_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "account_name" "text" DEFAULT 'EarthCam'::"text" NOT NULL,
    "status" "text" DEFAULT 'needs_auth'::"text" NOT NULL,
    "auth_mode" "text" DEFAULT 'api_key'::"text" NOT NULL,
    "api_key_last4" "text",
    "connected_by" "uuid",
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "api_base_url" "text",
    "api_key_encrypted" "text",
    "api_key_iv" "text",
    "api_key_tag" "text",
    "embed_signing_secret_encrypted" "text",
    "embed_signing_secret_iv" "text",
    "embed_signing_secret_tag" "text",
    "credentials_updated_at" timestamp with time zone,
    "sync_error" "text",
    CONSTRAINT "earthcam_connections_auth_mode_check" CHECK (("auth_mode" = ANY (ARRAY['api_key'::"text", 'oauth'::"text", 'service_account'::"text"]))),
    CONSTRAINT "earthcam_connections_status_check" CHECK (("status" = ANY (ARRAY['connected'::"text", 'needs_auth'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."earthcam_connections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."earthcam_connections"."api_base_url" IS 'Optional EarthCam/partner API base URL used by server-side camera sync.';



COMMENT ON COLUMN "public"."earthcam_connections"."api_key_encrypted" IS 'Encrypted EarthCam API key ciphertext. Never select into client payloads.';



COMMENT ON COLUMN "public"."earthcam_connections"."embed_signing_secret_encrypted" IS 'Encrypted signing secret for vendor-supported secure embeds. Never select into client payloads.';



CREATE TABLE IF NOT EXISTS "public"."earthcam_embeds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "label" "text" DEFAULT 'EarthCam Feed'::"text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "earthcam_embeds_share_url_check" CHECK (("url" ~ '^https://share\.earthcam\.net(/|$)'::"text"))
);


ALTER TABLE "public"."earthcam_embeds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."earthcam_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "camera_id" "uuid" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "earthcam_asset_id" "text",
    "earthcam_url" "text" DEFAULT ''::"text" NOT NULL,
    "thumbnail_url" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "earthcam_evidence_evidence_type_check" CHECK (("evidence_type" = ANY (ARRAY['snapshot'::"text", 'clip'::"text"])))
);


ALTER TABLE "public"."earthcam_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_number_sequences" (
    "project_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "entity_number_sequences_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['submittal'::"text", 'rfi'::"text", 'punch_list'::"text"])))
);


ALTER TABLE "public"."entity_number_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "tool_calls" "jsonb",
    "tool_call_id" "text",
    "model" "text",
    "tokens_used" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text", 'tool'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestone_rfis" (
    "milestone_id" "uuid" NOT NULL,
    "rfi_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."milestone_rfis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestone_submittals" (
    "milestone_id" "uuid" NOT NULL,
    "submittal_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."milestone_submittals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "target_date" "date" NOT NULL,
    "actual_date" "date",
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "percent_complete" numeric(5,2) DEFAULT 0 NOT NULL,
    "budget_planned" numeric(14,2) DEFAULT 0 NOT NULL,
    "budget_actual" numeric(14,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "milestones_percent_complete_check" CHECK ((("percent_complete" >= (0)::numeric) AND ("percent_complete" <= (100)::numeric))),
    CONSTRAINT "milestones_status_check" CHECK (("status" = ANY (ARRAY['on_track'::"text", 'at_risk'::"text", 'behind'::"text", 'complete'::"text", 'not_started'::"text"])))
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "modification_type" "text" DEFAULT 'plan_revision'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "revision_number" "text" DEFAULT ''::"text" NOT NULL,
    "affected_documents" "text" DEFAULT ''::"text" NOT NULL,
    "issued_by" "uuid",
    "issued_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_date" "date",
    "acknowledged_by" "uuid",
    "acknowledged_date" "date",
    "linked_milestone_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "modifications_modification_type_check" CHECK (("modification_type" = ANY (ARRAY['plan_revision'::"text", 'spec_amendment'::"text", 'contract_amendment'::"text", 'design_change'::"text", 'scope_change'::"text"]))),
    CONSTRAINT "modifications_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'acknowledged'::"text", 'implemented'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."modifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'contractor'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    CONSTRAINT "organizations_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "organizations_type_check" CHECK (("type" = ANY (ARRAY['contractor'::"text", 'engineer'::"text", 'owner'::"text", 'inspector'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "organization_id" "uuid",
    "avatar_url" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_preferences" "jsonb" DEFAULT '{"rfi_assigned": true, "punch_list_assigned": true, "rfi_response_received": true, "submittal_status_changed": true, "punch_list_status_changed": true}'::"jsonb",
    "time_zone" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."time_zone" IS 'IANA timezone identifier (e.g., America/New_York). Used to render dates/times in the user''s local zone.';



CREATE TABLE IF NOT EXISTS "public"."project_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "revision" "text" DEFAULT 'Rev 0'::"text" NOT NULL,
    "revision_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "file_name" "text" DEFAULT ''::"text" NOT NULL,
    "file_url" "text" DEFAULT ''::"text" NOT NULL,
    "file_size" bigint DEFAULT 0 NOT NULL,
    "uploaded_by" "uuid",
    "reviewed_by" "uuid",
    "review_date" "date",
    "linked_milestone_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_documents_category_check" CHECK (("category" = ANY (ARRAY['drawing'::"text", 'specification'::"text", 'submittal'::"text", 'report'::"text", 'contract'::"text", 'correspondence'::"text", 'photo_log'::"text", 'other'::"text"]))),
    CONSTRAINT "project_documents_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'under_review'::"text", 'approved'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."project_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "project_role" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    CONSTRAINT "project_invitations_project_role_check" CHECK (("project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'foreman'::"text", 'engineer'::"text", 'contractor'::"text", 'inspector'::"text", 'owner'::"text", 'viewer'::"text"]))),
    CONSTRAINT "project_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."project_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "project_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_members_project_role_check" CHECK (("project_role" = ANY (ARRAY['engineer'::"text", 'contractor'::"text", 'owner'::"text", 'inspector'::"text", 'manager'::"text", 'superintendent'::"text", 'foreman'::"text"])))
);


ALTER TABLE "public"."project_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "target_end_date" "date" NOT NULL,
    "actual_end_date" "date",
    "budget_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "budget_spent" numeric(12,2) DEFAULT 0 NOT NULL,
    "location" "text" DEFAULT ''::"text",
    "client" "text" DEFAULT ''::"text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "turnover_date" "date",
    "substantial_completion_date" "date",
    "project_completion_date" "date",
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'on_hold'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."turnover_date" IS 'Date when the project is turned over to the owner/operator';



COMMENT ON COLUMN "public"."projects"."substantial_completion_date" IS 'Date when work is substantially complete (punch list items may remain)';



COMMENT ON COLUMN "public"."projects"."project_completion_date" IS 'Final completion date including all punch list close-outs';



CREATE TABLE IF NOT EXISTS "public"."punch_list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "geo_tag" "jsonb",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "assigned_to" "uuid" NOT NULL,
    "created_by" "uuid",
    "due_date" "date" NOT NULL,
    "resolved_date" "date",
    "verified_date" "date",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "punch_list_items_priority_check" CHECK (("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "punch_list_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'verified'::"text"])))
);


ALTER TABLE "public"."punch_list_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qcqa_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "report_type" "text" DEFAULT 'inspection'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "spec_reference" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "findings" "text" DEFAULT ''::"text" NOT NULL,
    "corrective_action" "text" DEFAULT ''::"text" NOT NULL,
    "is_nonconformance" boolean DEFAULT false NOT NULL,
    "severity" "text" DEFAULT 'minor'::"text" NOT NULL,
    "inspector" "uuid",
    "linked_punch_list_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "closed_by" "uuid",
    "closed_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "qcqa_reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['inspection'::"text", 'nonconformance'::"text", 'test'::"text", 'audit'::"text"]))),
    CONSTRAINT "qcqa_reports_severity_check" CHECK (("severity" = ANY (ARRAY['minor'::"text", 'major'::"text", 'critical'::"text"]))),
    CONSTRAINT "qcqa_reports_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'in_review'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."qcqa_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfi_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfi_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "is_official_response" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rfi_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "submitted_by" "uuid",
    "assigned_to" "uuid" NOT NULL,
    "submit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "response_date" "date",
    "milestone_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rfis_priority_check" CHECK (("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "rfis_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'answered'::"text", 'closed'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."rfis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."safety_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "reported_by" "uuid",
    "incident_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "incident_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "personnel_involved" "text" DEFAULT ''::"text" NOT NULL,
    "root_cause" "text" DEFAULT ''::"text" NOT NULL,
    "corrective_action" "text" DEFAULT ''::"text" NOT NULL,
    "daily_log_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "safety_incidents_incident_type_check" CHECK (("incident_type" = ANY (ARRAY['near_miss'::"text", 'first_aid'::"text", 'recordable'::"text", 'lost_time'::"text", 'observation'::"text", 'hazard'::"text"]))),
    CONSTRAINT "safety_incidents_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "safety_incidents_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."safety_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submittals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "spec_section" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "submitted_by" "uuid",
    "reviewed_by" "uuid",
    "submit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "review_date" "date",
    "review_notes" "text",
    "milestone_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "submittals_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'approved'::"text", 'conditional'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."submittals" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."search_index" AS
 SELECT "submittals"."id",
    'submittal'::"text" AS "module",
    "submittals"."project_id",
    (("submittals"."number" || ': '::"text") || "submittals"."title") AS "title",
    COALESCE("submittals"."spec_section", ''::"text") AS "subtitle",
    "submittals"."status",
    "submittals"."submitted_by" AS "assignee_id",
    "to_tsvector"('"english"'::"regconfig", ((((((COALESCE("submittals"."title", ''::"text") || ' '::"text") || COALESCE("submittals"."description", ''::"text")) || ' '::"text") || COALESCE("submittals"."spec_section", ''::"text")) || ' '::"text") || COALESCE("submittals"."number", ''::"text"))) AS "search_vector"
   FROM "public"."submittals"
UNION ALL
 SELECT "rfis"."id",
    'rfi'::"text" AS "module",
    "rfis"."project_id",
    (("rfis"."number" || ': '::"text") || "rfis"."subject") AS "title",
    ''::"text" AS "subtitle",
    "rfis"."status",
    "rfis"."assigned_to" AS "assignee_id",
    "to_tsvector"('"english"'::"regconfig", ((((((COALESCE("rfis"."subject", ''::"text") || ' '::"text") || COALESCE("rfis"."question", ''::"text")) || ' '::"text") || COALESCE("rfis"."answer", ''::"text")) || ' '::"text") || COALESCE("rfis"."number", ''::"text"))) AS "search_vector"
   FROM "public"."rfis"
UNION ALL
 SELECT "punch_list_items"."id",
    'punch_list'::"text" AS "module",
    "punch_list_items"."project_id",
    (("punch_list_items"."number" || ': '::"text") || "punch_list_items"."title") AS "title",
    COALESCE("punch_list_items"."location", ''::"text") AS "subtitle",
    "punch_list_items"."status",
    "punch_list_items"."assigned_to" AS "assignee_id",
    "to_tsvector"('"english"'::"regconfig", ((((((((COALESCE("punch_list_items"."title", ''::"text") || ' '::"text") || COALESCE("punch_list_items"."description", ''::"text")) || ' '::"text") || COALESCE("punch_list_items"."location", ''::"text")) || ' '::"text") || COALESCE("punch_list_items"."number", ''::"text")) || ' '::"text") || COALESCE("punch_list_items"."resolution_notes", ''::"text"))) AS "search_vector"
   FROM "public"."punch_list_items"
UNION ALL
 SELECT "daily_logs"."id",
    'daily_log'::"text" AS "module",
    "daily_logs"."project_id",
    ('Log: '::"text" || ("daily_logs"."log_date")::"text") AS "title",
    "left"(COALESCE("daily_logs"."work_summary", ''::"text"), 80) AS "subtitle",
    ''::"text" AS "status",
    "daily_logs"."created_by" AS "assignee_id",
    "to_tsvector"('"english"'::"regconfig", ((COALESCE("daily_logs"."work_summary", ''::"text") || ' '::"text") || COALESCE("daily_logs"."safety_notes", ''::"text"))) AS "search_vector"
   FROM "public"."daily_logs"
UNION ALL
 SELECT "milestones"."id",
    'milestone'::"text" AS "module",
    "milestones"."project_id",
    "milestones"."name" AS "title",
    ''::"text" AS "subtitle",
    "milestones"."status",
    NULL::"uuid" AS "assignee_id",
    "to_tsvector"('"english"'::"regconfig", ((COALESCE("milestones"."name", ''::"text") || ' '::"text") || COALESCE("milestones"."description", ''::"text"))) AS "search_vector"
   FROM "public"."milestones"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."search_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'light'::"text" NOT NULL,
    "notifications" "jsonb" DEFAULT '{"rfi": true, "email": true, "dailyLog": false, "punchList": true, "submittal": true}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_preferences_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" "text" NOT NULL,
    "report_type" "text" DEFAULT 'cm'::"text" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "week_end_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "work_summary" "text" DEFAULT ''::"text" NOT NULL,
    "safety_summary" "text" DEFAULT ''::"text" NOT NULL,
    "schedule_summary" "text" DEFAULT ''::"text" NOT NULL,
    "issues_concerns" "text" DEFAULT ''::"text" NOT NULL,
    "upcoming_work" "text" DEFAULT ''::"text" NOT NULL,
    "weather_summary" "text" DEFAULT ''::"text" NOT NULL,
    "manpower_total" numeric DEFAULT 0 NOT NULL,
    "equipment_hours" numeric DEFAULT 0 NOT NULL,
    "submitted_by" "uuid",
    "approved_by" "uuid",
    "submit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "approval_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "weekly_reports_date_range" CHECK (("week_end_date" >= "week_start_date")),
    CONSTRAINT "weekly_reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['cm'::"text", 'contractor'::"text"]))),
    CONSTRAINT "weekly_reports_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."weekly_reports" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_log_equipment"
    ADD CONSTRAINT "daily_log_equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_log_personnel"
    ADD CONSTRAINT "daily_log_personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_log_work_items"
    ADD CONSTRAINT "daily_log_work_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_project_id_log_date_key" UNIQUE ("project_id", "log_date");



ALTER TABLE ONLY "public"."demo_accounts"
    ADD CONSTRAINT "demo_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_accounts"
    ADD CONSTRAINT "demo_accounts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."demo_team_logins"
    ADD CONSTRAINT "demo_team_logins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."earthcam_cameras"
    ADD CONSTRAINT "earthcam_cameras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."earthcam_cameras"
    ADD CONSTRAINT "earthcam_cameras_project_id_earthcam_camera_id_key" UNIQUE ("project_id", "earthcam_camera_id");



ALTER TABLE ONLY "public"."earthcam_connections"
    ADD CONSTRAINT "earthcam_connections_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."earthcam_connections"
    ADD CONSTRAINT "earthcam_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."earthcam_embeds"
    ADD CONSTRAINT "earthcam_embeds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."earthcam_evidence"
    ADD CONSTRAINT "earthcam_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_number_sequences"
    ADD CONSTRAINT "entity_number_sequences_pkey" PRIMARY KEY ("project_id", "entity_type");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestone_rfis"
    ADD CONSTRAINT "milestone_rfis_pkey" PRIMARY KEY ("milestone_id", "rfi_id");



ALTER TABLE ONLY "public"."milestone_submittals"
    ADD CONSTRAINT "milestone_submittals_pkey" PRIMARY KEY ("milestone_id", "submittal_id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifications"
    ADD CONSTRAINT "modifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_invitations"
    ADD CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_invitations"
    ADD CONSTRAINT "project_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_profile_id_key" UNIQUE ("project_id", "profile_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."punch_list_items"
    ADD CONSTRAINT "punch_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."punch_list_items"
    ADD CONSTRAINT "punch_list_items_project_id_number_key" UNIQUE ("project_id", "number");



ALTER TABLE ONLY "public"."qcqa_reports"
    ADD CONSTRAINT "qcqa_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfi_responses"
    ADD CONSTRAINT "rfi_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_project_id_number_key" UNIQUE ("project_id", "number");



ALTER TABLE ONLY "public"."safety_incidents"
    ADD CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submittals"
    ADD CONSTRAINT "submittals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submittals"
    ADD CONSTRAINT "submittals_project_id_number_key" UNIQUE ("project_id", "number");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id");



CREATE INDEX "attachments_project_id_idx" ON "public"."attachments" USING "btree" ("project_id");



CREATE INDEX "change_orders_project_id_idx" ON "public"."change_orders" USING "btree" ("project_id");



CREATE INDEX "change_orders_status_idx" ON "public"."change_orders" USING "btree" ("status");



CREATE INDEX "change_orders_submitted_by_idx" ON "public"."change_orders" USING "btree" ("submitted_by");



CREATE INDEX "demo_accounts_active_idx" ON "public"."demo_accounts" USING "btree" ("is_active");



CREATE INDEX "demo_accounts_slug_idx" ON "public"."demo_accounts" USING "btree" ("slug");



CREATE INDEX "demo_team_logins_account_idx" ON "public"."demo_team_logins" USING "btree" ("demo_account_id");



CREATE INDEX "demo_team_logins_email_idx" ON "public"."demo_team_logins" USING "btree" ("email");



CREATE INDEX "earthcam_cameras_connection_idx" ON "public"."earthcam_cameras" USING "btree" ("connection_id");



CREATE INDEX "earthcam_cameras_project_idx" ON "public"."earthcam_cameras" USING "btree" ("project_id");



CREATE INDEX "earthcam_cameras_status_idx" ON "public"."earthcam_cameras" USING "btree" ("status");



CREATE INDEX "earthcam_connections_org_idx" ON "public"."earthcam_connections" USING "btree" ("organization_id");



CREATE INDEX "earthcam_embeds_created_idx" ON "public"."earthcam_embeds" USING "btree" ("created_at" DESC);



CREATE INDEX "earthcam_embeds_project_idx" ON "public"."earthcam_embeds" USING "btree" ("project_id");



CREATE INDEX "earthcam_evidence_camera_idx" ON "public"."earthcam_evidence" USING "btree" ("camera_id");



CREATE INDEX "earthcam_evidence_captured_idx" ON "public"."earthcam_evidence" USING "btree" ("captured_at" DESC);



CREATE INDEX "earthcam_evidence_project_idx" ON "public"."earthcam_evidence" USING "btree" ("project_id");



CREATE INDEX "idx_activity_log_entity" ON "public"."activity_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_activity_log_performed_by" ON "public"."activity_log" USING "btree" ("performed_by");



CREATE INDEX "idx_activity_log_project_id" ON "public"."activity_log" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "idx_attachments_entity" ON "public"."attachments" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_attachments_geo" ON "public"."attachments" USING "btree" ("geo_lat", "geo_lng") WHERE (("geo_lat" IS NOT NULL) AND ("geo_lng" IS NOT NULL));



CREATE INDEX "idx_attachments_photo_category" ON "public"."attachments" USING "btree" ("photo_category");



CREATE INDEX "idx_attachments_uploaded_by" ON "public"."attachments" USING "btree" ("uploaded_by");



CREATE INDEX "idx_conversations_updated" ON "public"."conversations" USING "btree" ("updated_at");



CREATE INDEX "idx_conversations_user_project" ON "public"."conversations" USING "btree" ("user_id", "project_id", "updated_at" DESC);



CREATE INDEX "idx_daily_log_equipment_daily_log_id" ON "public"."daily_log_equipment" USING "btree" ("daily_log_id");



CREATE INDEX "idx_daily_log_personnel_daily_log_id" ON "public"."daily_log_personnel" USING "btree" ("daily_log_id");



CREATE INDEX "idx_daily_log_work_items_daily_log_id" ON "public"."daily_log_work_items" USING "btree" ("daily_log_id");



CREATE INDEX "idx_daily_logs_created_by" ON "public"."daily_logs" USING "btree" ("created_by");



CREATE INDEX "idx_daily_logs_fts" ON "public"."daily_logs" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("work_summary", ''::"text") || ' '::"text") || COALESCE("safety_notes", ''::"text"))));



CREATE INDEX "idx_daily_logs_log_date" ON "public"."daily_logs" USING "btree" ("log_date");



CREATE INDEX "idx_daily_logs_project_id" ON "public"."daily_logs" USING "btree" ("project_id");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_milestone_rfis_rfi_id" ON "public"."milestone_rfis" USING "btree" ("rfi_id");



CREATE INDEX "idx_milestone_submittals_submittal_id" ON "public"."milestone_submittals" USING "btree" ("submittal_id");



CREATE INDEX "idx_milestones_fts" ON "public"."milestones" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "idx_milestones_project_id" ON "public"."milestones" USING "btree" ("project_id");



CREATE INDEX "idx_milestones_sort_order" ON "public"."milestones" USING "btree" ("project_id", "sort_order");



CREATE INDEX "idx_milestones_status" ON "public"."milestones" USING "btree" ("status");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_fullname" ON "public"."profiles" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("full_name", ''::"text")));



CREATE INDEX "idx_profiles_organization_id" ON "public"."profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_project_documents_category" ON "public"."project_documents" USING "btree" ("category");



CREATE INDEX "idx_project_documents_project_id" ON "public"."project_documents" USING "btree" ("project_id");



CREATE INDEX "idx_project_documents_status" ON "public"."project_documents" USING "btree" ("status");



CREATE INDEX "idx_project_documents_uploaded_by" ON "public"."project_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_project_members_profile_id" ON "public"."project_members" USING "btree" ("profile_id");



CREATE INDEX "idx_project_members_project_id" ON "public"."project_members" USING "btree" ("project_id");



CREATE INDEX "idx_projects_created_by" ON "public"."projects" USING "btree" ("created_by");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_punch_list_items_assigned_to" ON "public"."punch_list_items" USING "btree" ("assigned_to");



CREATE INDEX "idx_punch_list_items_created_by" ON "public"."punch_list_items" USING "btree" ("created_by");



CREATE INDEX "idx_punch_list_items_fts" ON "public"."punch_list_items" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("description", ''::"text")) || ' '::"text") || COALESCE("location", ''::"text")) || ' '::"text") || COALESCE("number", ''::"text")) || ' '::"text") || COALESCE("resolution_notes", ''::"text"))));



CREATE INDEX "idx_punch_list_items_priority" ON "public"."punch_list_items" USING "btree" ("priority");



CREATE INDEX "idx_punch_list_items_project_id" ON "public"."punch_list_items" USING "btree" ("project_id");



CREATE INDEX "idx_punch_list_items_status" ON "public"."punch_list_items" USING "btree" ("status");



CREATE INDEX "idx_rfi_responses_author_id" ON "public"."rfi_responses" USING "btree" ("author_id");



CREATE INDEX "idx_rfi_responses_rfi_id" ON "public"."rfi_responses" USING "btree" ("rfi_id");



CREATE INDEX "idx_rfis_assigned_to" ON "public"."rfis" USING "btree" ("assigned_to");



CREATE INDEX "idx_rfis_fts" ON "public"."rfis" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((((COALESCE("subject", ''::"text") || ' '::"text") || COALESCE("question", ''::"text")) || ' '::"text") || COALESCE("answer", ''::"text")) || ' '::"text") || COALESCE("number", ''::"text"))));



CREATE INDEX "idx_rfis_milestone_id" ON "public"."rfis" USING "btree" ("milestone_id") WHERE ("milestone_id" IS NOT NULL);



CREATE INDEX "idx_rfis_priority" ON "public"."rfis" USING "btree" ("priority");



CREATE INDEX "idx_rfis_project_id" ON "public"."rfis" USING "btree" ("project_id");



CREATE INDEX "idx_rfis_status" ON "public"."rfis" USING "btree" ("status");



CREATE INDEX "idx_rfis_submitted_by" ON "public"."rfis" USING "btree" ("submitted_by");



CREATE INDEX "idx_search_index_fts" ON "public"."search_index" USING "gin" ("search_vector");



CREATE INDEX "idx_search_index_module" ON "public"."search_index" USING "btree" ("module");



CREATE INDEX "idx_search_index_project" ON "public"."search_index" USING "btree" ("project_id");



CREATE UNIQUE INDEX "idx_search_index_unique" ON "public"."search_index" USING "btree" ("module", "id");



CREATE INDEX "idx_submittals_fts" ON "public"."submittals" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("description", ''::"text")) || ' '::"text") || COALESCE("spec_section", ''::"text")) || ' '::"text") || COALESCE("number", ''::"text"))));



CREATE INDEX "idx_submittals_milestone_id" ON "public"."submittals" USING "btree" ("milestone_id") WHERE ("milestone_id" IS NOT NULL);



CREATE INDEX "idx_submittals_project_id" ON "public"."submittals" USING "btree" ("project_id");



CREATE INDEX "idx_submittals_reviewed_by" ON "public"."submittals" USING "btree" ("reviewed_by");



CREATE INDEX "idx_submittals_status" ON "public"."submittals" USING "btree" ("status");



CREATE INDEX "idx_submittals_submitted_by" ON "public"."submittals" USING "btree" ("submitted_by");



CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE INDEX "modifications_modification_type_idx" ON "public"."modifications" USING "btree" ("modification_type");



CREATE INDEX "modifications_project_id_idx" ON "public"."modifications" USING "btree" ("project_id");



CREATE INDEX "modifications_status_idx" ON "public"."modifications" USING "btree" ("status");



CREATE INDEX "project_invitations_email_idx" ON "public"."project_invitations" USING "btree" ("email");



CREATE INDEX "project_invitations_project_id_idx" ON "public"."project_invitations" USING "btree" ("project_id");



CREATE INDEX "project_invitations_status_idx" ON "public"."project_invitations" USING "btree" ("status");



CREATE INDEX "project_invitations_token_idx" ON "public"."project_invitations" USING "btree" ("token");



CREATE UNIQUE INDEX "project_invitations_unique_pending" ON "public"."project_invitations" USING "btree" ("project_id", "email") WHERE ("status" = 'pending'::"text");



CREATE INDEX "qcqa_reports_is_nonconformance_idx" ON "public"."qcqa_reports" USING "btree" ("is_nonconformance");



CREATE INDEX "qcqa_reports_project_id_idx" ON "public"."qcqa_reports" USING "btree" ("project_id");



CREATE INDEX "qcqa_reports_report_type_idx" ON "public"."qcqa_reports" USING "btree" ("report_type");



CREATE INDEX "qcqa_reports_status_idx" ON "public"."qcqa_reports" USING "btree" ("status");



CREATE INDEX "safety_incidents_date_idx" ON "public"."safety_incidents" USING "btree" ("incident_date");



CREATE INDEX "safety_incidents_project_id_idx" ON "public"."safety_incidents" USING "btree" ("project_id");



CREATE INDEX "safety_incidents_severity_idx" ON "public"."safety_incidents" USING "btree" ("severity");



CREATE INDEX "safety_incidents_status_idx" ON "public"."safety_incidents" USING "btree" ("status");



CREATE INDEX "safety_incidents_type_idx" ON "public"."safety_incidents" USING "btree" ("incident_type");



CREATE INDEX "weekly_reports_project_id_idx" ON "public"."weekly_reports" USING "btree" ("project_id");



CREATE INDEX "weekly_reports_report_type_idx" ON "public"."weekly_reports" USING "btree" ("report_type");



CREATE INDEX "weekly_reports_status_idx" ON "public"."weekly_reports" USING "btree" ("status");



CREATE INDEX "weekly_reports_week_start_date_idx" ON "public"."weekly_reports" USING "btree" ("week_start_date");



CREATE OR REPLACE TRIGGER "daily_logs_updated_at" BEFORE UPDATE ON "public"."daily_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "milestones_updated_at" BEFORE UPDATE ON "public"."milestones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "on_daily_log_created" AFTER INSERT ON "public"."daily_logs" FOR EACH ROW EXECUTE FUNCTION "public"."log_daily_log_activity"();



CREATE OR REPLACE TRIGGER "on_message_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "on_milestone_change" AFTER INSERT OR UPDATE ON "public"."milestones" FOR EACH ROW EXECUTE FUNCTION "public"."log_milestone_activity"();



CREATE OR REPLACE TRIGGER "on_project_status_change" AFTER UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."log_project_status_change"();



CREATE OR REPLACE TRIGGER "on_punch_list_change" AFTER INSERT OR UPDATE ON "public"."punch_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_punch_list_activity"();



CREATE OR REPLACE TRIGGER "on_rfi_change" AFTER INSERT OR UPDATE ON "public"."rfis" FOR EACH ROW EXECUTE FUNCTION "public"."log_rfi_activity"();



CREATE OR REPLACE TRIGGER "on_rfi_response_created" AFTER INSERT ON "public"."rfi_responses" FOR EACH ROW EXECUTE FUNCTION "public"."log_rfi_response_activity"();



CREATE OR REPLACE TRIGGER "on_submittal_change" AFTER INSERT OR UPDATE ON "public"."submittals" FOR EACH ROW EXECUTE FUNCTION "public"."log_submittal_activity"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "punch_list_items_assign_number" BEFORE INSERT ON "public"."punch_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."assign_entity_number"();



CREATE OR REPLACE TRIGGER "punch_list_items_updated_at" BEFORE UPDATE ON "public"."punch_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "rfis_assign_number" BEFORE INSERT ON "public"."rfis" FOR EACH ROW EXECUTE FUNCTION "public"."assign_entity_number"();



CREATE OR REPLACE TRIGGER "rfis_updated_at" BEFORE UPDATE ON "public"."rfis" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "submittals_assign_number" BEFORE INSERT ON "public"."submittals" FOR EACH ROW EXECUTE FUNCTION "public"."assign_entity_number"();



CREATE OR REPLACE TRIGGER "submittals_updated_at" BEFORE UPDATE ON "public"."submittals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_linked_milestone_id_fkey" FOREIGN KEY ("linked_milestone_id") REFERENCES "public"."milestones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_log_equipment"
    ADD CONSTRAINT "daily_log_equipment_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_log_personnel"
    ADD CONSTRAINT "daily_log_personnel_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_log_work_items"
    ADD CONSTRAINT "daily_log_work_items_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_accounts"
    ADD CONSTRAINT "demo_accounts_demo_user_id_fkey" FOREIGN KEY ("demo_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."demo_accounts"
    ADD CONSTRAINT "demo_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_accounts"
    ADD CONSTRAINT "demo_accounts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_team_logins"
    ADD CONSTRAINT "demo_team_logins_demo_account_id_fkey" FOREIGN KEY ("demo_account_id") REFERENCES "public"."demo_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_team_logins"
    ADD CONSTRAINT "demo_team_logins_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."earthcam_cameras"
    ADD CONSTRAINT "earthcam_cameras_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."earthcam_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."earthcam_cameras"
    ADD CONSTRAINT "earthcam_cameras_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."earthcam_connections"
    ADD CONSTRAINT "earthcam_connections_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."earthcam_connections"
    ADD CONSTRAINT "earthcam_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."earthcam_embeds"
    ADD CONSTRAINT "earthcam_embeds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."earthcam_evidence"
    ADD CONSTRAINT "earthcam_evidence_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "public"."earthcam_cameras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."earthcam_evidence"
    ADD CONSTRAINT "earthcam_evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."earthcam_evidence"
    ADD CONSTRAINT "earthcam_evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_number_sequences"
    ADD CONSTRAINT "entity_number_sequences_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestone_rfis"
    ADD CONSTRAINT "milestone_rfis_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestone_rfis"
    ADD CONSTRAINT "milestone_rfis_rfi_id_fkey" FOREIGN KEY ("rfi_id") REFERENCES "public"."rfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestone_submittals"
    ADD CONSTRAINT "milestone_submittals_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestone_submittals"
    ADD CONSTRAINT "milestone_submittals_submittal_id_fkey" FOREIGN KEY ("submittal_id") REFERENCES "public"."submittals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modifications"
    ADD CONSTRAINT "modifications_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modifications"
    ADD CONSTRAINT "modifications_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modifications"
    ADD CONSTRAINT "modifications_linked_milestone_id_fkey" FOREIGN KEY ("linked_milestone_id") REFERENCES "public"."milestones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modifications"
    ADD CONSTRAINT "modifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_linked_milestone_id_fkey" FOREIGN KEY ("linked_milestone_id") REFERENCES "public"."milestones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_invitations"
    ADD CONSTRAINT "project_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_invitations"
    ADD CONSTRAINT "project_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."punch_list_items"
    ADD CONSTRAINT "punch_list_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."punch_list_items"
    ADD CONSTRAINT "punch_list_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."punch_list_items"
    ADD CONSTRAINT "punch_list_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qcqa_reports"
    ADD CONSTRAINT "qcqa_reports_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."qcqa_reports"
    ADD CONSTRAINT "qcqa_reports_inspector_fkey" FOREIGN KEY ("inspector") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."qcqa_reports"
    ADD CONSTRAINT "qcqa_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfi_responses"
    ADD CONSTRAINT "rfi_responses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rfi_responses"
    ADD CONSTRAINT "rfi_responses_rfi_id_fkey" FOREIGN KEY ("rfi_id") REFERENCES "public"."rfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_incidents"
    ADD CONSTRAINT "safety_incidents_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_incidents"
    ADD CONSTRAINT "safety_incidents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."safety_incidents"
    ADD CONSTRAINT "safety_incidents_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submittals"
    ADD CONSTRAINT "submittals_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submittals"
    ADD CONSTRAINT "submittals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submittals"
    ADD CONSTRAINT "submittals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submittals"
    ADD CONSTRAINT "submittals_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Admins and managers can create projects" ON "public"."projects" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can delete daily_logs" ON "public"."daily_logs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete punch_list_items" ON "public"."punch_list_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete rfis" ON "public"."rfis" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete submittals" ON "public"."submittals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage project members" ON "public"."project_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Authenticated users can insert activity log" ON "public"."activity_log" FOR INSERT WITH CHECK (("auth"."uid"() = "performed_by"));



CREATE POLICY "Creators can update own daily logs" ON "public"."daily_logs" FOR UPDATE USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Daily log creators can delete equipment" ON "public"."daily_log_equipment" FOR DELETE USING (("daily_log_id" IN ( SELECT "dl"."id"
   FROM "public"."daily_logs" "dl"
  WHERE ("dl"."created_by" = "auth"."uid"()))));



CREATE POLICY "Daily log creators can delete personnel" ON "public"."daily_log_personnel" FOR DELETE USING (("daily_log_id" IN ( SELECT "dl"."id"
   FROM "public"."daily_logs" "dl"
  WHERE ("dl"."created_by" = "auth"."uid"()))));



CREATE POLICY "Daily log creators can delete work items" ON "public"."daily_log_work_items" FOR DELETE USING (("daily_log_id" IN ( SELECT "dl"."id"
   FROM "public"."daily_logs" "dl"
  WHERE ("dl"."created_by" = "auth"."uid"()))));



CREATE POLICY "Daily log creators can insert equipment" ON "public"."daily_log_equipment" FOR INSERT WITH CHECK (("daily_log_id" IN ( SELECT "dl"."id"
   FROM "public"."daily_logs" "dl"
  WHERE ("dl"."created_by" = "auth"."uid"()))));



CREATE POLICY "Daily log creators can insert personnel" ON "public"."daily_log_personnel" FOR INSERT WITH CHECK (("daily_log_id" IN ( SELECT "dl"."id"
   FROM "public"."daily_logs" "dl"
  WHERE ("dl"."created_by" = "auth"."uid"()))));



CREATE POLICY "Daily log creators can insert work items" ON "public"."daily_log_work_items" FOR INSERT WITH CHECK (("daily_log_id" IN ( SELECT "dl"."id"
   FROM "public"."daily_logs" "dl"
  WHERE ("dl"."created_by" = "auth"."uid"()))));



CREATE POLICY "Editors can create change orders" ON "public"."change_orders" FOR INSERT TO "authenticated" WITH CHECK ((("submitted_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "change_orders"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true))))));



CREATE POLICY "Editors can create modifications" ON "public"."modifications" FOR INSERT TO "authenticated" WITH CHECK ((("issued_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "modifications"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true))))));



CREATE POLICY "Editors can create project documents" ON "public"."project_documents" FOR INSERT TO "authenticated" WITH CHECK ((("uploaded_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_documents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true))))));



CREATE POLICY "Editors can create qcqa reports" ON "public"."qcqa_reports" FOR INSERT TO "authenticated" WITH CHECK ((("inspector" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "qcqa_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true))))));



CREATE POLICY "Editors can create safety incidents" ON "public"."safety_incidents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "safety_incidents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Editors can create weekly reports" ON "public"."weekly_reports" FOR INSERT TO "authenticated" WITH CHECK ((("submitted_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "weekly_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true))))));



CREATE POLICY "Editors can update change orders" ON "public"."change_orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "change_orders"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Editors can update modifications" ON "public"."modifications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "modifications"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Editors can update project documents" ON "public"."project_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_documents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Editors can update qcqa reports" ON "public"."qcqa_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "qcqa_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Editors can update safety incidents" ON "public"."safety_incidents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "safety_incidents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "safety_incidents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Editors can update weekly reports" ON "public"."weekly_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "weekly_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Inspectors and managers can delete qcqa reports" ON "public"."qcqa_reports" FOR DELETE TO "authenticated" USING ((("inspector" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "qcqa_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))));



CREATE POLICY "Issuers and managers can delete modifications" ON "public"."modifications" FOR DELETE TO "authenticated" USING ((("issued_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "modifications"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))));



CREATE POLICY "Members can read change orders" ON "public"."change_orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "change_orders"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Members can read modifications" ON "public"."modifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "modifications"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Members can read qcqa reports" ON "public"."qcqa_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "qcqa_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Members can read weekly reports" ON "public"."weekly_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "weekly_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Members can view project documents" ON "public"."project_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_documents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Members with edit access can update projects" ON "public"."projects" FOR UPDATE USING (("id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can create daily_logs" ON "public"."daily_logs" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can create milestones" ON "public"."milestones" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can create punch_list_items" ON "public"."punch_list_items" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can create rfis" ON "public"."rfis" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can create submittals" ON "public"."submittals" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can manage milestone rfis" ON "public"."milestone_rfis" USING (("milestone_id" IN ( SELECT "m"."id"
   FROM ("public"."milestones" "m"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "m"."project_id")))
  WHERE (("pm"."profile_id" = "auth"."uid"()) AND ("pm"."can_edit" = true)))));



CREATE POLICY "Project editors can manage milestone submittals" ON "public"."milestone_submittals" USING (("milestone_id" IN ( SELECT "m"."id"
   FROM ("public"."milestones" "m"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "m"."project_id")))
  WHERE (("pm"."profile_id" = "auth"."uid"()) AND ("pm"."can_edit" = true)))));



CREATE POLICY "Project editors can update daily_logs" ON "public"."daily_logs" FOR UPDATE USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can update milestones" ON "public"."milestones" FOR UPDATE USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can update punch_list_items" ON "public"."punch_list_items" FOR UPDATE USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can update rfis" ON "public"."rfis" FOR UPDATE USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project editors can update submittals" ON "public"."submittals" FOR UPDATE USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE (("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "Project members can create rfi responses" ON "public"."rfi_responses" FOR INSERT WITH CHECK (("rfi_id" IN ( SELECT "r"."id"
   FROM ("public"."rfis" "r"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "r"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can manage entity number sequences" ON "public"."entity_number_sequences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "entity_number_sequences"."project_id") AND ("pm"."profile_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "entity_number_sequences"."project_id") AND ("pm"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Project members can read activity log" ON "public"."activity_log" FOR SELECT USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE ("project_members"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read daily log equipment" ON "public"."daily_log_equipment" FOR SELECT USING (("daily_log_id" IN ( SELECT "dl"."id"
   FROM ("public"."daily_logs" "dl"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "dl"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read daily log personnel" ON "public"."daily_log_personnel" FOR SELECT USING (("daily_log_id" IN ( SELECT "dl"."id"
   FROM ("public"."daily_logs" "dl"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "dl"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read daily log work items" ON "public"."daily_log_work_items" FOR SELECT USING (("daily_log_id" IN ( SELECT "dl"."id"
   FROM ("public"."daily_logs" "dl"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "dl"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read daily_logs" ON "public"."daily_logs" FOR SELECT USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE ("project_members"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read milestone rfis" ON "public"."milestone_rfis" FOR SELECT USING (("milestone_id" IN ( SELECT "m"."id"
   FROM ("public"."milestones" "m"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "m"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read milestone submittals" ON "public"."milestone_submittals" FOR SELECT USING (("milestone_id" IN ( SELECT "m"."id"
   FROM ("public"."milestones" "m"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "m"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read milestones" ON "public"."milestones" FOR SELECT USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE ("project_members"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read punch_list_items" ON "public"."punch_list_items" FOR SELECT USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE ("project_members"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read rfi responses" ON "public"."rfi_responses" FOR SELECT USING (("rfi_id" IN ( SELECT "r"."id"
   FROM ("public"."rfis" "r"
     JOIN "public"."project_members" "pm" ON (("pm"."project_id" = "r"."project_id")))
  WHERE ("pm"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read rfis" ON "public"."rfis" FOR SELECT USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE ("project_members"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can read submittals" ON "public"."submittals" FOR SELECT USING (("project_id" IN ( SELECT "project_members"."project_id"
   FROM "public"."project_members"
  WHERE ("project_members"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Project members can view safety incidents" ON "public"."safety_incidents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "safety_incidents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Reporters and managers can delete safety incidents" ON "public"."safety_incidents" FOR DELETE TO "authenticated" USING ((("reported_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "safety_incidents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))));



CREATE POLICY "Submitters and managers can delete change orders" ON "public"."change_orders" FOR DELETE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "change_orders"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))));



CREATE POLICY "Submitters and managers can delete weekly reports" ON "public"."weekly_reports" FOR DELETE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "weekly_reports"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))));



CREATE POLICY "Uploaders and managers can delete project documents" ON "public"."project_documents" FOR DELETE TO "authenticated" USING ((("uploaded_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_documents"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))));



CREATE POLICY "Users can delete own conversations" ON "public"."conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert messages in own conversations" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own organization" ON "public"."organizations" FOR SELECT USING (("id" = ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read project teammate profiles" ON "public"."profiles" FOR SELECT USING (("id" IN ( SELECT "pm2"."profile_id"
   FROM ("public"."project_members" "pm1"
     JOIN "public"."project_members" "pm2" ON (("pm1"."project_id" = "pm2"."project_id")))
  WHERE ("pm1"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own organization" ON "public"."organizations" FOR UPDATE USING (("id" = ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view messages in own conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attachments_delete" ON "public"."attachments" FOR DELETE USING ((("uploaded_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "attachments"."project_id") AND ("pm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "attachments_insert" ON "public"."attachments" FOR INSERT WITH CHECK ((("uploaded_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "attachments"."project_id") AND ("pm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "attachments_select" ON "public"."attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "attachments"."project_id") AND ("pm"."profile_id" = "auth"."uid"())))));



CREATE POLICY "attachments_update" ON "public"."attachments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "attachments"."project_id") AND ("pm"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."change_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_log_equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_log_personnel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_log_work_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demo_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demo_team_logins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."earthcam_cameras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."earthcam_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."earthcam_embeds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."earthcam_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_number_sequences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitees can read their own            
  invitations" ON "public"."project_invitations" FOR SELECT USING (("email" = ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "invitees can update their own          
  invitations" ON "public"."project_invitations" FOR UPDATE USING (("email" = ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "managers can create invitations" ON "public"."project_invitations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_invitations"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "managers can update invitations" ON "public"."project_invitations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_invitations"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."can_edit" = true)))));



CREATE POLICY "members can read project invitations" ON "public"."project_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "project_invitations"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestone_rfis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestone_submittals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org managers can create earthcam connection" ON "public"."earthcam_connections" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_id" = "earthcam_connections"."organization_id") AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "org managers can update earthcam connection" ON "public"."earthcam_connections" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_id" = "earthcam_connections"."organization_id") AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_id" = "earthcam_connections"."organization_id") AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "org members can read earthcam connection" ON "public"."earthcam_connections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_id" = "earthcam_connections"."organization_id")))));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()) OR "public"."shares_project_with"("id", "auth"."uid"())));



CREATE POLICY "project editors can create earthcam evidence" ON "public"."earthcam_evidence" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_evidence"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'engineer'::"text", 'foreman'::"text", 'contractor'::"text", 'inspector'::"text"]))))));



CREATE POLICY "project editors can delete earthcam evidence" ON "public"."earthcam_evidence" FOR DELETE USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_evidence"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'engineer'::"text"])))))));



CREATE POLICY "project managers can write earthcam cameras" ON "public"."earthcam_cameras" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_cameras"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'engineer'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_cameras"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'engineer'::"text"]))))));



CREATE POLICY "project managers can write earthcam embeds" ON "public"."earthcam_embeds" USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_embeds"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'engineer'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_embeds"."project_id") AND ("project_members"."profile_id" = "auth"."uid"()) AND ("project_members"."project_role" = ANY (ARRAY['manager'::"text", 'superintendent'::"text", 'engineer'::"text"]))))));



CREATE POLICY "project members can read earthcam cameras" ON "public"."earthcam_cameras" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_cameras"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "project members can read earthcam embeds" ON "public"."earthcam_embeds" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_embeds"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "project members can read earthcam evidence" ON "public"."earthcam_evidence" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_members"
  WHERE (("project_members"."project_id" = "earthcam_evidence"."project_id") AND ("project_members"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."project_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_members_delete" ON "public"."project_members" FOR DELETE USING ((("profile_id" = "auth"."uid"()) OR "public"."can_manage_project"("project_id", "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "project_members_insert" ON "public"."project_members" FOR INSERT WITH CHECK (((("profile_id" = "auth"."uid"()) AND "public"."has_pending_invitation"("project_id", "auth"."uid"())) OR "public"."can_manage_project"("project_id", "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "project_members_select" ON "public"."project_members" FOR SELECT USING ((("profile_id" = "auth"."uid"()) OR "public"."is_project_member"("project_id", "auth"."uid"())));



CREATE POLICY "project_members_update" ON "public"."project_members" FOR UPDATE USING (("public"."can_manage_project"("project_id", "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_select" ON "public"."projects" FOR SELECT USING (("public"."is_project_member"("id", "auth"."uid"()) OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."punch_list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qcqa_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rfi_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rfis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."safety_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submittals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_reports" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."assign_entity_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_entity_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_entity_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_project"("p_project_id" "uuid", "p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_project"("p_project_id" "uuid", "p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_project"("p_project_id" "uuid", "p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_project"("p_name" "text", "p_description" "text", "p_location" "text", "p_client" "text", "p_start_date" "date", "p_target_end_date" "date", "p_budget_total" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_project"("p_name" "text", "p_description" "text", "p_location" "text", "p_client" "text", "p_start_date" "date", "p_target_end_date" "date", "p_budget_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_project"("p_name" "text", "p_description" "text", "p_location" "text", "p_client" "text", "p_start_date" "date", "p_target_end_date" "date", "p_budget_total" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_project_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_project_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_project_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."global_search"("search_query" "text", "project_ids" "uuid"[], "result_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."global_search"("search_query" "text", "project_ids" "uuid"[], "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."global_search"("search_query" "text", "project_ids" "uuid"[], "result_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_pending_invitation"("p_project_id" "uuid", "p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_pending_invitation"("p_project_id" "uuid", "p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_pending_invitation"("p_project_id" "uuid", "p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_activity"("p_project_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_description" "text", "p_performed_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_activity"("p_project_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_description" "text", "p_performed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity"("p_project_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_description" "text", "p_performed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_daily_log_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_daily_log_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_milestone_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_milestone_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_project_status_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_project_status_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_punch_list_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_punch_list_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_rfi_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_rfi_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_rfi_response_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_rfi_response_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_submittal_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_submittal_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."setup_organization"("org_name" "text", "org_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."setup_organization"("org_name" "text", "org_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_organization"("org_name" "text", "org_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."shares_project_with"("p_other_profile_id" "uuid", "p_current_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."shares_project_with"("p_other_profile_id" "uuid", "p_current_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."shares_project_with"("p_other_profile_id" "uuid", "p_current_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_conversation_timestamp"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."change_orders" TO "anon";
GRANT ALL ON TABLE "public"."change_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."change_orders" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."daily_log_equipment" TO "anon";
GRANT ALL ON TABLE "public"."daily_log_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_log_equipment" TO "service_role";



GRANT ALL ON TABLE "public"."daily_log_personnel" TO "anon";
GRANT ALL ON TABLE "public"."daily_log_personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_log_personnel" TO "service_role";



GRANT ALL ON TABLE "public"."daily_log_work_items" TO "anon";
GRANT ALL ON TABLE "public"."daily_log_work_items" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_log_work_items" TO "service_role";



GRANT ALL ON TABLE "public"."daily_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logs" TO "service_role";



GRANT ALL ON TABLE "public"."demo_accounts" TO "anon";
GRANT ALL ON TABLE "public"."demo_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."demo_team_logins" TO "anon";
GRANT ALL ON TABLE "public"."demo_team_logins" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_team_logins" TO "service_role";



GRANT ALL ON TABLE "public"."earthcam_cameras" TO "anon";
GRANT ALL ON TABLE "public"."earthcam_cameras" TO "authenticated";
GRANT ALL ON TABLE "public"."earthcam_cameras" TO "service_role";



GRANT ALL ON TABLE "public"."earthcam_connections" TO "anon";
GRANT ALL ON TABLE "public"."earthcam_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."earthcam_connections" TO "service_role";



GRANT ALL ON TABLE "public"."earthcam_embeds" TO "anon";
GRANT ALL ON TABLE "public"."earthcam_embeds" TO "authenticated";
GRANT ALL ON TABLE "public"."earthcam_embeds" TO "service_role";



GRANT ALL ON TABLE "public"."earthcam_evidence" TO "anon";
GRANT ALL ON TABLE "public"."earthcam_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."earthcam_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."entity_number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."entity_number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_number_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."milestone_rfis" TO "anon";
GRANT ALL ON TABLE "public"."milestone_rfis" TO "authenticated";
GRANT ALL ON TABLE "public"."milestone_rfis" TO "service_role";



GRANT ALL ON TABLE "public"."milestone_submittals" TO "anon";
GRANT ALL ON TABLE "public"."milestone_submittals" TO "authenticated";
GRANT ALL ON TABLE "public"."milestone_submittals" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."modifications" TO "anon";
GRANT ALL ON TABLE "public"."modifications" TO "authenticated";
GRANT ALL ON TABLE "public"."modifications" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_documents" TO "anon";
GRANT ALL ON TABLE "public"."project_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."project_documents" TO "service_role";



GRANT ALL ON TABLE "public"."project_invitations" TO "anon";
GRANT ALL ON TABLE "public"."project_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."project_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."project_members" TO "anon";
GRANT ALL ON TABLE "public"."project_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_members" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."punch_list_items" TO "anon";
GRANT ALL ON TABLE "public"."punch_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."punch_list_items" TO "service_role";



GRANT ALL ON TABLE "public"."qcqa_reports" TO "anon";
GRANT ALL ON TABLE "public"."qcqa_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."qcqa_reports" TO "service_role";



GRANT ALL ON TABLE "public"."rfi_responses" TO "anon";
GRANT ALL ON TABLE "public"."rfi_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."rfi_responses" TO "service_role";



GRANT ALL ON TABLE "public"."rfis" TO "anon";
GRANT ALL ON TABLE "public"."rfis" TO "authenticated";
GRANT ALL ON TABLE "public"."rfis" TO "service_role";



GRANT ALL ON TABLE "public"."safety_incidents" TO "anon";
GRANT ALL ON TABLE "public"."safety_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."submittals" TO "anon";
GRANT ALL ON TABLE "public"."submittals" TO "authenticated";
GRANT ALL ON TABLE "public"."submittals" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."search_index" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."search_index" TO "authenticated";
GRANT ALL ON TABLE "public"."search_index" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_reports" TO "anon";
GRANT ALL ON TABLE "public"."weekly_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_reports" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































