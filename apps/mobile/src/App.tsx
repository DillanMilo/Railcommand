import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera as NativeCamera, CameraErrorCode } from '@capacitor/camera';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  FolderKanban,
  ImagePlus,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPin,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MobileApiClient } from '@railcommand/api-client';
import {
  createMobileDraft,
  draftToSyncOperation,
  type MobileBootstrap,
  type MobileDailyLogDraft,
  type MobileDeepLink,
  type MobileGeoTag,
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
import {
  captureCurrentLocation,
  getConnectivity,
  haptic,
  onConnectivityChange,
  shareProjectLink,
} from './device-adapters';
import { initializeMobileChrome, registerForegroundLifecycle } from './device-lifecycle';
import { errorReporter } from './error-reporting';
import { captureNativePhoto, chooseNativePhoto, type MaterializedPhoto } from './photo';
import { registerAuthRefreshLifecycle, supabase } from './supabase';
import { synchronizeMobileOutbox } from './sync';

interface DraftValues {
  logDate: string;
  weatherConditions: string;
  workSummary: string;
  safetyNotes: string;
  geoTag: MobileGeoTag | null;
}

const EMPTY_DRAFT: DraftValues = {
  logDate: new Date().toISOString().slice(0, 10),
  weatherConditions: '',
  workSummary: '',
  safetyNotes: '',
  geoTag: null,
};

const MOBILE_SECTIONS = ['overview', 'logs', 'draft', 'account'] as const;
type MobileSection = (typeof MOBILE_SECTIONS)[number];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MobileDailyLogDraft | null>(null);
  const [draftValues, setDraftValues] = useState(EMPTY_DRAFT);
  const [draftDirty, setDraftDirty] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [draftFeedback, setDraftFeedback] = useState('No unsaved changes');
  const [photoFeedback, setPhotoFeedback] = useState('No photos saved on this device');
  const [locationFeedback, setLocationFeedback] = useState('No location attached');
  const [cameraStatus, setCameraStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [online, setOnline] = useState(navigator.onLine);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Restoring secure session…');
  const [discardArmed, setDiscardArmed] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [activeSection, setActiveSection] = useState<MobileSection>('overview');
  const queueingRef = useRef(false);

  const api = useMemo(() => new MobileApiClient({
    baseUrl: mobileConfig.apiBaseUrl,
    getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  }), []);

  const loadProject = useCallback(async (userId: string, projectId?: string) => {
    let cached: Awaited<ReturnType<typeof readCachedMobileBootstrap>> = null;
    try {
      await initializeMobileOfflineStorage(userId);
      cached = await readCachedMobileBootstrap(userId);
      if (cached) {
        setBootstrap(cached.value);
        setActiveProjectId(projectId ?? cached.value.activeProjectId);
        setMessage(cached.stale ? 'Showing stale device data' : 'Showing saved device data');
      }
    } catch {
      setMessage('Device cache unavailable; refreshing from staging…');
    }

    // WKWebView's navigator.onLine can disagree with Capacitor Network. Always
    // attempt the guarded bootstrap; a real connection failure keeps cached data.
    try {
      const fresh = await api.getBootstrap(projectId);
      await cacheMobileBootstrap(userId, fresh);
      setBootstrap(fresh);
      setActiveProjectId(fresh.activeProjectId);
      setMessage('Synchronized with staging');
    } catch (error) {
      errorReporter.capture(error, { area: 'bootstrap', operation: 'refresh' });
      setMessage(cached ? 'Refresh failed; saved device data remains available' : String(error));
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    let removeChrome: (() => Promise<void>) | undefined;
    let removeAuth: (() => Promise<void>) | undefined;
    void initializeMobileChrome().then((lifecycle) => {
      if (!active) return void lifecycle.remove();
      removeChrome = () => lifecycle.remove();
    });
    void registerAuthRefreshLifecycle().then((handle) => {
      if (!active) return void handle?.remove();
      removeAuth = handle ? () => handle.remove() : undefined;
    });
    return () => {
      active = false;
      void removeChrome?.();
      void removeAuth?.();
    };
  }, []);

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
        setActiveSection(link.kind === 'daily_log' ? 'logs' : 'overview');
        if (session?.user.id) void loadProject(session.user.id, link.projectId);
      }
      setMessage(link.kind === 'unsupported' ? 'Unsupported RailCommand link' : `Opened ${link.kind}`);
    }, (error) => {
      errorReporter.capture(error, { area: 'auth', operation: 'deep-link callback' });
      setMessage('The sign-in link could not be completed. Request a new link and try again.');
    }).then((handle) => { remove = () => handle.remove(); });
    return () => { active = false; void remove?.(); };
  }, [loadProject, session?.user.id]);

  useEffect(() => {
    let active = true;
    let synchronizing = false;
    let removeNetwork: (() => Promise<void>) | undefined;
    let removeForeground: (() => Promise<void>) | undefined;
    const synchronizeAndRefresh = async () => {
      if (!session?.user.id || synchronizing) return;
      synchronizing = true;
      let syncMessage: string | null = null;
      try {
        const { synchronized, failed } = await synchronizeMobileOutbox(session.user.id, api);
        if (synchronized) syncMessage = `Synchronized ${synchronized} queued item(s)`;
        if (failed) syncMessage = `${failed} queued item(s) need attention; device work remains saved`;
      } catch (error) {
        errorReporter.capture(error, { area: 'sync', operation: 'foreground drain' });
        syncMessage = 'Synchronization paused; queued work remains saved on this device';
      } finally {
        if (active) await loadProject(session.user.id, activeProjectId ?? undefined);
        if (active && syncMessage) setMessage(syncMessage);
        synchronizing = false;
      }
    };
    const updateConnectivity = (status: { connected: boolean }) => {
      if (!active) return;
      setOnline(status.connected);
      if (status.connected) void synchronizeAndRefresh();
    };
    void getConnectivity().then(updateConnectivity);
    void onConnectivityChange(updateConnectivity).then((handle) => {
      removeNetwork = () => handle.remove();
    });
    void registerForegroundLifecycle(async () => {
      const status = await getConnectivity();
      updateConnectivity(status);
      if (!status.connected && session?.user.id) {
        await loadProject(session.user.id, activeProjectId ?? undefined);
      }
    }).then((lifecycle) => { removeForeground = () => lifecycle.remove(); });
    return () => {
      active = false;
      void removeNetwork?.();
      void removeForeground?.();
    };
  }, [activeProjectId, api, loadProject, session?.user.id]);

  useEffect(() => {
    if (!session) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible && MOBILE_SECTIONS.includes(visible.target.id as MobileSection)) {
        setActiveSection(visible.target.id as MobileSection);
      }
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0.05, 0.4] });
    MOBILE_SECTIONS.forEach((section) => {
      const element = document.getElementById(section);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [session]);

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
    let active = true;
    void (async () => {
      try {
        const saved = await readMobileDraft(session.user.id, activeProjectId);
        if (!active) return;
        setDraft(saved);
        setDraftDirty(false);
        setDraftFeedback(saved ? 'Saved draft restored from this device' : 'No unsaved changes');
        setDraftValues(saved ? {
          logDate: saved.logDate,
          weatherConditions: saved.weatherConditions,
          workSummary: saved.workSummary,
          safetyNotes: saved.safetyNotes,
          geoTag: saved.geoTag ?? null,
        } : { ...EMPTY_DRAFT, logDate: new Date().toISOString().slice(0, 10) });
        setLocationFeedback(saved?.geoTag
          ? `Location attached · ±${Math.round(saved.geoTag.accuracy ?? 0)} m`
          : 'No location attached');
        const photos = saved
          ? await listMobilePhotos(
              session.user.id,
              `daily-log:${activeProjectId}`,
              saved.clientId,
            )
          : [];
        if (!active) return;
        setPhotoCount(photos.length);
        setPhotoFeedback(photos.length
          ? `${photos.length} photo${photos.length === 1 ? '' : 's'} persisted on this device`
          : 'No photos saved on this device');
      } catch (error) {
        errorReporter.capture(error, { area: 'offline', operation: 'restore draft and photos' });
        if (active) setMessage('Saved device work could not be opened. It has not been discarded.');
      }
    })();
    return () => { active = false; };
  }, [activeProjectId, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      setCameraStatus('checking');
      return;
    }
    let active = true;
    void NativeCamera.checkPermissions().then(() => {
      if (active) setCameraStatus('ready');
    }).catch((error) => {
      if (!active) return;
      const detail = error instanceof Error ? error.message : String(error);
      setCameraStatus('unavailable');
      setPhotoFeedback(`Camera unavailable: ${detail}`);
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!draftDirty || !session?.user.id || !activeProjectId) return;
    const timeout = window.setTimeout(() => {
      const next = createMobileDraft(activeProjectId, draftValues, draft);
      setDraftFeedback('Saving draft on this device…');
      void saveMobileDraft(session.user.id, next).then(() => {
        setDraft(next);
        setDraftDirty(false);
        setMessage('Draft saved on this device');
        setDraftFeedback('Saved on this device');
      }).catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        setMessage(`Draft could not be saved: ${detail}`);
        setDraftFeedback(`Save failed: ${detail}`);
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [activeProjectId, draft, draftDirty, draftValues, session?.user.id]);

  const editDraft = (values: DraftValues) => {
    setDraftValues(values);
    setDraftDirty(true);
    setDraftFeedback('Changes waiting to save…');
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
    try {
      setDraftFeedback('Saving draft on this device…');
      const next = createMobileDraft(activeProjectId, draftValues, draft);
      await saveMobileDraft(session.user.id, next);
      setDraft(next);
      setDraftDirty(false);
      setMessage('Draft saved on this device');
      setDraftFeedback('Saved on this device');
      return next;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Draft could not be saved: ${detail}`);
      setDraftFeedback(`Save failed: ${detail}`);
      return null;
    }
  };

  const persistPhoto = async (materialized: MaterializedPhoto): Promise<boolean> => {
    if (!session?.user.id || !activeProjectId) return false;
    try {
      const savedDraft = await saveDraft();
      if (!savedDraft) return false;
      setPhotoFeedback('Saving photo on this device…');
      const photoId = crypto.randomUUID();
      await persistMobilePhoto(session.user.id, {
        photoId,
        draftId: savedDraft.draftId,
        projectId: activeProjectId,
        parentClientId: savedDraft.clientId,
        fileName: materialized.fileName,
        fileType: materialized.fileType,
        size: materialized.size,
        capturedAt: new Date().toISOString(),
        geoTag: savedDraft.geoTag,
        blob: materialized.blob,
      });
      const persistedPhotos = await listMobilePhotos(
        session.user.id,
        savedDraft.draftId,
        savedDraft.clientId,
      );
      const nextCount = persistedPhotos.length;
      if (!persistedPhotos.some((photo) => photo.photoId === photoId)) {
        throw new Error('The photo could not be verified after saving');
      }
      setPhotoCount(nextCount);
      setPhotoFeedback(`${nextCount} photo${nextCount === 1 ? '' : 's'} persisted on this device`);
      setMessage('Photo persisted on this device');
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Photo could not be saved: ${detail}`);
      setPhotoFeedback(`Photo save failed: ${detail}`);
      return false;
    }
  };

  const capturePhoto = async () => {
    if (!session?.user.id) {
      setPhotoFeedback('Sign in before capturing a photo');
      return;
    }
    if (!activeProjectId) {
      setPhotoFeedback('Wait for a project to load before capturing a photo');
      return;
    }
    if (cameraStatus !== 'ready') {
      setPhotoFeedback(cameraStatus === 'unavailable'
        ? 'Camera is unavailable in this build'
        : 'Camera is still initializing; please try again');
      return;
    }
    setPhotoFeedback('Opening camera…');
    try {
      const materialized = await captureNativePhoto();
      setPhotoFeedback('Preparing captured photo…');
      const persisted = await persistPhoto(materialized);
      await haptic(persisted ? 'success' : 'warning');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';
      if (code === CameraErrorCode.TakePhotoCancelled) {
        setPhotoFeedback('Photo capture cancelled');
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Photo could not be captured: ${detail}`);
      setPhotoFeedback(`Photo capture failed: ${detail}`);
      await haptic('warning');
    }
  };

  const choosePhoto = async () => {
    if (!session?.user.id || !activeProjectId) {
      setPhotoFeedback('Wait for a signed-in project before selecting a photo');
      return;
    }
    setPhotoFeedback('Opening photo library…');
    try {
      const materialized = await chooseNativePhoto();
      setPhotoFeedback('Preparing selected photo…');
      const persisted = await persistPhoto(materialized);
      await haptic(persisted ? 'success' : 'warning');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errorReporter.capture(error, { area: 'device', operation: 'photo library' });
      setPhotoFeedback(`Photo library unavailable or cancelled: ${detail}. Your draft remains saved.`);
    }
  };

  const attachLocation = async () => {
    if (!session?.user.id || !activeProjectId) {
      setLocationFeedback('Wait for a signed-in project before attaching location');
      return;
    }
    setLocationFeedback('Checking location permission…');
    const result = await captureCurrentLocation();
    setLocationFeedback(result.message);
    if (result.status !== 'ok') {
      await haptic('warning');
      return;
    }
    editDraft({ ...draftValues, geoTag: result.value });
    setLocationFeedback(`Location attached · ±${Math.round(result.value.accuracy ?? 0)} m`);
    await haptic('success');
  };

  const removeLocation = async () => {
    editDraft({ ...draftValues, geoTag: null });
    setLocationFeedback('Location removed; the updated draft is waiting to save.');
    await haptic('selection');
  };

  const shareActiveProject = async () => {
    if (!activeProject) return;
    const result = await shareProjectLink(activeProject.id, activeProject.name);
    setMessage(result.message);
  };

  const queueAndSync = async () => {
    if (!session?.user.id || queueingRef.current) return;
    if (!draft && !draftDirty) {
      setMessage('Enter or restore a draft before queueing a daily log');
      return;
    }
    queueingRef.current = true;
    setQueueing(true);
    try {
      const savedDraft = await saveDraft();
      if (!savedDraft) return;
      await queueMobileDraft(session.user.id, draftToSyncOperation(session.user.id, savedDraft));
      setDraft(null);
      setDraftValues({ ...EMPTY_DRAFT, logDate: new Date().toISOString().slice(0, 10) });
      setDraftDirty(false);
      setLocationFeedback('No location attached');
      const queuedMessage = online ? 'Queued; synchronizing…' : 'Queued until connectivity returns';
      setDraftFeedback(queuedMessage);
      setMessage(queuedMessage);
      if (online) {
        const result = await synchronizeMobileOutbox(session.user.id, api);
        const syncMessage = result.synchronized ? 'Daily log synchronized' : 'Synchronization needs attention';
        setDraftFeedback(syncMessage);
        setMessage(syncMessage);
        if (result.synchronized) await loadProject(session.user.id, activeProjectId ?? undefined);
        await haptic(result.synchronized ? 'success' : 'warning');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errorReporter.capture(error, { area: 'offline', operation: 'queue daily log' });
      setDraftFeedback(`Queueing paused: ${detail}. Saved device work was not discarded.`);
      setMessage('Daily-log queueing needs attention; saved device work remains available.');
      await haptic('warning');
    } finally {
      queueingRef.current = false;
      setQueueing(false);
    }
  };

  const navigateTo = (section: MobileSection) => {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void haptic('selection');
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
    return <main className="auth-shell">
      <div className="auth-accent" aria-hidden="true" />
      <section className="auth-panel">
        <div className="auth-brand">
          <img src="./IMG_0936.jpg" className="brand-mark" alt="RailCommand" />
          <span>by A5 Rail</span>
        </div>
        <p className="eyebrow">Secure project access</p>
        <h1>Welcome back</h1>
        <p className="auth-intro">Sign in to continue to your projects</p>
        <form onSubmit={signIn}>
          <label>Email address<input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button type="submit" className="primary-button"><LockKeyhole size={17} /> Sign in securely <ArrowRight size={18} /></button>
        </form>
        <p className="status auth-status" aria-live="polite"><ShieldCheck size={15} />{message}</p>
        <p className="environment-note">{mobileConfig.environment} · v{mobileConfig.version} ({mobileConfig.buildNumber})</p>
      </section>
    </main>;
  }

  const projects = bootstrap?.projects ?? [];
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  return <main className="command-shell">
    <header className="mobile-topbar">
      <div className="project-switcher">
        <img src="./IMG_0936.jpg" alt="" />
        <div><span>Active project</span><strong>{activeProject?.name ?? 'RailCommand'}</strong></div>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      <div className="topbar-status">
        <span className="environment-pill">{mobileConfig.environment === 'production' ? 'Prod' : mobileConfig.environment}</span>
        <span className={online ? 'pill online' : 'pill offline'}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Online' : 'Offline'}</span>
      </div>
    </header>

    <div className="shell">
      <section className="page-heading">
        <p className="eyebrow">Project control · Mobile field log</p>
        <h1>{activeProject?.name ?? 'Mobile workspace'}</h1>
        <p className="status" aria-live="polite"><RefreshCw size={14} />{message}</p>
      </section>

    <section className="panel" id="overview">
      <div className="panel-header"><span className="panel-icon"><FolderKanban size={18} /></span><div><p className="eyebrow">Workspace</p><h2>Project</h2></div></div>
      <div className="select-wrap"><select aria-label="Active project" value={activeProjectId ?? ''} onChange={(event) => {
          setActiveProjectId(event.target.value);
          void loadProject(session.user.id, event.target.value);
        }}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select><ChevronDown size={16} aria-hidden="true" /></div>
      <p className="muted project-meta">{activeProject?.location || 'No location'} <span>·</span> {activeProject?.role || 'No role'}</p>
      <button type="button" className="secondary compact-action" disabled={!activeProject} onClick={() => void shareActiveProject()}><Share2 size={16} />Share project link</button>
    </section>

    <section className="panel" id="logs">
      <div className="panel-header"><span className="panel-icon"><ClipboardList size={18} /></span><div><p className="eyebrow">Saved for field access</p><h2>Cached daily logs</h2></div></div>
      {!bootstrap?.dailyLogs.length && <p className="muted">No synchronized logs in the device cache.</p>}
      <ul className="log-list">{bootstrap?.dailyLogs.map((log) =>
        <li key={log.id}><span className="log-date"><CalendarDays size={15} />{log.logDate}</span><strong>{log.workSummary || 'No summary'}</strong></li>
      )}</ul>
    </section>

    <section className="panel" id="draft">
      <div className="panel-header"><span className="panel-icon"><Save size={18} /></span><div><p className="eyebrow">Autosaved on this device</p><h2>Offline daily-log draft</h2></div></div>
      <label>Date<input type="date" value={draftValues.logDate} onChange={(event) => editDraft({ ...draftValues, logDate: event.target.value })} /></label>
      <label>Weather conditions<input placeholder="Clear, 72°F" value={draftValues.weatherConditions} onChange={(event) => editDraft({ ...draftValues, weatherConditions: event.target.value })} /></label>
      <label>Work summary<textarea placeholder="Describe today’s completed work…" value={draftValues.workSummary} onChange={(event) => editDraft({ ...draftValues, workSummary: event.target.value })} /></label>
      <label>Safety notes<textarea placeholder="Record observations or incidents…" value={draftValues.safetyNotes} onChange={(event) => editDraft({ ...draftValues, safetyNotes: event.target.value })} /></label>
      <div className="device-actions">
        <button type="button" className="file-button" onClick={() => void capturePhoto()}><Camera size={17} />Capture photo</button>
        <button type="button" className="file-button" onClick={() => void choosePhoto()}><ImagePlus size={17} />Photo library</button>
        <button type="button" className="file-button" onClick={() => void attachLocation()}><MapPin size={17} />{draftValues.geoTag ? 'Update location' : 'Attach location'}</button>
        {draftValues.geoTag && <button type="button" className="file-button" onClick={() => void removeLocation()}><MapPin size={17} />Remove location</button>}
      </div>
      <p className="inline-status" aria-live="polite">{photoFeedback} · Persisted photos: {photoCount} · Camera: {cameraStatus}</p>
      <p className="inline-status" aria-live="polite">{locationFeedback}</p>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => void saveDraft()}><Save size={17} />Save on device</button>
        <button type="button" className="primary-button" disabled={queueing || (!draft && !draftDirty)} onClick={() => void queueAndSync()}><CloudUpload size={17} />{queueing ? 'Queueing…' : 'Queue daily log'}</button>
      </div>
      <p className="inline-status" aria-live="polite">{draftFeedback}</p>
    </section>

    <section className="panel danger-zone" id="account">
      <div className="panel-header"><span className="panel-icon danger-icon"><LogOut size={18} /></span><div><p className="eyebrow">Device security</p><h2>Safe sign-out</h2></div></div>
      <p className="muted">Sign-out checks drafts, queued work, and persisted photos before deleting this user’s isolated database.</p>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => void safeSignOut(false)}><LogOut size={17} />Check and sign out</button>
        <button type="button" className="danger" onClick={() => void safeSignOut(true)}>{discardArmed ? 'Confirm permanent discard' : 'Discard local work'}</button>
      </div>
    </section>
    <p className="build-stamp">{mobileConfig.environment} · v{mobileConfig.version} ({mobileConfig.buildNumber}) · bundled shell</p>
    </div>

    <nav className="mobile-nav" aria-label="Primary navigation">
      <button type="button" className={activeSection === 'overview' ? 'active' : ''} aria-current={activeSection === 'overview' ? 'page' : undefined} onClick={() => navigateTo('overview')}><LayoutDashboard size={20} /><span>Overview</span></button>
      <button type="button" className={activeSection === 'logs' ? 'active' : ''} aria-current={activeSection === 'logs' ? 'page' : undefined} onClick={() => navigateTo('logs')}><ClipboardList size={20} /><span>Logs</span></button>
      <button type="button" className={activeSection === 'draft' ? 'active' : ''} aria-current={activeSection === 'draft' ? 'page' : undefined} onClick={() => navigateTo('draft')}><Save size={20} /><span>Draft</span></button>
      <button type="button" className={activeSection === 'account' ? 'active' : ''} aria-current={activeSection === 'account' ? 'page' : undefined} onClick={() => navigateTo('account')}><ShieldCheck size={20} /><span>Account</span></button>
    </nav>
  </main>;
}
