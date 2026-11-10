import type { SupabaseClient } from "@supabase/supabase-js";
export const PROJECT_OPERATIONAL_FIELDS =
  "id,name,description,status,start_date,target_end_date,actual_end_date,location,client,created_by,created_at,updated_at,organization_id,turnover_date,substantial_completion_date,project_completion_date";
export const MILESTONE_OPERATIONAL_FIELDS =
  "id,project_id,name,description,target_date,actual_date,status,percent_complete,sort_order,created_at,updated_at";
export async function enrichProject<T extends { id: string }>(
  db: SupabaseClient,
  row: T,
): Promise<T> {
  const { data, error } = await db
    .rpc("project_finance", { p_project_id: row.id })
    .maybeSingle();
  if (error) throw new Error("Could not verify project finance access");
  return { ...row, ...(data ?? {}) };
}
export async function enrichMilestones<T extends { id: string }>(
  db: SupabaseClient,
  projectId: string,
  rows: T[],
): Promise<T[]> {
  const { data, error } = await db.rpc("milestone_finance", {
    p_project_id: projectId,
  });
  if (error) throw new Error("Could not verify milestone finance access");
  const byId = new Map((data ?? []).map((x: { id: string }) => [x.id, x]));
  return rows.map((row) => ({ ...row, ...(byId.get(row.id) ?? {}) }));
}
