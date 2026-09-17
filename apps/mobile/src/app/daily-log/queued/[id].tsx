import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { Card, PageHeading, PrimaryButton, Screen, SecondaryButton, SectionTitle, StatusBanner, uiStyles } from '@/components/ui';
import { confirmSeparateExpoLog, listExpoOutbox, listExpoPhotos, type ExpoDailyLogSyncOperation, type ExpoStoredPhoto } from '@/lib/offline-store';
import { captureOfflineScope } from '@/lib/storage-scope';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';

export default function QueuedLogReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, sessionRevision, isSessionCurrent } = useAuth();
  const owner = session?.user.id;
  const { bootstrap, online, synchronize, reloadSyncRows } = useMobileData();
  const [state, setState] = useState<{ owner?: string; revision: number; operation?: ExpoDailyLogSyncOperation; photos: ExpoStoredPhoto[]; error?: string }>({ revision: -1, photos: [] });
  const [busy, setBusy] = useState(false);
  const current = useRef<(() => boolean) | null>(null);
  const saving = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    const storageCurrent = owner ? captureOfflineScope(owner) : () => false;
    const isCurrent = () => active && !!owner && isSessionCurrent(owner, sessionRevision) && storageCurrent();
    current.current = isCurrent; saving.current = false; setBusy(false);
    setState({ owner, revision: sessionRevision, photos: [] });
    if (owner) void (async () => {
      try {
        const operation = (await listExpoOutbox(owner, isCurrent)).find((item) => item.operationId === id && item.userId === owner);
        const photos = operation ? await listExpoPhotos(owner, operation.clientId, isCurrent) : [];
        if (isCurrent()) setState({ owner, revision: sessionRevision, operation, photos,
          ...(!operation ? { error: 'This entry is no longer in the device queue. Check the Sync Center for its receipt.' } : {}) });
      } catch {
        if (isCurrent()) setState({ owner, revision: sessionRevision, photos: [], error: 'The saved entry could not be read. Nothing was removed.' });
      }
    })();
    return () => { active = false; current.current = null; };
  }, [id, isSessionCurrent, owner, sessionRevision]));
  const visible = state.owner === owner && state.revision === sessionRevision;
  const operation = visible ? state.operation : undefined;
  const payload = operation?.payload;
  const photos = visible ? state.photos : [];
  const project = bootstrap?.projects.find((item) => item.id === operation?.projectId);
  const existing = bootstrap?.dailyLogs.filter((log) => log.projectId === operation?.projectId && log.logDate === payload?.log_date && log.id !== operation?.clientId) ?? [];
  const sameDayConflict = operation?.lastError?.startsWith('A daily log already exists for this project and date.');
  const confirm = () => {
    const isCurrent = current.current;
    if (!owner || !operation || !isCurrent?.() || saving.current) return;
    Alert.alert('Keep as a separate daily log?', 'This uploads this saved entry as an additional log for the same project and date. Existing logs stay unchanged. If this is repeated content from an earlier attempt, cancel and compare it first.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep separate log', onPress: () => {
        if (!isCurrent() || saving.current) return;
        saving.current = true; setBusy(true);
        void (async () => {
          try {
            await confirmSeparateExpoLog(owner, operation.operationId, isCurrent);
            if (!isCurrent()) return;
            await reloadSyncRows();
            if (!isCurrent()) return;
            // Consent survives offline/restart. Sync uses the existing operation and photo IDs.
            if (online) await synchronize();
            if (isCurrent()) router.replace('/(tabs)/sync');
          } catch (error) {
            if (isCurrent()) Alert.alert('Saved entry retained', error instanceof Error ? error.message : 'The review could not be saved. Try again.');
          } finally { if (isCurrent()) { saving.current = false; setBusy(false); } }
        })();
      } },
    ]);
  };
  return <Screen>
    <PageHeading eyebrow="DEVICE WORK / REVIEW" title="Review saved log" detail="Your saved entry remains on this device until delivery is confirmed." />
    <SecondaryButton title="Back to Sync Center" onPress={() => router.replace('/(tabs)/sync')} />
    {visible && state.error ? <StatusBanner title="Entry unavailable" detail={state.error} tone="warning" /> : null}
    {payload && operation ? <>
      <StatusBanner title={project?.name ?? 'Saved project'} detail={`${payload.log_date} · Entry ${operation.clientId.slice(0, 8)} · ${new Date(operation.createdAt).toLocaleString()}`} tone="neutral" />
      <Card><SectionTitle>Existing logs in your device cache</SectionTitle>
        <Text style={uiStyles.muted}>This list may be incomplete or out of date. Refresh the project online to compare current records. Opening a record does not change this saved entry.</Text>
        {existing.map((log) => <View key={log.id} style={{ gap: 8 }}>
          <Text>{log.authorName || 'Team member'} · {log.id.slice(0, 8)}</Text><Text>{log.workSummary || 'No work summary'}</Text>
          <SecondaryButton title={`Read log ${log.id.slice(0, 8)}`} onPress={() => router.push(`/daily-log/${log.id}`)} />
        </View>)}
        {!existing.length ? <Text style={uiStyles.muted}>No other log for this day is in the current cache. This does not mean the server has none.</Text> : null}
      </Card>
      <Card><SectionTitle>Saved field work</SectionTitle>
        <Text>Weather: {payload.weather_conditions || 'Not recorded'} · {payload.weather_temp}°F · {payload.weather_wind || 'No wind recorded'}</Text>
        <Text>Work summary: {payload.work_summary || 'Not recorded'}</Text>
        <Text>Safety notes: {payload.safety_notes || 'Not recorded'}</Text>
        {(['personnel', 'equipment', 'work_items'] as const).map((key) => <View key={key} style={{ gap: 6 }}>
          <SectionTitle>{key === 'work_items' ? 'Work items' : key === 'personnel' ? 'Personnel' : 'Equipment'}</SectionTitle>
          {payload[key].map((item, index) => <Text key={index}>{Object.entries(item as Record<string, unknown>).map(([name, value]) => `${name.replaceAll('_', ' ')}: ${String(value ?? '')}`).join(' · ')}</Text>)}
          {!payload[key].length ? <Text style={uiStyles.muted}>None recorded</Text> : null}
        </View>)}
        {payload.geo_tag ? <Text>GPS: {payload.geo_tag.lat}, {payload.geo_tag.lng} · {payload.geo_tag.timestamp}</Text> : null}
      </Card>
      <Card><SectionTitle>Saved photos ({operation.photoIds.length})</SectionTitle>
        {photos.map((photo) => <View key={photo.photoId} style={{ gap: 8 }}><Text>{photo.fileName}</Text>
          {/^image\/(jpeg|png|webp)$/i.test(photo.fileType) ? <Image accessibilityLabel={photo.fileName} source={{ uri: photo.uri }} style={{ height: 180, width: '100%' }} resizeMode="contain" /> : null}
        </View>)}
        <Text style={uiStyles.muted}>The original photo files and parent relationship are retained. Missing files will block delivery rather than be silently omitted.</Text>
      </Card>
      {sameDayConflict ? <PrimaryButton title={busy ? 'Saving review…' : online ? 'Keep as a separate log' : 'Keep separate log when online'} disabled={busy} onPress={confirm} />
        : <StatusBanner title="Saved entry retained" detail={operation.payload.allow_same_day ? 'A separate log has already been confirmed. Retry delivery from the Sync Center.' : operation.lastError || 'This entry is waiting for delivery. Retry from the Sync Center.'} tone="warning" />}
    </> : null}
  </Screen>;
}
