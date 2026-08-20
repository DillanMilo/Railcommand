import { useCallback, useEffect, useMemo, useState } from 'react';
import { Network } from '@capacitor/network';
import type { Session } from '@supabase/supabase-js';
import { MobileApiClient } from '@railcommand/api-client';
import {
  createMobileDraft,
  draftToSyncOperation,
  type MobileBootstrap,
  type MobileDailyLogDraft,
  type MobileDeepLink,
} from '@railcommand/domain';
import {
  cacheMobileBootstrap,
  clearMobileUserData,
  initializeMobileOfflineStorage,
  inspectUnsyncedMobileWork,
  listMobilePhotos,
  persistMobilePhoto,
  queueMobileDraft,
  readCachedMobileBootstrap,
  readMobileDraft,
  saveMobileDraft,
} from '@railcommand/offline';
import { mobileConfig } from './config';
import { registerMobileDeepLinks } from './deep-links';
import { supabase } from './supabase';
import { synchronizeMobileOutbox } from './sync';

const EMPTY_DRAFT = {
  logDate: new Date().toISOString().slice(0, 10),
  weatherConditions: '',
  workSummary: '',
  safetyNotes: '',
};

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MobileDailyLogDraft | null>(null);
  const [draftValues, setDraftValues] = useState(EMPTY_DRAFT);
  const [draftDirty, setDraftDirty] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Restoring secure session…');
  const [discardArmed, setDiscardArmed] = useState(false);

  const api = useMemo(() => new MobileApiClient({
    baseUrl: mobileConfig.apiBaseUrl,
    getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  }), []);

  const loadProject = useCallback(async (userId: string, projectId?: string) => {
    await initializeMobileOfflineStorage(userId);
    const cached = await readCachedMobileBootstrap(userId);
    if (cached) {
      setBootstrap(cached.value);
      setActiveProjectId(projectId ?? cached.value.activeProjectId);
      setMessage(cached.stale ? 'Showing stale device data' : 'Showing saved device data');
    }
    if (!navigator.onLine) return;
    try {
      const fresh = await api.getBootstrap(projectId);
      await cacheMobileBootstrap(userId, fresh);
      setBootstrap(fresh);
      setActiveProjectId(fresh.activeProjectId);
      setMessage('Synchronized with staging');
    } catch (error) {
      setMessage(cached ? 'Refresh failed; saved device data remains available' : String(error));
    }
  }, [api]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted || !data.session) {
        if (mounted) setMessage('Sign in to staging');
        return;
      }
      const { data: validated } = await supabase.auth.getUser(data.session.access_token);
      if (!mounted) return;
      if (!validated.user) {
        await supabase.auth.signOut({ scope: 'local' });
        setMessage('Session expired; sign in again');
        return;
      }
      setSession(data.session);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let remove: (() => Promise<void>) | undefined;
    void registerMobileDeepLinks((link: MobileDeepLink) => {
      if (!active) return;
      if (link.kind === 'project' || link.kind === 'daily_log') {
        setActiveProjectId(link.projectId);
        if (session?.user.id) void loadProject(session.user.id, link.projectId);
      }
      setMessage(link.kind === 'unsupported' ? 'Unsupported RailCommand link' : `Opened ${link.kind}`);
    }).then((handle) => { remove = () => handle.remove(); });
    return () => { active = false; void remove?.(); };
  }, [loadProject, session?.user.id]);

  useEffect(() => {
    let remove: (() => Promise<void>) | undefined;
    void Network.getStatus().then((status) => setOnline(status.connected));
    void Network.addListener('networkStatusChange', (status) => {
      setOnline(status.connected);
      if (status.connected && session?.user.id) {
        void synchronizeMobileOutbox(session.user.id, api).then(({ synchronized }) => {
          if (synchronized) setMessage(`Synchronized ${synchronized} queued item(s)`);
        });
      }
    }).then((handle) => { remove = () => handle.remove(); });
    return () => { void remove?.(); };
  }, [api, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      setBootstrap(null);
      setActiveProjectId(null);
      return;
    }
    void loadProject(session.user.id);
  }, [loadProject, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !activeProjectId) return;
    void readMobileDraft(session.user.id, activeProjectId).then(async (saved) => {
      setDraft(saved);
      setDraftDirty(false);
      setDraftValues(saved ? {
        logDate: saved.logDate,
        weatherConditions: saved.weatherConditions,
        workSummary: saved.workSummary,
        safetyNotes: saved.safetyNotes,
      } : { ...EMPTY_DRAFT, logDate: new Date().toISOString().slice(0, 10) });
      const photos = await listMobilePhotos(session.user.id, `daily-log:${activeProjectId}`);
      setPhotoCount(photos.length);
    });
  }, [activeProjectId, session?.user.id]);

  useEffect(() => {
    if (!draftDirty || !session?.user.id || !activeProjectId) return;
    const timeout = window.setTimeout(() => {
      const next = createMobileDraft(activeProjectId, draftValues, draft);
      setDraftDirty(false);
      void saveMobileDraft(session.user.id, next).then(() => {
        setDraft(next);
        setMessage('Draft saved on this device');
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [activeProjectId, draft, draftDirty, draftValues, session?.user.id]);

  const editDraft = (values: typeof EMPTY_DRAFT) => {
    setDraftValues(values);
    setDraftDirty(true);
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('Signing in to staging…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword('');
    setMessage(error ? error.message : 'Signed in; restoring project data…');
  };

  const saveDraft = async (): Promise<MobileDailyLogDraft | null> => {
    if (!session?.user.id || !activeProjectId) return null;
    const next = createMobileDraft(activeProjectId, draftValues, draft);
    await saveMobileDraft(session.user.id, next);
    setDraft(next);
    setDraftDirty(false);
    setMessage('Draft saved on this device');
    return next;
  };

  const addPhoto = async (file: File | undefined) => {
    if (!file || !session?.user.id || !activeProjectId) return;
    const savedDraft = await saveDraft();
    if (!savedDraft) return;
    await persistMobilePhoto(session.user.id, {
      photoId: crypto.randomUUID(),
      draftId: savedDraft.draftId,
      projectId: activeProjectId,
      fileName: file.name,
      fileType: file.type || 'image/jpeg',
      size: file.size,
      capturedAt: new Date().toISOString(),
      blob: file,
    });
    setPhotoCount((count) => count + 1);
    setMessage('Photo persisted on this device');
  };

  const queueAndSync = async () => {
    if (!session?.user.id) return;
    const savedDraft = await saveDraft();
    if (!savedDraft) return;
    await queueMobileDraft(session.user.id, draftToSyncOperation(session.user.id, savedDraft));
    setDraft(null);
    setDraftDirty(false);
    setMessage(online ? 'Queued; synchronizing…' : 'Queued until connectivity returns');
    if (online) {
      const result = await synchronizeMobileOutbox(session.user.id, api);
      setMessage(result.synchronized ? 'Daily log synchronized' : 'Synchronization needs attention');
      if (result.synchronized) await loadProject(session.user.id, activeProjectId ?? undefined);
    }
  };

  const safeSignOut = async (discard = false) => {
    if (!session?.user.id) return;
    const work = await inspectUnsyncedMobileWork(session.user.id);
    const total = work.drafts + work.operations + work.photos;
    if (total && !discard) {
      setDiscardArmed(false);
      setMessage(`${total} unsynchronized item(s) remain. Synchronize or explicitly discard them.`);
      return;
    }
    if (discard && !discardArmed) {
      setDiscardArmed(true);
      setMessage('Press discard again to permanently remove this user’s device data.');
      return;
    }
    await clearMobileUserData(session.user.id);
    await supabase.auth.signOut({ scope: 'local' });
    setDiscardArmed(false);
    setMessage('Signed out; this user’s device database was removed');
  };

  if (!session) {
    return <main className="shell auth-shell">
      <section className="panel auth-panel">
        <img src="./railcommand-mark.svg" className="brand-mark" alt="RailCommand" />
        <p className="eyebrow">MOBILE ARCHITECTURE SPIKE</p>
        <h1>RailCommand</h1>
        <p className="muted">Staging only. No production data is available to this build.</p>
        <form onSubmit={signIn}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button type="submit">Sign in securely</button>
        </form>
        <p className="status">{message}</p>
      </section>
    </main>;
  }

  const projects = bootstrap?.projects ?? [];
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  return <main className="shell">
    <header>
      <div><p className="eyebrow">RAILCOMMAND DEVELOPMENT</p><h1>{activeProject?.name ?? 'Mobile spike'}</h1></div>
      <span className={online ? 'pill online' : 'pill offline'}>{online ? 'Online' : 'Offline'}</span>
    </header>
    <p className="status" aria-live="polite">{message}</p>

    <section className="panel">
      <h2>Project</h2>
      <select value={activeProjectId ?? ''} onChange={(event) => {
        setActiveProjectId(event.target.value);
        void loadProject(session.user.id, event.target.value);
      }}>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <p className="muted">{activeProject?.location || 'No location'} · {activeProject?.role || 'No role'}</p>
    </section>

    <section className="panel">
      <h2>Cached daily logs</h2>
      {!bootstrap?.dailyLogs.length && <p className="muted">No synchronized logs in the device cache.</p>}
      <ul className="log-list">{bootstrap?.dailyLogs.map((log) =>
        <li key={log.id}><strong>{log.logDate}</strong><span>{log.workSummary || 'No summary'}</span></li>
      )}</ul>
    </section>

    <section className="panel">
      <h2>Offline daily-log draft</h2>
      <label>Date<input type="date" value={draftValues.logDate} onChange={(event) => editDraft({ ...draftValues, logDate: event.target.value })} /></label>
      <label>Weather<input value={draftValues.weatherConditions} onChange={(event) => editDraft({ ...draftValues, weatherConditions: event.target.value })} /></label>
      <label>Work summary<textarea value={draftValues.workSummary} onChange={(event) => editDraft({ ...draftValues, workSummary: event.target.value })} /></label>
      <label>Safety notes<textarea value={draftValues.safetyNotes} onChange={(event) => editDraft({ ...draftValues, safetyNotes: event.target.value })} /></label>
      <label className="file-button">Capture or attach photo
        <input type="file" accept="image/*" capture="environment" onChange={(event) => void addPhoto(event.target.files?.[0])} />
      </label>
      <p className="muted">Persisted photos: {photoCount}</p>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => void saveDraft()}>Save on device</button>
        <button type="button" onClick={() => void queueAndSync()}>Queue daily log</button>
      </div>
    </section>

    <section className="panel danger-zone">
      <h2>Safe sign-out</h2>
      <p className="muted">Sign-out checks drafts, queued work, and persisted photos before deleting this user’s isolated database.</p>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => void safeSignOut(false)}>Check and sign out</button>
        <button type="button" className="danger" onClick={() => void safeSignOut(true)}>{discardArmed ? 'Confirm permanent discard' : 'Discard local work'}</button>
      </div>
    </section>
  </main>;
}
