'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePWA } from '@/components/providers/ServiceWorkerProvider';

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
import {
  getEarthCamEmbeds as fetchEarthCamEmbeds,
  getEarthCamWorkspace as fetchEarthCamWorkspace,
} from '@/lib/actions/earthcam';
import type { EarthCamWorkspace } from '@/lib/actions/earthcam';
import {
  cacheDailyLogs,
  cacheProjectMembers,
  readCachedDailyLogs,
  readCachedProjectMembers,
} from '@/lib/offline/project-cache';
import { getActiveOfflineUserId } from '@/lib/offline/storage';

const DAILY_LOG_PAGE_SIZE = 500;

/* ------------------------------------------------------------------ */
/*  Generic query hook                                                 */
/* ------------------------------------------------------------------ */

interface QueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface OfflineReadState {
  dataSource: 'network' | 'cache' | 'demo';
  cachedAt: string | null;
  isCacheStale: boolean;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
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
  const { isDemo, currentUserId } = useProject();
  const { isOffline } = usePWA();
  const offlineUserId = currentUserId || getActiveOfflineUserId() || '';
  const [data, setData] = useState<DailyLog[]>(() => (isDemo && projectId ? store.getDailyLogs(projectId) : []));
  const dataRef = useRef(data);
  const loadedProjectRef = useRef(projectId);
  const [loading, setLoading] = useState(!isDemo);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dataSource, setDataSource] = useState<OfflineReadState['dataSource']>(
    isDemo ? 'demo' : 'network'
  );
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);

  const loadCachedLogs = useCallback(async (): Promise<boolean> => {
    if (!offlineUserId || !projectId) return false;
    const cached = await readCachedDailyLogs(offlineUserId, projectId).catch(() => null);
    if (!cached) return false;
    setData(cached.value);
    dataRef.current = cached.value;
    setDataSource('cache');
    setCachedAt(cached.cachedAt);
    setIsCacheStale(cached.isStale);
    setHasMore(false);
    setError(null);
    return true;
  }, [offlineUserId, projectId]);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (loadedProjectRef.current !== projectId) {
        loadedProjectRef.current = projectId;
        dataRef.current = [];
        setData([]);
      }

      if (!projectId) {
        setData([]);
        dataRef.current = [];
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setHasMore(false);
        return;
      }

      if (isDemo) {
        setData(store.getDailyLogs(projectId));
        dataRef.current = store.getDailyLogs(projectId);
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setHasMore(false);
        setDataSource('demo');
        setCachedAt(null);
        setIsCacheStale(false);
        return;
      }

      if (isOffline) {
        if (!append && !(await loadCachedLogs())) {
          setError('No saved daily logs are available for this project yet.');
        }
        setLoading(false);
        setLoadingMore(false);
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
        if (!append && !(await loadCachedLogs())) setError(result.error);
      } else if (result.data) {
        const nextData = append ? [...dataRef.current, ...result.data] : result.data;
        setData(nextData);
        dataRef.current = nextData;
        setHasMore(result.data.length === DAILY_LOG_PAGE_SIZE);
        setDataSource('network');
        setCachedAt(new Date().toISOString());
        setIsCacheStale(false);
        if (offlineUserId) {
          void cacheDailyLogs(offlineUserId, projectId, nextData).catch(() => {});
        }
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [isDemo, isOffline, loadCachedLogs, offlineUserId, projectId],
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

  useEffect(() => {
    const handleSynchronization = () => refetch();
    window.addEventListener('railcommand:sync-complete', handleSynchronization);
    return () => window.removeEventListener('railcommand:sync-complete', handleSynchronization);
  }, [refetch]);

  return {
    data,
    loading,
    error,
    refetch,
    hasMore,
    loadingMore,
    loadMore,
    dataSource,
    cachedAt,
    isCacheStale,
  };
}

export function useDailyLogDetail(projectId: string, logId: string) {
  const { isDemo, currentUserId } = useProject();
  const { isOffline } = usePWA();
  const offlineUserId = currentUserId || getActiveOfflineUserId() || '';
  const [data, setData] = useState<DailyLog | null>(() =>
    isDemo ? store.getDailyLogs(projectId).find((dailyLog) => dailyLog.id === logId) ?? null : null
  );
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<OfflineReadState['dataSource']>(
    isDemo ? 'demo' : 'network'
  );
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);

  const loadCachedLog = useCallback(async (): Promise<boolean> => {
    if (!offlineUserId) return false;
    const cached = await readCachedDailyLogs(offlineUserId, projectId).catch(() => null);
    const cachedLog = cached?.value.find((dailyLog) => dailyLog.id === logId) ?? null;
    if (!cached || !cachedLog) return false;
    setData(cachedLog);
    setDataSource('cache');
    setCachedAt(cached.cachedAt);
    setIsCacheStale(cached.isStale);
    setError(null);
    return true;
  }, [logId, offlineUserId, projectId]);

  const refetch = useCallback(async () => {
    if (isDemo) {
      setData(store.getDailyLogs(projectId).find((dailyLog) => dailyLog.id === logId) ?? null);
      setLoading(false);
      setError(null);
      setDataSource('demo');
      return;
    }

    setLoading(true);
    setError(null);
    if (isOffline) {
      if (!(await loadCachedLog())) setError('This daily log has not been saved for offline viewing.');
      setLoading(false);
      return;
    }

    const result = await fetchDailyLogById(projectId, logId);
    if (result.data) {
      const cacheSafeLog = { ...result.data, attachments: [] };
      setData(result.data);
      setDataSource('network');
      setCachedAt(new Date().toISOString());
      setIsCacheStale(false);
      if (offlineUserId) {
        const cached = await readCachedDailyLogs(offlineUserId, projectId).catch(() => null);
        const otherLogs = cached?.value.filter((dailyLog) => dailyLog.id !== logId) ?? [];
        void cacheDailyLogs(offlineUserId, projectId, [cacheSafeLog, ...otherLogs]).catch(() => {});
      }
    } else if (!(await loadCachedLog())) {
      setError(result.error ?? 'Failed to load daily log');
    }
    setLoading(false);
  }, [isDemo, isOffline, loadCachedLog, logId, offlineUserId, projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, dataSource, cachedAt, isCacheStale };
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
  const { isDemo, currentUserId } = useProject();
  const { isOffline } = usePWA();
  const offlineUserId = currentUserId || getActiveOfflineUserId() || '';
  const [data, setData] = useState<ProjectMember[]>(() =>
    isDemo ? store.getProjectMembers(projectId) : []
  );
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<OfflineReadState['dataSource']>(
    isDemo ? 'demo' : 'network'
  );
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);

  const loadCachedMembers = useCallback(async (): Promise<boolean> => {
    if (!offlineUserId) return false;
    const cached = await readCachedProjectMembers(offlineUserId, projectId).catch(() => null);
    if (!cached) return false;
    setData(cached.value);
    setDataSource('cache');
    setCachedAt(cached.cachedAt);
    setIsCacheStale(cached.isStale);
    setError(null);
    return true;
  }, [offlineUserId, projectId]);

  const refetch = useCallback(async () => {
    if (isDemo) {
      setData(store.getProjectMembers(projectId));
      setLoading(false);
      setError(null);
      setDataSource('demo');
      return;
    }

    setLoading(true);
    setError(null);
    if (isOffline) {
      if (!(await loadCachedMembers())) setError('No saved team reference is available.');
      setLoading(false);
      return;
    }

    const result = await fetchMembers(projectId);
    if (result.data) {
      setData(result.data);
      setDataSource('network');
      setCachedAt(new Date().toISOString());
      setIsCacheStale(false);
      if (offlineUserId) {
        void cacheProjectMembers(offlineUserId, projectId, result.data).catch(() => {});
      }
    } else if (!(await loadCachedMembers())) {
      setError(result.error ?? 'Failed to load project team');
    }
    setLoading(false);
  }, [isDemo, isOffline, loadCachedMembers, offlineUserId, projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, dataSource, cachedAt, isCacheStale };
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
    () => (projectId ? store.getSafetyIncidents(projectId) : []),
    () => (projectId ? fetchSafetyIncidents(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}

export function useSafetyIncidentDetail(projectId: string, incidentId: string) {
  return useQuery<SafetyIncident | null>(
    () => store.getSafetyIncidentById(incidentId),
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
    () => store.getUserInvitations('demo@railcommand.io'),
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

export function useEarthCamWorkspace(projectId: string | null) {
  return useQuery<EarthCamWorkspace>(
    () => ({
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
    () => (projectId ? store.getEarthCamEmbeds(projectId) : []),
    () => (projectId ? fetchEarthCamEmbeds(projectId) : Promise.resolve({ data: [] })),
    [projectId],
    [],
  );
}
