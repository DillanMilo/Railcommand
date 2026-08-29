import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, EmptyState, PageHeading, Screen, SecondaryButton, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { shareDailyLogSummary } from '@/lib/device';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function DailyLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProjectId, bootstrap, online } = useMobileData();
  const log = bootstrap?.dailyLogs.find((item) => item.id === id);
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const displayDate = log ? new Date(`${log.logDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : 'Daily Log';
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="FIELD RECORD / DAILY LOG" title={displayDate}
      badge={log ? 'READ ONLY' : undefined} detail="Synchronized project record cached for field reference." />
    <SecondaryButton title="Back to logs" onPress={() => router.back()} />
    {!log ? <Card><EmptyState title="Record unavailable" detail="This log is not in the recent device cache. Reconnect and refresh the project." /></Card> : <>
      <StatusBanner tone={online ? 'success' : 'warning'} title={online ? 'Cached copy available offline' : 'Viewing saved device data'}
        detail="Existing-record editing is unavailable in this field release. Reconnect and use RailCommand web for authorized edits." />
      <Card><Text style={styles.eyebrow}>WEATHER</Text><SectionTitle>Field conditions</SectionTitle><Text style={styles.value}>{log.weatherConditions || 'Not recorded'}</Text></Card>
      <Card><Text style={styles.eyebrow}>FIELD ACTIVITY</Text><SectionTitle>Work Summary</SectionTitle><Text style={styles.value}>{log.workSummary || 'Not recorded'}</Text></Card>
      <Card><Text style={styles.eyebrow}>SAFETY</Text><SectionTitle>Safety Notes</SectionTitle><Text style={styles.value}>{log.safetyNotes || 'Not recorded'}</Text></Card>
      <SecondaryButton title="Share summary" onPress={() => void shareDailyLogSummary(`${log.logDate}\n${log.workSummary}\n${log.safetyNotes}`)} />
      <Text style={uiStyles.muted}>Existing-record editing is unavailable in this version. Use RailCommand on the web when connected.</Text>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  value: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
});
