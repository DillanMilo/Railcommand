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
}

export interface GlobalSearchResult {
  submittals: SearchResultItem[];
  rfis: SearchResultItem[];
  punchList: SearchResultItem[];
  dailyLogs: SearchResultItem[];
  milestones: SearchResultItem[];
}

/**
 * Global search across all modules the user has access to (Supabase mode).
 * Searches submittals, RFIs, punch list items, daily logs, and milestones.
 */
export async function globalSearch(
  query: string,
  projectId?: string
): Promise<ActionResult<GlobalSearchResult>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const trimmed = query.trim();
    if (!trimmed) {
      return {
        success: true,
        data: { submittals: [], rfis: [], punchList: [], dailyLogs: [], milestones: [] },
      };
    }

    const pattern = `%${trimmed}%`;

    // Get projects the user has access to
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let accessibleProjectIds: string[] = [];

    if (profile?.role === 'admin') {
      // Admins can see everything
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
      return {
        success: true,
        data: { submittals: [], rfis: [], punchList: [], dailyLogs: [], milestones: [] },
      };
    }

    // Fetch project names for display
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', accessibleProjectIds);

    const projectMap = new Map<string, string>(
      (projectsData ?? []).map((p) => [p.id, p.name])
    );

    // Run all searches in parallel
    const [submittalRes, rfiRes, punchRes, dailyRes, milestoneRes] = await Promise.all([
      // Submittals: search by title, spec_section, number
      supabase
        .from('submittals')
        .select('id, project_id, number, title, spec_section, status')
        .in('project_id', accessibleProjectIds)
        .or(`title.ilike.${pattern},spec_section.ilike.${pattern},number.ilike.${pattern}`)
        .limit(10),

      // RFIs: search by subject, number
      supabase
        .from('rfis')
        .select('id, project_id, number, subject, status')
        .in('project_id', accessibleProjectIds)
        .or(`subject.ilike.${pattern},number.ilike.${pattern}`)
        .limit(10),

      // Punch list: search by title, location, description
      supabase
        .from('punch_list_items')
        .select('id, project_id, number, title, location, description, status')
        .in('project_id', accessibleProjectIds)
        .or(`title.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern},number.ilike.${pattern}`)
        .limit(10),

      // Daily logs: search by work_summary, log_date
      supabase
        .from('daily_logs')
        .select('id, project_id, log_date, work_summary')
        .in('project_id', accessibleProjectIds)
        .or(`work_summary.ilike.${pattern},log_date.ilike.${pattern}`)
        .limit(10),

      // Milestones: search by name
      supabase
        .from('milestones')
        .select('id, project_id, name, status')
        .in('project_id', accessibleProjectIds)
        .or(`name.ilike.${pattern}`)
        .limit(10),
    ]);

    const result: GlobalSearchResult = {
      submittals: (submittalRes.data ?? []).map((s) => ({
        id: s.id,
        module: 'submittal' as const,
        title: `${s.number}: ${s.title}`,
        subtitle: s.spec_section ?? '',
        status: s.status,
        projectId: s.project_id,
        projectName: projectMap.get(s.project_id) ?? '',
        href: `/projects/${s.project_id}/submittals/${s.id}`,
      })),
      rfis: (rfiRes.data ?? []).map((r) => ({
        id: r.id,
        module: 'rfi' as const,
        title: `${r.number}: ${r.subject}`,
        subtitle: '',
        status: r.status,
        projectId: r.project_id,
        projectName: projectMap.get(r.project_id) ?? '',
        href: `/projects/${r.project_id}/rfis/${r.id}`,
      })),
      punchList: (punchRes.data ?? []).map((p) => ({
        id: p.id,
        module: 'punch_list' as const,
        title: `${p.number}: ${p.title}`,
        subtitle: p.location ?? '',
        status: p.status,
        projectId: p.project_id,
        projectName: projectMap.get(p.project_id) ?? '',
        href: `/projects/${p.project_id}/punch-list/${p.id}`,
      })),
      dailyLogs: (dailyRes.data ?? []).map((d) => ({
        id: d.id,
        module: 'daily_log' as const,
        title: `Log: ${d.log_date}`,
        subtitle: (d.work_summary ?? '').slice(0, 80),
        status: '',
        projectId: d.project_id,
        projectName: projectMap.get(d.project_id) ?? '',
        href: `/projects/${d.project_id}/daily-logs/${d.id}`,
      })),
      milestones: (milestoneRes.data ?? []).map((m) => ({
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
