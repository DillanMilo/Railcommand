import type { MobileDailyLogDraft } from '@railcommand/domain';
import { createMobileDraft, draftToSyncOperation } from '@railcommand/domain';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, Field, PrimaryButton, Screen, SecondaryButton, StatusBanner, uiStyles } from '@/components/ui';
import { BreadcrumbRow, ModuleHeading, WebHeader } from '@/components/web-shell';
import { DailyLogFieldSections, DailyLogSection } from '@/components/daily-log-fields';
import { createDailyLogWriter, dailyLogStatusBanner, localDailyLogDate, prepareDailyLogEditor, validateDailyLogDate, type DailyLogNotice } from '@/lib/daily-log-editor';
import { attachCurrentLocation, captureFieldPhoto, confirmHaptic, deleteOwnedFieldPhoto, importFieldPhoto } from '@/lib/device';
import { mobileConfig } from '@/lib/config';
import { listExpoPhotos, queueExpoDraft, readExpoDraft, saveExpoDraft, saveExpoPhoto, type ExpoStoredPhoto } from '@/lib/offline-store';
import { PHOTO_STORAGE_MESSAGE } from '@/lib/photo-files';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function NewDailyLogScreen() {
  const { session } = useAuth();
  const { bootstrap, activeProjectId } = useMobileData();
  const userId = session?.user.id;
  const project = bootstrap?.userId === userId ? bootstrap?.projects.find((item) => item.id === activeProjectId) : null;
  if (!userId || !project?.canEdit) return <Screen><BrandHeader title="New daily log" /><StatusBanner title="Project edit access required" detail="Select a project with current edit access. Saved work from another account or project is not shown." /><SecondaryButton title="Back to logs" onPress={() => router.replace('/(tabs)/logs')} /></Screen>;
  return <DailyLogEditor key={`${userId}:${project.id}`} />;
}

function DailyLogEditor() {
  const { qaPermissions } = useLocalSearchParams<{ qaPermissions?: string }>();
  const { session } = useAuth();
  const { activeProjectId, bootstrap, online, reloadSyncRows, synchronize } = useMobileData();
  const userId = session?.user.id ?? null;
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const [draft, setDraft] = useState<MobileDailyLogDraft | null>(null);
  const [photos, setPhotos] = useState<ExpoStoredPhoto[]>([]);
  const [notice, setNotice] = useState<DailyLogNotice>({ kind: 'working', detail: 'Opening saved draft…' });
  const setStatus = useCallback((detail: string, kind: DailyLogNotice['kind']) => setNotice({ detail, kind }), []);
  const status = notice.detail;
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const navigation = useNavigation();
  const draftRef = useRef<MobileDailyLogDraft | null>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const queued = useRef(false);
  const revision = useRef(0);
  const writerRef = useRef<ReturnType<typeof createDailyLogWriter> | null>(null);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const persist = useCallback(async (value: MobileDailyLogDraft) => {
    if (!userId) throw new Error('Sign in before saving a draft.');
    writerRef.current ??= createDailyLogWriter((snapshot) => saveExpoDraft(userId, snapshot, () => alive.current && !queued.current));
    const savedRevision = revision.current;
    await writerRef.current(value);
    if (alive.current && savedRevision === revision.current) { setDirty(false); setStatus('Saved automatically on this device', 'saved'); }
  }, [userId, setStatus]);
  const permissionQaRan = useRef(false);

  useEffect(() => {
    if (!userId || !activeProjectId || !project?.canEdit) return;
    let current = true;
    setLoadFailed(false);
    void readExpoDraft(userId, activeProjectId).then(async (saved) => {
      if (!current) return;
      if (saved && saved.projectId !== activeProjectId) throw new Error('Saved project identity is invalid.');
      const initial = prepareDailyLogEditor(saved ?? createMobileDraft(activeProjectId, { logDate: localDailyLogDate(), weatherConditions: '', workSummary: '', safetyNotes: '' }, null, new Date(), Crypto.randomUUID), Crypto.randomUUID);
      await saveExpoDraft(userId, initial, () => current && alive.current);
      const storedPhotos = await listExpoPhotos(userId, initial.clientId);
      if (current) { draftRef.current = initial; setDraft(initial); setPhotos(storedPhotos); setStatus(saved ? 'Saved draft restored from this device' : 'Draft saved automatically on this device', 'saved'); }
    }).catch(() => { if (current) { setLoadFailed(true); setStatus('Could not open or save the device draft. Nothing was discarded. Check storage and retry.', 'save-error'); } });
    return () => { current = false; };
  }, [activeProjectId, userId, project?.canEdit, loadRetry, setStatus]);

  useEffect(() => {
    if (
      mobileConfig.profile !== 'development'
      || qaPermissions !== '1'
      || permissionQaRan.current
      || !userId
      || !draft
    ) return;
    permissionQaRan.current = true;
    busyRef.current = true; setBusy(true);
    void (async () => {
      let cameraResult = 'Camera permission did not deny as expected.';
      let locationResult = 'Location permission did not deny as expected.';
      try {
        const unexpectedPhoto = await captureFieldPhoto(userId, draft.projectId, draft.clientId, draft.geoTag);
        if (unexpectedPhoto) deleteOwnedFieldPhoto(userId, unexpectedPhoto);
      } catch (error) {
        cameraResult = error instanceof Error ? error.message : 'Camera permission check failed safely.';
      }
      try {
        await attachCurrentLocation();
      } catch (error) {
        locationResult = error instanceof Error ? error.message : 'Location permission check failed safely.';
      }
      if (!alive.current) return;
      const saved = await readExpoDraft(userId, draft.projectId);
      if (!alive.current) return;
      const draftResult = saved?.clientId === draft.clientId ? 'Draft preserved in SQLite.' : 'Draft persistence check failed.';
      const evidenceDirectory = new Directory(Paths.document, 'railcommand', userId, 'qa');
      evidenceDirectory.create({ idempotent: true, intermediates: true });
      new File(evidenceDirectory, 'permission-result.json').write(JSON.stringify({
        cameraResult,
        locationResult,
        draftResult,
        projectId: draft.projectId,
        clientId: draft.clientId,
        recordedAt: new Date().toISOString(),
      }));
      setStatus(`Permission QA · ${cameraResult} · ${locationResult} · ${draftResult}`, 'attention');
    })().catch(() => { if (alive.current) setStatus('Permission QA failed safely. The draft remains saved.', 'attention'); }).finally(() => { busyRef.current = false; if (alive.current) setBusy(false); });
  }, [draft, qaPermissions, userId, setStatus]);

  const update = useCallback((values: Partial<Pick<MobileDailyLogDraft, 'logDate' | 'weatherConditions' | 'workSummary' | 'safetyNotes' | 'geoTag' | 'fieldEntries'>>, allowBusy = false) => {
    const current = draftRef.current;
    if (!current || queued.current || (busyRef.current && !allowBusy) || !alive.current) return;
    const next = createMobileDraft(current.projectId, { logDate: values.logDate ?? current.logDate,
      weatherConditions: values.weatherConditions ?? current.weatherConditions, workSummary: values.workSummary ?? current.workSummary,
      safetyNotes: values.safetyNotes ?? current.safetyNotes, fieldEntries: values.fieldEntries ?? current.fieldEntries,
      ...(Object.hasOwn(values, 'geoTag') ? { geoTag: values.geoTag } : {}) }, current, new Date(), Crypto.randomUUID);
    revision.current += 1; const editedRevision = revision.current;
    draftRef.current = next; setDraft(next); setDirty(true); setStatus('Saving on this device…', 'saving');
    void persist(next).catch(() => { if (alive.current && revision.current === editedRevision) setStatus('Could not save. Keep this form open, check device storage, and retry Save draft.', 'save-error'); });
  }, [persist, setStatus]);

  usePreventRemove(dirty || busy, ({ data }) => {
    if (queued.current) { navigation.dispatch(data.action); return; }
    if (busyRef.current) { Alert.alert('Please wait', 'Finish the current photo, location, or queue operation before leaving.'); return; }
    const value = draftRef.current;
    if (value) void persist(value).then(() => { if (alive.current) navigation.dispatch(data.action); })
      .catch(() => { if (alive.current) Alert.alert('Draft not saved', 'The form was kept open. Check storage and retry Save draft.'); });
  });

  const takePhoto = async (source: 'camera' | 'library') => {
    if (!userId || !draft || busyRef.current) return;
    busyRef.current = true; setBusy(true); setStatus(source === 'camera' ? 'Opening camera…' : 'Opening photo library…', 'working');
    try {
      await persist(draft); if (!alive.current) return;
      const photo = source === 'camera'
        ? await captureFieldPhoto(userId, draft.projectId, draft.clientId, draft.geoTag)
        : await importFieldPhoto(userId, draft.projectId, draft.clientId, draft.geoTag);
      if (!alive.current) { if (photo) deleteOwnedFieldPhoto(userId, photo); return; }
      if (!photo) { setStatus('Photo selection canceled. Your draft remains saved.', 'saved'); return; }
      try { await saveExpoPhoto(userId, photo, () => alive.current); }
      catch { deleteOwnedFieldPhoto(userId, photo); throw new Error(PHOTO_STORAGE_MESSAGE); }
      if (alive.current) { setPhotos((current) => [...current, photo]); setStatus('Photo persisted on this device', 'saved'); await confirmHaptic(); }
    } catch (error) { if (alive.current) setStatus(error instanceof Error ? error.message : 'Photo unavailable. Your draft remains saved.', 'attention'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };

  const locate = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setStatus('Requesting a precise field location…', 'working');
    try {
      const geoTag = await attachCurrentLocation(); if (!alive.current) return;
      update({ geoTag }, true);
      if (draftRef.current) await persist(draftRef.current);
      if (alive.current) { setStatus('Location attached to this saved draft', 'saved'); await confirmHaptic(); }
    } catch (error) { if (alive.current) setStatus(error instanceof Error ? error.message : 'Location unavailable. Your draft remains saved.', 'attention'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };

  const submit = async () => {
    const current = draftRef.current;
    if (!userId || !current || busyRef.current || queued.current) return;
    if (!validateDailyLogDate(current.logDate)) { Alert.alert('Log date required', 'Enter a valid YYYY-MM-DD date before queueing. Your draft is kept.'); return; }
    try { draftToSyncOperation(userId, current); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Review the daily-log fields before queueing.', 'attention'); return; }
    busyRef.current = true; setBusy(true);
    try {
      await persist(current); if (!alive.current) return;
      await queueExpoDraft(userId, current.projectId, photos.map((photo) => photo.photoId), () => alive.current);
      queued.current = true;
      if (!alive.current) return;
      setDirty(false);
      await reloadSyncRows();
      setStatus(online ? 'Submitted to the outbox and synchronizing…' : 'Queued until connectivity returns', 'queued');
      if (online) await synchronize();
      await confirmHaptic();
      if (alive.current) router.replace('/(tabs)/sync');
    } catch (error) { if (alive.current) {
      if (queued.current) { setStatus('The daily log is safely queued. Open Sync Center to check delivery.', 'queued'); router.replace('/(tabs)/sync'); }
      else setStatus(error instanceof Error ? error.message : 'Could not queue this log. The device draft remains saved.', 'attention');
    } }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const statusBanner = dailyLogStatusBanner(notice, dirty, online);

  if (!draft?.fieldEntries || !project || !project.canEdit || draft.projectId !== activeProjectId) return <Screen><BrandHeader title="New daily log" /><Card><Text style={uiStyles.muted}>{project?.canEdit ? status : 'Select a project where you have edit access before creating a daily log.'}</Text></Card>{loadFailed ? <SecondaryButton title="Retry opening saved draft" onPress={() => setLoadRetry((value) => value + 1)} /> : null}<SecondaryButton title="Back" onPress={() => router.back()} /></Screen>;
  return <Screen>
    <WebHeader projectName={project.name} online={online} navigationDisabled={dirty || busy} />
    <BreadcrumbRow current="Daily Logs / New Log" />
    <ModuleHeading title="New Daily Log" />
    <SecondaryButton title="Back to logs" disabled={busy} onPress={() => router.replace('/(tabs)/logs')} />
    <StatusBanner {...statusBanner} />
    <DailyLogSection title="Date">
      <Field label="Log date (YYYY-MM-DD)" value={draft.logDate} editable={!busy} maxLength={10} onChangeText={(logDate) => update({ logDate })} placeholder="YYYY-MM-DD" autoCapitalize="none" />
    </DailyLogSection>
    <DailyLogFieldSections fields={draft.fieldEntries} conditions={draft.weatherConditions} disabled={busy} onChange={(fieldEntries) => update({ fieldEntries })} onConditions={(weatherConditions) => update({ weatherConditions })} />
    <DailyLogSection title="Work Summary">
      <Field label="Work summary" multiline value={draft.workSummary} editable={!busy} maxLength={20000} onChangeText={(workSummary) => update({ workSummary })} placeholder="Describe overall work completed today..." />
    </DailyLogSection>
    <DailyLogSection title="Safety Notes">
      <Field label="Safety notes" multiline value={draft.safetyNotes} editable={!busy} maxLength={20000} onChangeText={(safetyNotes) => update({ safetyNotes })} placeholder="Any safety observations, incidents, or notes..." />
    </DailyLogSection>
    <DailyLogSection title="Location & Photos">
      <Text style={uiStyles.muted}>RailCommand asks for camera, photo, or precise foreground location access only when you choose the related action. Denying access never removes your draft.</Text>
      <View style={styles.actions}><SecondaryButton title="Capture photo" disabled={busy} onPress={() => void takePhoto('camera')} />
        <SecondaryButton title="Import photo" disabled={busy} onPress={() => void takePhoto('library')} /></View>
      <SecondaryButton title={draft.geoTag ? 'Update location' : 'Attach location'} disabled={busy} onPress={() => void locate()} />
      {draft.geoTag ? <SecondaryButton title="Remove location" disabled={busy} onPress={() => update({ geoTag: null })} /> : null}
      <Text style={styles.evidence}>{photos.length} photo{photos.length === 1 ? '' : 's'} persisted on this device · {draft.geoTag ? `Location ±${Math.round(draft.geoTag.accuracy ?? 0)} m` : 'No location attached'}</Text>
    </DailyLogSection>
    <SecondaryButton title="Save draft" disabled={busy} onPress={() => void persist(draft).catch(() => setStatus('Could not save. Keep the form open and check device storage.', 'save-error'))} />
    <PrimaryButton title={online ? 'Submit Log' : 'Queue Log & Photos'} busy={busy} onPress={() => void submit()} />
    <Text style={uiStyles.muted}>Your fields autosave locally. Submission creates one idempotent outbox item; photos wait for that parent log and synchronize independently.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  evidence: { color: colors.ink, fontFamily: fonts.mono, fontSize: 11, lineHeight: 17 },
});
