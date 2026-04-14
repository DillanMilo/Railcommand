'use client';

import { useCallback, useEffect, useState } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';

import type {
  Project,
  ProjectInvitation,
  Submittal,
  RFI,
  DailyLog,
  PunchListItem,
  ProjectMember,
  Milestone,
  ActivityLogEntry,
  SafetyIncident,
} from '@/lib/types';

// Store (demo mode)
import * as store from '@/lib/store';

// Server actions (real auth mode)
import { getDashboardData as fetchDashboardData, type DashboardData } from '@/lib/actions/dashboard';
import { getProjects as fetchProjects } from '@/lib/actions/projects';
import {
  getSubmittals as fetchSubmittals,
  getSubmittalById as fetchSubmittalById,
} from '@/lib/actions/submittals';
import {
  getRFIs as fetchRFIs,
  getRFIById as fetchRFIById,
} from '@/lib/actions/rfis';
import {
  getDailyLogs as fetchDailyLogs,
  getDailyLogById as fetchDailyLogById,
} from '@/lib/actions/daily-logs';
import {
  getPunchListItems as fetchPunchList,
  getPunchListItemById as fetchPunchListById,
} from '@/lib/actions/punch-list';
import { getProjectMembers as fetchMembers } from '@/lib/actions/team';
import { getMilestones as fetchMilestones } from '@/lib/actions/milestones';
import {
  getSafetyIncidents as fetchSafetyIncidents,
  getSafetyIncident as fetchSafetyIncident,
} from '@/lib/actions/safety';
import { getActivityLog as fetchActivity } from '@/lib/actions/activity-log';
import {
  getProjectInvitations as fetchProjectInvitations,
  getPendingInvitationsForUser as fetchPendingInvitations,
} from '@/lib/actions/invitations';

/* ------------------------------------------------------------------ */
/*  Generic query hook                                                 */
/* ------------------------------------------------------------------ */

interface QueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useQuery<T>(
  demoFn: () => T,
  serverFn: () => Promise<{ data?: T; error?: string }>,
  deps: unknown[],
  initial: T,
): QueryResult<T> {
  const { isDemo } = useProject();
  const [data, setData] = useState<T>(() => (isDemo ? demoFn() : initial));
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (isDemo) {
      setData(demoFn());
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    serverFn().then((result) => {
      if (result.error) {
        setError(result.error);
      } else if (result.data !== undefined) {
        setData(result.data);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Domain hooks                                                       */
/* ------------------------------------------------------------------ */

export function useDashboardData(projectId: string | null) {
  return useQuery<DashboardData>(
    () => ({
      submittals: projectId ? store.getSubmittals(projectId) : [],
      rfis: projectId ? store.getRFIs(projectId) : [],
      punchListItems: projectId ? store.getPunchListItems(projectId) : [],
      dailyLogs: projectId ? store.getDailyLogs(projectId) : [],
      milestones: projectId ? store.getMilestones(projectId) : [],
    }),
    () =>
      projectId
        ? fetchDashboardData(projectId)
        : Promise.resolve({
            data: { submittals: [], rfis: [], punchListItems: [], dailyLogs: [], milestones: [] },
          }),
    [projectId],
    { submittals: [], rfis: [], punchListItems: [], dailyLogs: [], milestones: [] },
  );
}

export function useProjects() {
  return useQuery<Project[]>(
    () => store.getProjects(),
    () => fetchProjects(),
    [],
    [],
  );
}

export function useSubmittals(projectId: string | null) {
  return useQuery<Submittal[]>(
    () => (projectId ? store.getSubmittals(projectId) : []),
    () => (projectId ? fetchSubmittals(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useSubmittalDetail(projectId: string, submittalId: string) {
  return useQuery<Submittal | null>(
    () => store.getSubmittals(projectId).find((s) => s.id === submittalId) ?? null,
    () => fetchSubmittalById(projectId, submittalId),
    [projectId, submittalId],
    null,
  );
}

export function useRFIs(projectId: string | null) {
  return useQuery<RFI[]>(
    () => (projectId ? store.getRFIs(projectId) : []),
    () => (projectId ? fetchRFIs(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useRFIDetail(projectId: string, rfiId: string) {
  return useQuery<RFI | null>(
    () => store.getRFIs(projectId).find((r) => r.id === rfiId) ?? null,
    () => fetchRFIById(projectId, rfiId),
    [projectId, rfiId],
    null,
  );
}

export function useDailyLogs(projectId: string | null) {
  return useQuery<DailyLog[]>(
    () => (projectId ? store.getDailyLogs(projectId) : []),
    () => (projectId ? fetchDailyLogs(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useDailyLogDetail(projectId: string, logId: string) {
  return useQuery<DailyLog | null>(
    () => store.getDailyLogs(projectId).find((d) => d.id === logId) ?? null,
    () => fetchDailyLogById(projectId, logId),
    [projectId, logId],
    null,
  );
}

export function usePunchListItems(projectId: string | null) {
  return useQuery<PunchListItem[]>(
    () => (projectId ? store.getPunchListItems(projectId) : []),
    () => (projectId ? fetchPunchList(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function usePunchListDetail(projectId: string, itemId: string) {
  return useQuery<PunchListItem | null>(
    () => store.getPunchListItems(projectId).find((p) => p.id === itemId) ?? null,
    () => fetchPunchListById(projectId, itemId),
    [projectId, itemId],
    null,
  );
}

export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMember[]>(
    () => store.getProjectMembers(projectId),
    () => fetchMembers(projectId),
    [projectId],
    [],
  );
}

export function useMilestones(projectId: string) {
  return useQuery<Milestone[]>(
    () => store.getMilestones(projectId),
    () => fetchMilestones(projectId),
    [projectId],
    [],
  );
}

export function useActivityLog(projectId: string, limit?: number) {
  return useQuery<ActivityLogEntry[]>(
    () => store.getActivityLog(projectId).slice(0, limit),
    () => fetchActivity(projectId, limit),
    [projectId, limit],
    [],
  );
}

export function useSafetyIncidents(projectId: string | null) {
  return useQuery<SafetyIncident[]>(
    () => [], // no demo store for safety yet
    () => (projectId ? fetchSafetyIncidents(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useSafetyIncidentDetail(projectId: string, incidentId: string) {
  return useQuery<SafetyIncident | null>(
    () => null, // no demo store for safety yet
    () => fetchSafetyIncident(incidentId, projectId),
    [projectId, incidentId],
    null,
  );
}

export function useProjectInvitations(projectId: string) {
  return useQuery<ProjectInvitation[]>(
    () => store.getProjectInvitations(projectId),
    async () => {
      const result = await fetchProjectInvitations(projectId);
      return { data: result.data ?? [], error: result.error };
    },
    [projectId],
    [],
  );
}

export function usePendingInvitations() {
  return useQuery<ProjectInvitation[]>(
    () => store.getUserInvitations('demo@railcommand.app'),
    async () => {
      const result = await fetchPendingInvitations();
      return { data: result.data ?? [], error: result.error };
    },
    [],
    [],
  );
}
