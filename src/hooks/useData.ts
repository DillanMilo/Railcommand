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
  ChangeOrder,
  ActivityLogEntry,
  SafetyIncident,
  WeeklyReport,
  Modification,
  QCQAReport,
  ProjectDocument,
  Attachment,
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
import { getChangeOrders as fetchChangeOrders } from '@/lib/actions/change-orders';
import {
  getModifications as fetchModifications,
  getModificationById as fetchModificationById,
} from '@/lib/actions/modifications';
import {
  getSafetyIncidents as fetchSafetyIncidents,
  getSafetyIncident as fetchSafetyIncident,
} from '@/lib/actions/safety';
import {
  getQCQAReports as fetchQCQAReports,
  getQCQAReportById as fetchQCQAReportById,
} from '@/lib/actions/qcqa';
import {
  getProjectDocuments as fetchProjectDocuments,
  getProjectDocumentById as fetchProjectDocumentById,
} from '@/lib/actions/documents';
import {
  getWeeklyReports as fetchWeeklyReports,
  getWeeklyReportById as fetchWeeklyReportById,
} from '@/lib/actions/weekly-reports';
import { getActivityLog as fetchActivity } from '@/lib/actions/activity-log';
import {
  getProjectInvitations as fetchProjectInvitations,
  getPendingInvitationsForUser as fetchPendingInvitations,
} from '@/lib/actions/invitations';
import { getProjectPhotos as fetchProjectPhotos } from '@/lib/actions/photos';

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
      changeOrders: projectId ? store.getChangeOrders(projectId) : [],
    }),
    () =>
      projectId
        ? fetchDashboardData(projectId)
        : Promise.resolve({
            data: { submittals: [], rfis: [], punchListItems: [], dailyLogs: [], milestones: [], changeOrders: [] },
          }),
    [projectId],
    { submittals: [], rfis: [], punchListItems: [], dailyLogs: [], milestones: [], changeOrders: [] },
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

export function useChangeOrders(projectId: string | null) {
  return useQuery<ChangeOrder[]>(
    () => (projectId ? store.getChangeOrders(projectId) : []),
    () => (projectId ? fetchChangeOrders(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useModifications(projectId: string | null) {
  return useQuery<Modification[]>(
    () => (projectId ? store.getModifications(projectId) : []),
    () => (projectId ? fetchModifications(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useModificationDetail(projectId: string, modificationId: string) {
  return useQuery<Modification | null>(
    () => store.getModificationById(modificationId),
    () => fetchModificationById(modificationId, projectId),
    [projectId, modificationId],
    null,
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

export function useWeeklyReports(projectId: string | null) {
  return useQuery<WeeklyReport[]>(
    () => (projectId ? store.getWeeklyReports(projectId) : []),
    () => (projectId ? fetchWeeklyReports(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useWeeklyReportDetail(projectId: string, reportId: string) {
  return useQuery<WeeklyReport | null>(
    () => store.getWeeklyReportById(reportId),
    () => fetchWeeklyReportById(reportId, projectId),
    [projectId, reportId],
    null,
  );
}

export function useQCQAReports(projectId: string | null) {
  return useQuery<QCQAReport[]>(
    () => (projectId ? store.getQCQAReports(projectId) : []),
    () => (projectId ? fetchQCQAReports(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useQCQAReportDetail(projectId: string, reportId: string) {
  return useQuery<QCQAReport | null>(
    () => store.getQCQAReportById(reportId),
    () => fetchQCQAReportById(reportId, projectId),
    [projectId, reportId],
    null,
  );
}

export function useProjectDocuments(projectId: string | null) {
  return useQuery<ProjectDocument[]>(
    () => (projectId ? store.getProjectDocuments(projectId) : []),
    () => (projectId ? fetchProjectDocuments(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useProjectDocumentDetail(projectId: string, documentId: string) {
  return useQuery<ProjectDocument | null>(
    () => store.getProjectDocumentById(documentId),
    () => fetchProjectDocumentById(documentId, projectId),
    [projectId, documentId],
    null,
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

export function useProjectPhotos(projectId: string | null) {
  return useQuery<Attachment[]>(
    () => (projectId ? store.getAllProjectPhotos(projectId) : []),
    () => (projectId ? fetchProjectPhotos(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}
