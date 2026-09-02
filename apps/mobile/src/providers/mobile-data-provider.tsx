import type { MobileBootstrap } from '@railcommand/domain';
import { MobileApiError } from '@railcommand/api-client';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { mobileApiForUser } from '@/lib/api';
import { bootstrapForProject } from '@/lib/bootstrap-scope';
import { captureOfflineScope } from '@/lib/storage-scope';
import { createRequestDeduper } from '@/lib/request-deduper';
import { cacheBootstrap, listExpoSyncRows, readCachedBootstrap, type ExpoSyncRow } from '@/lib/offline-store';
import { synchronizeExpoOutbox } from '@/lib/sync';
import { useAuth } from './auth-provider';

type MobileDataContextValue = {
  bootstrap: MobileBootstrap | null;
  activeProjectId: string | null;
  online: boolean;
  loading: boolean;
  message: string;
  syncRows: ExpoSyncRow[];
  refresh(projectId?: string): Promise<void>;
  selectProject(projectId: string): Promise<void>;
  synchronize(): Promise<void>;
  reloadSyncRows(): Promise<void>;
};

const MobileDataContext = createContext<MobileDataContextValue | null>(null);
const bootstrapRefreshInterval = 60_000;

export function MobileDataProvider({ children }: PropsWithChildren) {
  const { session, sessionRevision, isSessionCurrent } = useAuth();
  const userId = session?.user.id ?? null;
  const current = useCallback(() => isSessionCurrent(userId, sessionRevision), [isSessionCurrent, sessionRevision, userId]);
  // State and locks never cross an account lifetime, even for A -> B -> A.
  return <SessionMobileDataProvider key={sessionRevision} userId={userId} isSessionCurrent={current}>{children}</SessionMobileDataProvider>;
}

function SessionMobileDataProvider({ children, userId, isSessionCurrent }: PropsWithChildren<{
  userId: string | null;
  isSessionCurrent: () => boolean;
}>) {
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const onlineRef = useRef(true);
  const [loading, setLoading] = useState(Boolean(userId));
  const [message, setMessage] = useState('Opening saved field data…');
  const [syncRows, setSyncRows] = useState<ExpoSyncRow[]>([]);
  const cachedBootstrapRef = useRef<MobileBootstrap | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const syncPromiseRef = useRef<{ promise: Promise<void>; isCurrent: () => boolean } | null>(null);
  const requestIdRef = useRef(0);
  const syncRowsReloadIdRef = useRef(0);
  const loadDeduperRef = useRef(createRequestDeduper());
  const lifetime = useRef({ current: true });

  useEffect(() => {
    if (!lifetime.current.current) lifetime.current = { current: true };
    const mounted = lifetime.current;
    return () => { mounted.current = false; };
  }, []);

  const captureCurrent = useCallback(() => {
    const mounted = lifetime.current;
    const offlineCurrent = userId ? captureOfflineScope(userId) : () => true;
    return () => mounted.current && isSessionCurrent() && offlineCurrent();
  }, [isSessionCurrent, userId]);

  const applyBootstrap = useCallback((next: MobileBootstrap) => {
    activeProjectIdRef.current = next.activeProjectId;
    setBootstrap(next);
    setActiveProjectId(next.activeProjectId);
  }, []);

  const reloadSyncRows = useCallback(async () => {
    if (!userId) return;
    const ownerCurrent = captureCurrent();
    const reloadId = ++syncRowsReloadIdRef.current;
    const isCurrent = () => ownerCurrent() && reloadId === syncRowsReloadIdRef.current;
    try {
      const rows = await listExpoSyncRows(userId, isCurrent);
      if (isCurrent()) setSyncRows(rows);
    } catch {
      if (isCurrent()) setMessage('Device queue could not be read. Saved work has not been discarded.');
    }
  }, [captureCurrent, userId]);

  const loadProject = useCallback((projectId?: string, showSaved = false, required = false, force = false): Promise<void> => {
    const requestKey = `bootstrap:${projectId ?? activeProjectIdRef.current ?? 'active'}`;
    return loadDeduperRef.current.run(requestKey, async () => {
    if (!userId) {
      if (required) throw new Error('Sign in before opening a project.');
      return;
    }
    const ownerCurrent = captureCurrent();
    const requestId = ++requestIdRef.current;
    const isCurrent = () => ownerCurrent() && requestId === requestIdRef.current;
    if (!isCurrent()) return;
    const requestedProject = projectId ?? activeProjectIdRef.current ?? undefined;
    setLoading(true);

    const showCached = async (): Promise<{ available: boolean; fresh: boolean }> => {
      const cached = cachedBootstrapRef.current ?? await readCachedBootstrap(userId, isCurrent);
      if (!isCurrent() || !cached) return { available: false, fresh: false };
      const selected = bootstrapForProject(cached, userId, requestedProject ?? cached.activeProjectId);
      cachedBootstrapRef.current = cached;
      applyBootstrap(selected);
      setMessage('Showing saved device data');
      const synchronizedAt = Date.parse(cached.synchronizedAt);
      return { available: true, fresh: Number.isFinite(synchronizedAt) && synchronizedAt >= Date.now() - bootstrapRefreshInterval };
    };

    try {
      if (showSaved || (!force && cachedBootstrapRef.current)) {
        try {
          const cached = await showCached();
          if (!force && cached.fresh) {
            setMessage('Showing recently synchronized device data');
            return;
          }
        } catch { /* A missing cache must not prevent an online refresh. */ }
      }
      if (!isCurrent()) return;
      const next = await mobileApiForUser(userId, isCurrent).getBootstrap(requestedProject);
      if (!isCurrent()) return;
      const selected = bootstrapForProject(next, userId, requestedProject ?? next.activeProjectId);
      await cacheBootstrap(userId, next, isCurrent);
      if (!isCurrent()) return;
      cachedBootstrapRef.current = next;
      applyBootstrap(selected);
      setMessage('Synchronized ' + new Date(next.synchronizedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch (error) {
      if (!isCurrent()) return;
      let available = false;
      try { available = (await showCached()).available; } catch { /* Fail closed for missing/wrong-owner project data. */ }
      if (!isCurrent()) return;
      const status = error instanceof MobileApiError ? error.status : null;
      if (status !== null || onlineRef.current) {
        const failure = status === 401
          ? 'Refresh failed: the server could not verify your session. Please retry or contact support.'
          : status === 403
            ? 'Refresh failed: the server denied project access. Check your organization permissions or contact support.'
            : 'Project refresh failed. Check your connection and try again.';
        setMessage(failure + (available
          ? ' Showing saved device data.'
          : ' No saved project data is available on this device yet.'));
      } else if (!available) {
        setMessage(required ? 'That project is not available for this account.' : 'No saved project data is available on this device yet.');
      }
      if (!available && required) throw error;
    } finally {
      if (isCurrent()) setLoading(false);
    }
    }, force);
  }, [applyBootstrap, captureCurrent, userId]);

  const refresh = useCallback((projectId?: string) => loadProject(projectId, false, false, true), [loadProject]);
  const selectProject = useCallback((projectId: string) => loadProject(projectId, true, true), [loadProject]);

  const synchronize = useCallback(async () => {
    if (!userId) return;
    const isCurrent = captureCurrent();
    if (!isCurrent()) return;
    if (syncPromiseRef.current?.isCurrent()) return syncPromiseRef.current.promise;
    const requestAtStart = requestIdRef.current;
    const pending = (async () => {
      try {
        const network = await Network.getNetworkStateAsync();
        if (!isCurrent()) return;
        const reachable = network.isConnected === true && network.isInternetReachable !== false;
        onlineRef.current = reachable;
        setOnline(reachable);
        if (!reachable) {
          setMessage('Queued work remains safely on this device');
          await reloadSyncRows();
          return;
        }
        const count = await synchronizeExpoOutbox(userId, isCurrent);
        if (!isCurrent()) return;
        await reloadSyncRows();
        if (!isCurrent()) return;
        if (count > 0) setMessage('Synchronized ' + count + ' queued item' + (count === 1 ? '' : 's'));
        // A reconnect refresh must not overtake a newer explicit selection.
        if (requestIdRef.current === requestAtStart) {
          if (count > 0) await refresh();
          else await loadProject(activeProjectIdRef.current ?? undefined);
        }
      } catch {
        if (isCurrent()) setMessage('Synchronization paused. Queued work remains safely on this device.');
      }
    })();
    syncPromiseRef.current = { promise: pending, isCurrent };
    try { await pending; } finally {
      if (syncPromiseRef.current?.promise === pending) syncPromiseRef.current = null;
    }
  }, [captureCurrent, loadProject, refresh, reloadSyncRows, userId]);

  useEffect(() => {
    if (userId) void Promise.all([loadProject(undefined, true), reloadSyncRows()]);
  }, [loadProject, reloadSyncRows, userId]);

  useEffect(() => {
    // Only each dispatched operation captures the storage generation. The
    // listener itself must survive a completed same-account cache purge.
    const mounted = lifetime.current;
    const current = () => mounted.current && isSessionCurrent();
    const network = Network.addNetworkStateListener((state) => {
      if (!current()) return;
      const reachable = state.isConnected === true && state.isInternetReachable !== false;
      onlineRef.current = reachable;
      setOnline(reachable);
      if (reachable && userId) void synchronize();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (current() && state === 'active' && userId) void synchronize();
    });
    return () => { network.remove(); appState.remove(); };
  }, [isSessionCurrent, synchronize, userId]);

  const value = useMemo<MobileDataContextValue>(() => ({ bootstrap, activeProjectId, online, loading, message, syncRows,
    refresh, selectProject, synchronize, reloadSyncRows }), [activeProjectId, bootstrap, loading, message, online, refresh, reloadSyncRows, selectProject, syncRows, synchronize]);
  return <MobileDataContext.Provider value={value}>{children}</MobileDataContext.Provider>;
}

export function useMobileData() {
  const value = useContext(MobileDataContext);
  if (!value) throw new Error('useMobileData must be used inside MobileDataProvider');
  return value;
}
