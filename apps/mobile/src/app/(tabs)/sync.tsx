import { router, useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { MobileRecordDraft } from '@railcommand/domain';
import { useAuth } from '@/providers/auth-provider';
import { recordDraftStore } from '@/lib/offline-store';
import { WebActionButton } from '@/components/web-shell';
import { BrandHeader, Card, EmptyState, MetricTile, PageHeading, PrimaryButton, Screen, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const labels = { pending: 'Pending', retrying: 'Retrying', failed: 'Failed', conflicted: 'Conflicted', synchronized: 'Synchronized' } as const;

export default function SyncScreen() {
  const { activeProjectId, bootstrap, online, message, syncRows, synchronize, reloadSyncRows, selectProject } = useMobileData();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [draftState, setDraftState] = useState<{ owner?: string; rows: MobileRecordDraft[]; error: boolean }>({ rows: [], error: false });
  const drafts = draftState.owner === userId ? draftState.rows : [];
  const draftError = draftState.owner === userId && draftState.error;
  const currentScope = useRef({ userId, active: true });
  useLayoutEffect(() => {
    const scope = { userId, active: true }; currentScope.current = scope;
    return () => { scope.active = false; };
  }, [userId]);
  useFocusEffect(useCallback(() => {
    let current = true; setDraftState({ owner: userId, rows: [], error: false });
    if (userId) void recordDraftStore.list(userId).then((rows) => { if (current) setDraftState({ owner: userId, rows, error: false }); })
      .catch(() => { if (current) setDraftState({ owner: userId, rows: [], error: true }); });
    return () => { current = false; };
  }, [userId]));
  useFocusEffect(useCallback(() => {
    void reloadSyncRows();
  }, [reloadSyncRows]));

  const queuedRows = syncRows.filter((row) => row.state !== 'synchronized');
  const queuedLogs = queuedRows.filter((row) => row.kind === 'daily_log').length;
  const queuedPhotos = queuedRows.filter((row) => row.kind === 'photo').length;
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const problemCount = syncRows.filter((row) => row.state === 'failed' || row.state === 'conflicted').length;
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="DEVICE OUTBOX / FIELD SYNCHRONIZATION" title="Sync Center"
      badge={problemCount ? `${problemCount} NEED REVIEW` : queuedRows.length ? `${queuedRows.length} PENDING` : 'CLEAR'} detail="Review device work, retry failures, and confirm delivery." />
    <View style={styles.metrics}>
      <MetricTile label="DAILY LOGS" value={queuedLogs} detail="waiting on this device" />
      <MetricTile label="PHOTOS" value={queuedPhotos} detail="child uploads waiting" />
    </View>
    <StatusBanner tone={problemCount ? 'danger' : online ? 'success' : 'warning'}
      title={problemCount ? `${problemCount} item${problemCount === 1 ? '' : 's'} need review` : online ? 'Foreground synchronization ready' : 'Waiting for connectivity'}
      detail={`Device queue: ${queuedLogs} daily log${queuedLogs === 1 ? '' : 's'} · ${queuedPhotos} photo${queuedPhotos === 1 ? '' : 's'}. ${message}`} />
    <Card><Text style={styles.eyebrow}>MANUAL CONTROL</Text><SectionTitle>Field synchronization</SectionTitle>
      <PrimaryButton title={online ? 'Synchronize now' : 'Waiting for connectivity'} disabled={!online} onPress={() => void synchronize()} />
    </Card>
    {draftError ? <StatusBanner title="Saved forms could not be read" detail="Nothing was deleted. Reopen the RFI/Submittal editor or check device storage before signing out." tone="warning" /> : null}
    {drafts.length ? <Card><SectionTitle>Saved RFI/Submittal drafts</SectionTitle>
      <Text style={uiStyles.muted}>These drafts are not queued. Reopen a form and create it explicitly when online.</Text>
      {drafts.map((draft) => <View key={draft.clientId} style={{ gap: 8 }}>
        <Text style={styles.label}>{draft.kind === 'rfis' ? 'RFI' : 'Submittal'} · {draft.title || 'Untitled draft'}</Text>
        <Text style={uiStyles.muted}>{bootstrap?.projects.find((item) => item.id === draft.projectId)?.name ?? 'Project access needs verification'}</Text>
        <WebActionButton title={draft.createdId ? 'Open creation receipt' : 'Resume draft'} onPress={() => {
          const scope = currentScope.current;
          void selectProject(draft.projectId).then(() => {
            if (scope.active && currentScope.current === scope) router.push({ pathname: '/record/[kind]/new', params: { kind: draft.kind, projectId: draft.projectId } });
          }).catch(() => { if (scope.active && currentScope.current === scope) Alert.alert('Project unavailable', 'The saved draft was kept. Verify project access before reopening it.'); });
        }} />
      </View>)}
    </Card> : null}
    <View style={styles.listHeader}><Text style={styles.eyebrow}>DEVICE ACTIVITY</Text><Text style={uiStyles.muted}>Pending and recent</Text></View>
    {syncRows.length ? syncRows.map((row) => <View key={`${row.kind}:${row.id}`} style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.label}>{row.kind === 'daily_log' ? 'Daily log' : 'Photo'} · {row.label}</Text>
          <Text style={uiStyles.muted}>{row.detail || new Date(row.updatedAt).toLocaleString()}</Text>
          {row.kind === 'daily_log' && row.state !== 'synchronized' ? <WebActionButton title="Review saved log" onPress={() => router.push(`/daily-log/queued/${row.id}`)} /> : null}</View>
        <Text style={[styles.state, styles[row.state]]}>{labels[row.state]}</Text>
      </View>) : <Card><EmptyState title="No device work yet" detail="Autosaved drafts stay in the editor. Submitted work and recent synchronization results appear here." /></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: 10 },
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  label: { color: colors.ink, fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, marginBottom: 4 },
  state: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, textTransform: 'uppercase' },
  pending: { color: colors.warning }, retrying: { color: colors.info }, failed: { color: colors.danger }, conflicted: { color: colors.danger }, synchronized: { color: colors.success },
});
