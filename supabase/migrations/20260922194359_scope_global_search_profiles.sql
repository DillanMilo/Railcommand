-- Restrict profile search to the caller's authorized requested projects.
-- Same RPC signature/result shape; no user records are modified.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
        SELECT profile.id, profile.full_name
        FROM public.profiles profile
        WHERE profile.full_name ILIKE '%' || search_query || '%'
          AND EXISTS (
            SELECT 1
            FROM public.project_members member
            WHERE member.profile_id = profile.id
              AND member.project_id = ANY(authorized_project_ids)
          )
        LIMIT 20
      ) pr
    )
  ) INTO result;

  RETURN result;
END;
$$;

revoke execute on function public.global_search(text, uuid[], integer) from public, anon;
grant execute on function public.global_search(text, uuid[], integer) to authenticated, service_role;
commit;
