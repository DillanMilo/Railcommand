import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, PrimaryButton, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const labels = { pending: 'Pending', retrying: 'Retrying', failed: 'Failed', conflicted: 'Conflicted', synchronized: 'Synchronized' } as const;

export default function SyncScreen() {
  const { online, message, syncRows, synchronize, reloadSyncRows } = useMobileData();
  useFocusEffect(useCallback(() => {
    void reloadSyncRows();
  }, [reloadSyncRows]));

  const queuedRows = syncRows.filter((row) => row.state !== 'synchronized');
  const queuedLogs = queuedRows.filter((row) => row.kind === 'daily_log').length;
  const queuedPhotos = queuedRows.filter((row) => row.kind === 'photo').length;
  return <Screen>
    <BrandHeader eyebrow="DEVICE OUTBOX" title="Sync Center" right={<StatusPill online={online} />} />
    <Card><SectionTitle>Field synchronization</SectionTitle><Text style={uiStyles.muted}>{message}</Text>
      <Text style={styles.summary}>Device queue: {queuedLogs} daily log{queuedLogs === 1 ? '' : 's'} · {queuedPhotos} photo{queuedPhotos === 1 ? '' : 's'}</Text>
      <PrimaryButton title={online ? 'Synchronize now' : 'Waiting for connectivity'} disabled={!online} onPress={() => void synchronize()} />
    </Card>
    <Card>
      {syncRows.length ? syncRows.map((row) => <View key={`${row.kind}:${row.id}`} style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.label}>{row.kind === 'daily_log' ? 'Daily log' : 'Photo'} · {row.label}</Text>
          <Text style={uiStyles.muted}>{row.detail || new Date(row.updatedAt).toLocaleString()}</Text></View>
        <Text style={[styles.state, styles[row.state]]}>{labels[row.state]}</Text>
      </View>) : <EmptyState title="No device work yet" detail="Autosaved drafts stay in the editor. Submitted work and recent synchronization results appear here." />}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  summary: { color: colors.ink, fontFamily: fonts.mono, fontSize: 11, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.ink, fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, marginBottom: 4 },
  state: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, textTransform: 'uppercase' },
  pending: { color: colors.warning }, retrying: { color: colors.info }, failed: { color: colors.danger }, conflicted: { color: colors.danger }, synchronized: { color: colors.success },
});
