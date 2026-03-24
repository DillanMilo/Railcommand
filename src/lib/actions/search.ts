// src/lib/actions/search.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import {
  type ActionResult,
  getAuthenticatedUser,
} from './permissions-helper';

export interface SearchResultItem {
  id: string;
  module: 'submittal' | 'rfi' | 'punch_list' | 'daily_log' | 'milestone';
  title: string;
  subtitle: string;
  status: string;
  projectId: string;
  projectName: string;
  href: string;
  assignee?: string;
  matchField?: string;
}

export interface GlobalSearchResult {
  submittals: SearchResultItem[];
  rfis: SearchResultItem[];
  punchList: SearchResultItem[];
  dailyLogs: SearchResultItem[];
  milestones: SearchResultItem[];
}

// Shape returned by the global_search RPC function
interface RpcSearchResult {
  submittals: Array<{
    id: string;
    project_id: string;
    number: string;
    title: string;
    spec_section: string;
    status: string;
    submitted_by: string;
    rank: number;
  }>;
  rfis: Array<{
    id: string;
    project_id: string;
    number: string;
    subject: string;
    status: string;
    assigned_to: string;
    rank: number;
  }>;
  punch_list: Array<{
    id: string;
    project_id: string;
    number: string;
    title: string;
    location: string;
    description: string;
    status: string;
    assigned_to: string;
    rank: number;
  }>;
  daily_logs: Array<{
    id: string;
    project_id: string;
    log_date: string;
    work_summary: string;
    created_by: string;
    rank: number;
  }>;
  milestones: Array<{
    id: string;
    project_id: string;
    name: string;
    status: string;
    rank: number;
  }>;
  matched_profiles: Array<{
    id: string;
    full_name: string;
  }>;
}

const EMPTY_RESULT: GlobalSearchResult = {
  submittals: [],
  rfis: [],
  punchList: [],
  dailyLogs: [],
  milestones: [],
};

/**
 * Global search across all modules the user has access to.
 * Uses the Supabase `global_search` RPC function for a single optimized
 * database call with FTS ranking + ILIKE fallback.
 */
export async function globalSearch(
  query: string,
  projectId?: string
): Promise<ActionResult<GlobalSearchResult>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const trimmed = query.trim().slice(0, 200);
    if (!trimmed) {
      return { success: true, data: EMPTY_RESULT };
    }

    // Get projects the user has access to
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let accessibleProjectIds: string[] = [];

    if (profile?.role === 'admin') {
      if (projectId) {
        accessibleProjectIds = [projectId];
      } else {
        const { data: allProjects } = await supabase.from('projects').select('id');
        accessibleProjectIds = allProjects?.map((p) => p.id) ?? [];
      }
    } else {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('profile_id', user.id);

      accessibleProjectIds = memberships?.map((m) => m.project_id) ?? [];
      if (projectId) {
        accessibleProjectIds = accessibleProjectIds.filter((id) => id === projectId);
      }
    }

    if (accessibleProjectIds.length === 0) {
      return { success: true, data: EMPTY_RESULT };
    }

    // Single RPC call for all search results + project names in parallel
    const [rpcResult, projectsResult] = await Promise.all([
      supabase.rpc('global_search', {
        search_query: trimmed,
        project_ids: accessibleProjectIds,
        result_limit: 10,
      }),
      supabase
        .from('projects')
        .select('id, name')
        .in('id', accessibleProjectIds),
    ]);

    if (rpcResult.error) {
      return { error: rpcResult.error.message };
    }

    const rpc = rpcResult.data as RpcSearchResult;
    const projectMap = new Map<string, string>(
      (projectsResult.data ?? []).map((p) => [p.id, p.name])
    );

    // Build profile name lookup from matched_profiles
    const profileNameMap = new Map<string, string>(
      (rpc.matched_profiles ?? []).map((p) => [p.id, p.full_name])
    );

    // Helper to check if an assignee was the reason for the match
    function getAssigneeInfo(assigneeId: string | null): {
      assignee?: string;
      matchField?: string;
    } {
      if (!assigneeId) return {};
      const name = profileNameMap.get(assigneeId);
      if (!name) return {};
      return {
        assignee: name,
        matchField: name.toLowerCase().includes(trimmed.toLowerCase())
          ? 'assignee'
          : undefined,
      };
    }

    const result: GlobalSearchResult = {
      submittals: (rpc.submittals ?? []).map((s) => ({
        id: s.id,
        module: 'submittal' as const,
        title: `${s.number}: ${s.title}`,
        subtitle: s.spec_section ?? '',
        status: s.status,
        projectId: s.project_id,
        projectName: projectMap.get(s.project_id) ?? '',
        href: `/projects/${s.project_id}/submittals/${s.id}`,
        ...getAssigneeInfo(s.submitted_by),
      })),
      rfis: (rpc.rfis ?? []).map((r) => ({
        id: r.id,
        module: 'rfi' as const,
        title: `${r.number}: ${r.subject}`,
        subtitle: '',
        status: r.status,
        projectId: r.project_id,
        projectName: projectMap.get(r.project_id) ?? '',
        href: `/projects/${r.project_id}/rfis/${r.id}`,
        ...getAssigneeInfo(r.assigned_to),
      })),
      punchList: (rpc.punch_list ?? []).map((p) => ({
        id: p.id,
        module: 'punch_list' as const,
        title: `${p.number}: ${p.title}`,
        subtitle: p.location ?? '',
        status: p.status,
        projectId: p.project_id,
        projectName: projectMap.get(p.project_id) ?? '',
        href: `/projects/${p.project_id}/punch-list/${p.id}`,
        ...getAssigneeInfo(p.assigned_to),
      })),
      dailyLogs: (rpc.daily_logs ?? []).map((d) => ({
        id: d.id,
        module: 'daily_log' as const,
        title: `Log: ${d.log_date}`,
        subtitle: (d.work_summary ?? '').slice(0, 80),
        status: '',
        projectId: d.project_id,
        projectName: projectMap.get(d.project_id) ?? '',
        href: `/projects/${d.project_id}/daily-logs/${d.id}`,
        ...getAssigneeInfo(d.created_by),
      })),
      milestones: (rpc.milestones ?? []).map((m) => ({
        id: m.id,
        module: 'milestone' as const,
        title: m.name,
        subtitle: '',
        status: m.status,
        projectId: m.project_id,
        projectName: projectMap.get(m.project_id) ?? '',
        href: `/projects/${m.project_id}/schedule`,
      })),
    };

    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Search failed' };
  }
}
