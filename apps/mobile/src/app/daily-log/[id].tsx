import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, EmptyState, Screen, SecondaryButton, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { shareDailyLogSummary } from '@/lib/device';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors } from '@/theme';

export default function DailyLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bootstrap, online } = useMobileData();
  const log = bootstrap?.dailyLogs.find((item) => item.id === id);
  return <Screen>
    <BrandHeader eyebrow="CACHED RECORD" title="Daily log" right={<StatusPill online={online} />} />
    <SecondaryButton title="Back to logs" onPress={() => router.back()} />
    {!log ? <Card><EmptyState title="Record unavailable" detail="This log is not in the recent device cache. Reconnect and refresh the project." /></Card> : <>
      <Card><SectionTitle>{new Date(`${log.logDate}T12:00:00`).toLocaleDateString()}</SectionTitle><Text style={styles.notice}>Read-only in the v1 field app</Text></Card>
      <Card><Text style={styles.label}>Weather</Text><Text style={styles.value}>{log.weatherConditions || 'Not recorded'}</Text>
        <Text style={styles.label}>Work summary</Text><Text style={styles.value}>{log.workSummary || 'Not recorded'}</Text>
        <Text style={styles.label}>Safety notes</Text><Text style={styles.value}>{log.safetyNotes || 'Not recorded'}</Text></Card>
      <SecondaryButton title="Share summary" onPress={() => void shareDailyLogSummary(`${log.logDate}\n${log.workSummary}\n${log.safetyNotes}`)} />
      <Text style={uiStyles.muted}>Existing-record editing is unavailable in this version. Use RailCommand on the web when connected.</Text>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ label: { color: colors.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }, value: { color: colors.ink, fontSize: 16, lineHeight: 23, marginBottom: 8 }, notice: { color: colors.warning, fontWeight: '800' } });
