import type { MobileBootstrap } from '@railcommand/domain';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { mobileApi } from '@/lib/api';
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

export function MobileDataProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Opening saved field data…');
  const [syncRows, setSyncRows] = useState<ExpoSyncRow[]>([]);
  const activeProjectIdRef = useRef<string | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const syncRowsReloadIdRef = useRef(0);

  const updateActiveProject = useCallback((projectId: string | null) => {
    activeProjectIdRef.current = projectId;
    setActiveProjectId(projectId);
  }, []);

  const reloadSyncRows = useCallback(async () => {
    const reloadId = ++syncRowsReloadIdRef.current;
    if (!userId) {
      setSyncRows([]);
      return;
    }
    const rows = await listExpoSyncRows(userId);
    if (reloadId === syncRowsReloadIdRef.current) setSyncRows(rows);
  }, [userId]);

  const refresh = useCallback(async (projectId?: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const next = await mobileApi.getBootstrap(projectId ?? activeProjectIdRef.current ?? undefined);
      setBootstrap(next); updateActiveProject(next.activeProjectId); await cacheBootstrap(userId, next);
      setMessage(`Synchronized ${new Date(next.synchronizedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    } catch {
      const cached = await readCachedBootstrap(userId);
      if (cached) { setBootstrap(cached); updateActiveProject(projectId ?? cached.activeProjectId); setMessage('Showing saved device data'); }
      else setMessage('No saved project data is available on this device yet.');
    } finally { setLoading(false); }
  }, [updateActiveProject, userId]);

  const synchronize = useCallback(async () => {
    if (!userId) return;
    if (syncPromiseRef.current) return syncPromiseRef.current;
    const pending = (async () => {
      const network = await Network.getNetworkStateAsync();
      const reachable = network.isConnected === true && network.isInternetReachable !== false;
      setOnline(reachable);
      if (!reachable) { setMessage('Queued work remains safely on this device'); await reloadSyncRows(); return; }
      const count = await synchronizeExpoOutbox(userId);
      await reloadSyncRows();
      if (count > 0) setMessage(`Synchronized ${count} queued item${count === 1 ? '' : 's'}`);
      await refresh();
    })();
    syncPromiseRef.current = pending;
    try { await pending; } finally { syncPromiseRef.current = null; }
  }, [refresh, reloadSyncRows, userId]);

  useEffect(() => {
    if (!userId) { setBootstrap(null); setLoading(false); return; }
    let current = true;
    void (async () => {
      const cached = await readCachedBootstrap(userId);
      if (!current) return;
      if (cached) { setBootstrap(cached); updateActiveProject(cached.activeProjectId); }
      await Promise.all([refresh(), reloadSyncRows()]);
    })();
    return () => { current = false; };
  }, [refresh, reloadSyncRows, updateActiveProject, userId]);

  useEffect(() => {
    const network = Network.addNetworkStateListener((state) => {
      const reachable = state.isConnected === true && state.isInternetReachable !== false;
      setOnline(reachable); if (reachable && userId) void synchronize();
    });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active' && userId) void synchronize(); });
    return () => { network.remove(); appState.remove(); };
  }, [synchronize, userId]);

  const value = useMemo<MobileDataContextValue>(() => ({ bootstrap, activeProjectId, online, loading, message, syncRows,
    refresh, selectProject: async (projectId) => { updateActiveProject(projectId); await refresh(projectId); },
    synchronize, reloadSyncRows }), [activeProjectId, bootstrap, loading, message, online, refresh, reloadSyncRows, syncRows, synchronize, updateActiveProject]);
  return <MobileDataContext.Provider value={value}>{children}</MobileDataContext.Provider>;
}

export function useMobileData() {
  const value = useContext(MobileDataContext);
  if (!value) throw new Error('useMobileData must be used inside MobileDataProvider');
  return value;
}
