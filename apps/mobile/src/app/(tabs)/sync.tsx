import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, PrimaryButton, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors } from '@/theme';

const labels = { pending: 'Pending', retrying: 'Retrying', failed: 'Failed', conflicted: 'Conflicted', synchronized: 'Synchronized' } as const;

export default function SyncScreen() {
  const { online, message, syncRows, synchronize } = useMobileData();
  return <Screen>
    <BrandHeader eyebrow="DEVICE OUTBOX" title="Sync Center" right={<StatusPill online={online} />} />
    <Card><SectionTitle>Field synchronization</SectionTitle><Text style={uiStyles.muted}>{message}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.ink, fontWeight: '800', marginBottom: 4 }, state: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  pending: { color: colors.warning }, retrying: { color: colors.info }, failed: { color: colors.danger }, conflicted: { color: colors.danger }, synchronized: { color: colors.success },
});
