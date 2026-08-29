import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, PageHeading, PrimaryButton, Screen, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function LogsScreen() {
  const { bootstrap, activeProjectId, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const spokenDate = (logDate: string) => new Date(`${logDate}T12:00:00`).toLocaleDateString();
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="FIELD RECORDS / DAILY LOGS" title="Daily Logs"
      badge={`${bootstrap?.dailyLogs.length ?? 0} CACHED`} detail="Review recent field records or start today’s durable device draft." />
    <StatusBanner tone={online ? 'success' : 'warning'}
      title={online ? 'Recent project records synchronized' : 'Saved daily logs — read only'}
      detail={online ? 'The most recent daily logs are also available after connectivity is lost.' : 'Cached records remain available. Existing records cannot be edited offline in this field release.'} />
    <Card><Text style={styles.eyebrow}>NEW FIELD RECORD</Text><SectionTitle>{project?.name ?? 'No active project'}</SectionTitle>
      <PrimaryButton title="New daily log" disabled={!project?.canEdit} onPress={() => router.push('/daily-log/new')} />
    </Card>
    <View style={styles.listHeader}><Text style={styles.eyebrow}>RECENT RECORDS</Text><Text style={uiStyles.muted}>Newest first</Text></View>
    {bootstrap?.dailyLogs.length ? bootstrap.dailyLogs.map((log) => <Pressable key={log.id}
        accessibilityRole="button"
        accessibilityLabel={`Daily log, ${spokenDate(log.logDate)}, ${log.workSummary || 'no work summary recorded'}`}
        accessibilityHint="Opens the cached daily log"
        onPress={() => router.push(`/daily-log/${log.id}`)} style={styles.log}>
        <View style={{ flex: 1 }}><Text style={styles.date}>{spokenDate(log.logDate)}</Text>
          <Text numberOfLines={2} style={styles.summary}>{log.workSummary || 'No work summary recorded'}</Text>
          <Text numberOfLines={1} style={styles.weather}>{log.weatherConditions || 'Weather not recorded'}</Text></View><Text style={styles.open}>OPEN</Text>
      </Pressable>) : <Card><EmptyState title="No cached logs" detail="Connect once to synchronize recent daily logs for this project." /></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  log: { minHeight: 104, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.line, padding: 14, alignItems: 'center', backgroundColor: colors.paper, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 1 },
  date: { color: colors.ink, fontFamily: fonts.heading, fontSize: 14, lineHeight: 19 },
  summary: { color: colors.muted, fontFamily: fonts.body, lineHeight: 19, marginTop: 4 },
  weather: { color: colors.muted, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, marginTop: 7, textTransform: 'uppercase' },
  open: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1 },
});
