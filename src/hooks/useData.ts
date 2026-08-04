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
  EarthCamConnection,
  EarthCamCamera,
  EarthCamEvidence,
  EarthCamEmbed,
} from '@/lib/types';

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
import {
  getEarthCamEmbeds as fetchEarthCamEmbeds,
  getEarthCamWorkspace as fetchEarthCamWorkspace,
} from '@/lib/actions/earthcam';
import type { EarthCamWorkspace } from '@/lib/actions/earthcam';
import { isRfiOverdue } from '@/lib/date-utils';

const DAILY_LOG_PAGE_SIZE = 500;
const EMPTY_DASHBOARD_METRICS: DashboardData['metrics'] = {
  totalSubmittals: 0,
  pendingSubmittals: 0,
  openRFIs: 0,
  overdueRFIs: 0,
  openPunch: 0,
  criticalPunch: 0,
  totalLogs: 0,
  lastLogDate: null,
  approvedChangeOrderTotal: 0,
  pendingChangeOrders: 0,
  earnedValue: 0,
};
type DemoStore = typeof import('@/lib/store');

function loadDemoStore(): Promise<DemoStore> {
  return import('@/lib/store');
}

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
  demoFn: (store: DemoStore) => T | Promise<T>,
  serverFn: () => Promise<{ data?: T; error?: string }>,
  deps: unknown[],
  initial: T,
): QueryResult<T> {
  const { isDemo } = useProject();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (isDemo) {
      loadDemoStore()
        .then((store) => demoFn(store))
        .then((demoData) => {
          if (cancelled) return;
          setData(demoData);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load demo data');
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    serverFn().then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else if (result.data !== undefined) {
        setData(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, [isDemo, ...deps]);

  useEffect(() => {
    return refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Domain hooks                                                       */
/* ------------------------------------------------------------------ */

export function useDashboardData(projectId: string | null) {
  return useQuery<DashboardData>(
    (store) => {
      const submittals = projectId ? store.getSubmittals(projectId) : [];
      const rfis = projectId ? store.getRFIs(projectId) : [];
      const punchListItems = projectId ? store.getPunchListItems(projectId) : [];
      const dailyLogs = projectId ? store.getDailyLogs(projectId) : [];
      const milestones = projectId ? store.getMilestones(projectId) : [];
      const changeOrders = projectId ? store.getChangeOrders(projectId) : [];
      const lastLog = [...dailyLogs].sort((a, b) => b.log_date.localeCompare(a.log_date))[0];

      return {
        metrics: {
          totalSubmittals: submittals.length,
          pendingSubmittals: submittals.filter((s) => s.status === 'submitted' || s.status === 'under_review').length,
          openRFIs: rfis.filter((r) => r.status === 'open' || r.status === 'overdue').length,
          overdueRFIs: rfis.filter(isRfiOverdue).length,
          openPunch: punchListItems.filter((p) => p.status === 'open' || p.status === 'in_progress').length,
          criticalPunch: punchListItems.filter(
            (p) => (p.status === 'open' || p.status === 'in_progress') && p.priority === 'critical',
          ).length,
          totalLogs: dailyLogs.length,
          lastLogDate: lastLog?.log_date ?? null,
          approvedChangeOrderTotal: changeOrders
            .filter((co) => co.status === 'approved')
            .reduce((sum, co) => sum + co.amount, 0),
          pendingChangeOrders: changeOrders.filter((co) => co.status === 'submitted' || co.status === 'draft').length,
          earnedValue: milestones.reduce(
            (sum, milestone) => sum + (milestone.budget_planned * milestone.percent_complete) / 100,
            0,
          ),
        },
      };
    },
    () =>
      projectId
        ? fetchDashboardData(projectId)
        : Promise.resolve({
            data: { metrics: EMPTY_DASHBOARD_METRICS },
          }),
    [projectId],
    { metrics: EMPTY_DASHBOARD_METRICS },
  );
}

export function useProjects() {
  return useQuery<Project[]>(
    (store) => store.getProjects(),
    () => fetchProjects(),
    [],
    [],
  );
}

export function useSubmittals(projectId: string | null) {
  return useQuery<Submittal[]>(
    (store) => (projectId ? store.getSubmittals(projectId) : []),
    () => (projectId ? fetchSubmittals(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useSubmittalDetail(projectId: string, submittalId: string) {
  return useQuery<Submittal | null>(
    (store) => store.getSubmittals(projectId).find((s) => s.id === submittalId) ?? null,
    () => fetchSubmittalById(projectId, submittalId),
    [projectId, submittalId],
    null,
  );
}

export function useRFIs(projectId: string | null) {
  return useQuery<RFI[]>(
    (store) => (projectId ? store.getRFIs(projectId) : []),
    () => (projectId ? fetchRFIs(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useRFIDetail(projectId: string, rfiId: string) {
  return useQuery<RFI | null>(
    (store) => store.getRFIs(projectId).find((r) => r.id === rfiId) ?? null,
    () => fetchRFIById(projectId, rfiId),
    [projectId, rfiId],
    null,
  );
}

export function useDailyLogs(projectId: string | null) {
  const { isDemo } = useProject();
  const [data, setData] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!projectId) {
        setData([]);
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setHasMore(false);
        return;
      }

      if (isDemo) {
        const store = await loadDemoStore();
        setData(store.getDailyLogs(projectId));
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setHasMore(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await fetchDailyLogs(projectId, {
        offset,
        limit: DAILY_LOG_PAGE_SIZE,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setData((current) => (append ? [...current, ...result.data!] : result.data!));
        setHasMore(result.data.length === DAILY_LOG_PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [isDemo, projectId],
  );

  const refetch = useCallback(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    void loadPage(data.length, true);
  }, [data.length, hasMore, loadPage, loadingMore]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, hasMore, loadingMore, loadMore };
}

export function useDailyLogDetail(projectId: string, logId: string) {
  return useQuery<DailyLog | null>(
    (store) => store.getDailyLogs(projectId).find((d) => d.id === logId) ?? null,
    () => fetchDailyLogById(projectId, logId),
    [projectId, logId],
    null,
  );
}

export function usePunchListItems(projectId: string | null) {
  return useQuery<PunchListItem[]>(
    (store) => (projectId ? store.getPunchListItems(projectId) : []),
    () => (projectId ? fetchPunchList(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function usePunchListDetail(projectId: string, itemId: string) {
  return useQuery<PunchListItem | null>(
    (store) => store.getPunchListItems(projectId).find((p) => p.id === itemId) ?? null,
    () => fetchPunchListById(projectId, itemId),
    [projectId, itemId],
    null,
  );
}

export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMember[]>(
    (store) => store.getProjectMembers(projectId),
    () => fetchMembers(projectId),
    [projectId],
    [],
  );
}

export function useMilestones(projectId: string) {
  return useQuery<Milestone[]>(
    (store) => store.getMilestones(projectId),
    () => fetchMilestones(projectId),
    [projectId],
    [],
  );
}

export function useChangeOrders(projectId: string | null) {
  return useQuery<ChangeOrder[]>(
    (store) => (projectId ? store.getChangeOrders(projectId) : []),
    () => (projectId ? fetchChangeOrders(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useModifications(projectId: string | null) {
  return useQuery<Modification[]>(
    (store) => (projectId ? store.getModifications(projectId) : []),
    () => (projectId ? fetchModifications(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useModificationDetail(projectId: string, modificationId: string) {
  return useQuery<Modification | null>(
    (store) => store.getModificationById(modificationId),
    () => fetchModificationById(modificationId, projectId),
    [projectId, modificationId],
    null,
  );
}

export function useActivityLog(projectId: string, limit?: number) {
  return useQuery<ActivityLogEntry[]>(
    (store) => store.getActivityLog(projectId).slice(0, limit),
    () => fetchActivity(projectId, limit),
    [projectId, limit],
    [],
  );
}

export function useSafetyIncidents(projectId: string | null) {
  return useQuery<SafetyIncident[]>(
    (store) => (projectId ? store.getSafetyIncidents(projectId) : []),
    () => (projectId ? fetchSafetyIncidents(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useSafetyIncidentDetail(projectId: string, incidentId: string) {
  return useQuery<SafetyIncident | null>(
    (store) => store.getSafetyIncidentById(incidentId),
    () => fetchSafetyIncident(incidentId, projectId),
    [projectId, incidentId],
    null,
  );
}

export function useProjectInvitations(projectId: string) {
  return useQuery<ProjectInvitation[]>(
    (store) => store.getProjectInvitations(projectId),
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
    (store) => (projectId ? store.getWeeklyReports(projectId) : []),
    () => (projectId ? fetchWeeklyReports(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useWeeklyReportDetail(projectId: string, reportId: string) {
  return useQuery<WeeklyReport | null>(
    (store) => store.getWeeklyReportById(reportId),
    () => fetchWeeklyReportById(reportId, projectId),
    [projectId, reportId],
    null,
  );
}

export function useQCQAReports(projectId: string | null) {
  return useQuery<QCQAReport[]>(
    (store) => (projectId ? store.getQCQAReports(projectId) : []),
    () => (projectId ? fetchQCQAReports(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useQCQAReportDetail(projectId: string, reportId: string) {
  return useQuery<QCQAReport | null>(
    (store) => store.getQCQAReportById(reportId),
    () => fetchQCQAReportById(reportId, projectId),
    [projectId, reportId],
    null,
  );
}

export function useProjectDocuments(projectId: string | null) {
  return useQuery<ProjectDocument[]>(
    (store) => (projectId ? store.getProjectDocuments(projectId) : []),
    () => (projectId ? fetchProjectDocuments(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useProjectDocumentDetail(projectId: string, documentId: string) {
  return useQuery<ProjectDocument | null>(
    (store) => store.getProjectDocumentById(documentId),
    () => fetchProjectDocumentById(documentId, projectId),
    [projectId, documentId],
    null,
  );
}

export function usePendingInvitations() {
  return useQuery<ProjectInvitation[]>(
    (store) => store.getUserInvitations('demo@railcommand.io'),
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
    (store) => (projectId ? store.getAllProjectPhotos(projectId) : []),
    () => (projectId ? fetchProjectPhotos(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useEarthCamWorkspace(projectId: string | null) {
  return useQuery<EarthCamWorkspace>(
    (store) => ({
      connection: store.getEarthCamConnection(),
      cameras: projectId ? store.getEarthCamCameras(projectId) : [],
      evidence: projectId ? store.getEarthCamEvidence(projectId) : [],
    }),
    () =>
      projectId
        ? fetchEarthCamWorkspace(projectId)
        : Promise.resolve({
            data: {
              connection: null as EarthCamConnection | null,
              cameras: [] as EarthCamCamera[],
              evidence: [] as EarthCamEvidence[],
            },
          }),
    [projectId],
    { connection: null, cameras: [], evidence: [] },
  );
}

export function useEarthCamEmbeds(projectId: string | null) {
  return useQuery<EarthCamEmbed[]>(
    (store) => (projectId ? store.getEarthCamEmbeds(projectId) : []),
    () => (projectId ? fetchEarthCamEmbeds(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}
