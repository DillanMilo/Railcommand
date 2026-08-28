import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, PrimaryButton, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function LogsScreen() {
  const { bootstrap, activeProjectId, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  return <Screen>
    <BrandHeader eyebrow="OFFLINE READ-ONLY CACHE" title="Daily logs" right={<StatusPill online={online} />} />
    <Card><SectionTitle>{project?.name ?? 'No active project'}</SectionTitle>
      <Text style={uiStyles.muted}>Recent synchronized records can be viewed offline. Existing records cannot be edited offline in v1.</Text>
      <PrimaryButton title="New daily log" disabled={!project?.canEdit} onPress={() => router.push('/daily-log/new')} />
    </Card>
    <Card>
      {bootstrap?.dailyLogs.length ? bootstrap.dailyLogs.map((log) => <Pressable key={log.id} onPress={() => router.push(`/daily-log/${log.id}`)} style={styles.log}>
        <View style={{ flex: 1 }}><Text style={styles.date}>{new Date(`${log.logDate}T12:00:00`).toLocaleDateString()}</Text>
          <Text numberOfLines={2} style={styles.summary}>{log.workSummary || 'No work summary recorded'}</Text></View><Text style={styles.open}>OPEN</Text>
      </Pressable>) : <EmptyState title="No cached logs" detail="Connect once to synchronize recent daily logs for this project." />}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  log: { flexDirection: 'row', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 13, alignItems: 'center' },
  date: { color: colors.ink, fontFamily: fonts.heading, fontSize: 14, lineHeight: 19 },
  summary: { color: colors.muted, fontFamily: fonts.body, lineHeight: 19, marginTop: 4 },
  open: { color: colors.orange, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1 },
});
