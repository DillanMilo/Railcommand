import type { MobileDailyLogDraft } from '@railcommand/domain';
import { createMobileDraft } from '@railcommand/domain';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, Field, PrimaryButton, Screen, SecondaryButton, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { attachCurrentLocation, captureFieldPhoto, confirmHaptic, importFieldPhoto } from '@/lib/device';
import { mobileConfig } from '@/lib/config';
import { listExpoPhotos, queueExpoDraft, readExpoDraft, saveExpoDraft, saveExpoPhoto, type ExpoStoredPhoto } from '@/lib/offline-store';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors } from '@/theme';

function today() { return new Date().toISOString().slice(0, 10); }

export default function NewDailyLogScreen() {
  const { qaPermissions } = useLocalSearchParams<{ qaPermissions?: string }>();
  const { session } = useAuth();
  const { activeProjectId, bootstrap, online, reloadSyncRows, synchronize } = useMobileData();
  const userId = session?.user.id ?? null;
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const [draft, setDraft] = useState<MobileDailyLogDraft | null>(null);
  const [photos, setPhotos] = useState<ExpoStoredPhoto[]>([]);
  const [status, setStatus] = useState('Opening saved draft…');
  const [busy, setBusy] = useState(false);
  const permissionQaRan = useRef(false);

  useEffect(() => {
    if (!userId || !activeProjectId) return;
    let current = true;
    void readExpoDraft(userId, activeProjectId).then(async (saved) => {
      const initial = saved ?? createMobileDraft(activeProjectId, { logDate: today(), weatherConditions: '', workSummary: '', safetyNotes: '' }, null, new Date(), Crypto.randomUUID);
      if (!saved) await saveExpoDraft(userId, initial);
      const storedPhotos = await listExpoPhotos(userId, initial.clientId);
      if (current) { setDraft(initial); setPhotos(storedPhotos); setStatus(saved ? 'Saved draft restored from this device' : 'Draft saved automatically on this device'); }
    });
    return () => { current = false; };
  }, [activeProjectId, userId]);

  useEffect(() => {
    if (!draft || !userId) return;
    setStatus('Saving on this device…');
    const timer = setTimeout(() => void saveExpoDraft(userId, draft).then(() => setStatus('Saved automatically on this device')).catch(() => setStatus('Could not save. Check available device storage.')), 350);
    return () => clearTimeout(timer);
  }, [draft, userId]);

  useEffect(() => {
    if (
      mobileConfig.profile !== 'development'
      || qaPermissions !== '1'
      || permissionQaRan.current
      || !userId
      || !draft
    ) return;
    permissionQaRan.current = true;
    setBusy(true);
    void (async () => {
      let cameraResult = 'Camera permission did not deny as expected.';
      let locationResult = 'Location permission did not deny as expected.';
      try {
        await captureFieldPhoto(userId, draft.projectId, draft.clientId, draft.geoTag);
      } catch (error) {
        cameraResult = error instanceof Error ? error.message : 'Camera permission check failed safely.';
      }
      try {
        await attachCurrentLocation();
      } catch (error) {
        locationResult = error instanceof Error ? error.message : 'Location permission check failed safely.';
      }
      const saved = await readExpoDraft(userId, draft.projectId);
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
      setStatus(`Permission QA · ${cameraResult} · ${locationResult} · ${draftResult}`);
    })().catch(() => setStatus('Permission QA failed safely. The draft remains saved.')).finally(() => setBusy(false));
  }, [draft, qaPermissions, userId]);

  const update = useCallback((values: Partial<Pick<MobileDailyLogDraft, 'logDate' | 'weatherConditions' | 'workSummary' | 'safetyNotes' | 'geoTag'>>) => {
    setDraft((current) => current ? createMobileDraft(current.projectId, { logDate: values.logDate ?? current.logDate,
      weatherConditions: values.weatherConditions ?? current.weatherConditions, workSummary: values.workSummary ?? current.workSummary,
      safetyNotes: values.safetyNotes ?? current.safetyNotes, ...(Object.hasOwn(values, 'geoTag') ? { geoTag: values.geoTag } : {}) }, current, new Date(), Crypto.randomUUID) : current);
  }, []);

  const takePhoto = async (source: 'camera' | 'library') => {
    if (!userId || !draft) return;
    setBusy(true); setStatus(source === 'camera' ? 'Opening camera…' : 'Opening photo library…');
    try {
      const photo = source === 'camera'
        ? await captureFieldPhoto(userId, draft.projectId, draft.clientId, draft.geoTag)
        : await importFieldPhoto(userId, draft.projectId, draft.clientId, draft.geoTag);
      if (!photo) { setStatus('Photo selection canceled. Your draft remains saved.'); return; }
      await saveExpoPhoto(userId, photo); setPhotos((current) => [...current, photo]); setStatus('Photo persisted on this device'); await confirmHaptic();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Photo unavailable. Your draft remains saved.'); }
    finally { setBusy(false); }
  };

  const locate = async () => {
    setBusy(true); setStatus('Requesting a precise field location…');
    try { update({ geoTag: await attachCurrentLocation() }); setStatus('Location attached to this saved draft'); await confirmHaptic(); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Location unavailable. Your draft remains saved.'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!userId || !draft) return;
    if (!draft.logDate || !draft.workSummary.trim()) { Alert.alert('Work summary required', 'Add the date and a work summary before submitting. Your draft is already saved.'); return; }
    setBusy(true);
    try {
      await saveExpoDraft(userId, draft);
      await queueExpoDraft(userId, draft.projectId, photos.map((photo) => photo.photoId));
      await reloadSyncRows();
      setStatus(online ? 'Submitted to the outbox and synchronizing…' : 'Queued until connectivity returns');
      if (online) await synchronize();
      await confirmHaptic();
      router.replace('/(tabs)/sync');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not queue this log. The device draft remains saved.'); }
    finally { setBusy(false); }
  };

  if (!draft || !project) return <Screen><BrandHeader title="New daily log" /><Card><Text style={uiStyles.muted}>{project ? status : 'Select an editable project before creating a daily log.'}</Text></Card><SecondaryButton title="Back" onPress={() => router.back()} /></Screen>;
  return <Screen>
    <BrandHeader eyebrow="AUTOSAVED OFFLINE DRAFT" title="New daily log" right={<StatusPill online={online} />} />
    <SecondaryButton title="Back to logs" onPress={() => router.back()} />
    <Card><SectionTitle>{project.name}</SectionTitle><Text style={styles.status}>{status}</Text></Card>
    <Card>
      <Field label="Log date" value={draft.logDate} onChangeText={(logDate) => update({ logDate })} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Weather conditions" value={draft.weatherConditions} onChangeText={(weatherConditions) => update({ weatherConditions })} placeholder="Clear, 72°F" />
      <Field label="Work summary" multiline value={draft.workSummary} onChangeText={(workSummary) => update({ workSummary })} placeholder="Describe today’s completed work…" />
      <Field label="Safety notes" multiline value={draft.safetyNotes} onChangeText={(safetyNotes) => update({ safetyNotes })} placeholder="Record observations or incidents…" />
    </Card>
    <Card><SectionTitle>Field evidence</SectionTitle>
      <Text style={uiStyles.muted}>RailCommand asks for camera, photo, or precise foreground location access only when you choose the related action. Denying access never removes your draft.</Text>
      <View style={styles.actions}><SecondaryButton title="Capture photo" disabled={busy} onPress={() => void takePhoto('camera')} />
        <SecondaryButton title="Import photo" disabled={busy} onPress={() => void takePhoto('library')} /></View>
      <SecondaryButton title={draft.geoTag ? 'Update location' : 'Attach location'} disabled={busy} onPress={() => void locate()} />
      {draft.geoTag ? <SecondaryButton title="Remove location" disabled={busy} onPress={() => update({ geoTag: null })} /> : null}
      <Text style={styles.evidence}>{photos.length} photo{photos.length === 1 ? '' : 's'} persisted on this device · {draft.geoTag ? `Location ±${Math.round(draft.geoTag.accuracy ?? 0)} m` : 'No location attached'}</Text>
    </Card>
    <PrimaryButton title={online ? 'Submit daily log' : 'Queue daily log'} busy={busy} onPress={() => void submit()} />
    <Text style={uiStyles.muted}>Your fields autosave locally. Submission creates one idempotent outbox item; photos wait for that parent log and synchronize independently.</Text>
  </Screen>;
}

const styles = StyleSheet.create({ status: { color: colors.success, fontWeight: '700', lineHeight: 20 }, actions: { gap: 10 }, evidence: { color: colors.ink, fontSize: 12, fontWeight: '700' } });
