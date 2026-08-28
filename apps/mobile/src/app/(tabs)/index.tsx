import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, PrimaryButton, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function OverviewScreen() {
  const { bootstrap, activeProjectId, loading, message, online, selectProject } = useMobileData();
  const active = bootstrap?.projects.find((project) => project.id === activeProjectId) ?? null;
  return <Screen>
    <BrandHeader eyebrow="FIELD APPLICATION" title="RailCommand" right={<StatusPill online={online} />} />
    <Card>
      <SectionTitle>Active project</SectionTitle>
      {bootstrap?.projects.length ? bootstrap.projects.map((project) => <Pressable
        accessibilityRole="button" accessibilityState={{ selected: project.id === activeProjectId }} key={project.id}
        onPress={() => void selectProject(project.id)} style={[styles.project, project.id === activeProjectId && styles.projectActive]}>
        <View style={{ flex: 1 }}><Text style={styles.projectName}>{project.name}</Text>
          <Text style={uiStyles.muted}>{project.location || project.client || 'Project field workspace'}</Text></View>
        <Text style={styles.projectState}>{project.id === activeProjectId ? 'ACTIVE' : 'SELECT'}</Text>
      </Pressable>) : <Text style={uiStyles.muted}>{loading ? 'Loading projects…' : 'No project is available for this account.'}</Text>}
      <Text style={styles.status}>{message}</Text>
    </Card>
    <Card>
      <SectionTitle>Today in the field</SectionTitle>
      <Text style={styles.metric}>{bootstrap?.dailyLogs.length ?? 0}</Text>
      <Text style={uiStyles.muted}>recent daily logs saved for offline viewing</Text>
      <PrimaryButton title="Create daily log" disabled={!active || !active.canEdit} onPress={() => router.push('/daily-log/new')} />
      {!active?.canEdit && active ? <Text style={styles.warning}>Your project role is read-only. Daily-log creation is unavailable.</Text> : null}
    </Card>
    <View style={styles.row}>
      <Link href="/team" asChild><Pressable style={styles.linkCard}><Text style={styles.linkTitle}>Project team</Text><Text style={styles.linkDetail}>{bootstrap?.team.length ?? 0} cached members</Text></Pressable></Link>
      <Link href="/(tabs)/sync" asChild><Pressable style={styles.linkCard}><Text style={styles.linkTitle}>Sync Center</Text><Text style={styles.linkDetail}>Review device work</Text></Pressable></Link>
    </View>
    <Card>
      <SectionTitle>Desktop-only in v1</SectionTitle>
      <Text style={uiStyles.muted}>Administration, billing, EarthCam administration, RailBot voice, and full document or schedule editing remain clearly unavailable in this field app.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  project: { minHeight: 76, borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white },
  projectActive: { borderWidth: 2, borderColor: colors.orange, backgroundColor: '#FFF8F2' },
  projectName: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  projectState: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 1 },
  status: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 17 },
  metric: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 40, lineHeight: 48 },
  warning: { color: colors.warning, fontFamily: fonts.bodyMedium, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12 },
  linkCard: { flex: 1, minHeight: 104, padding: 14, backgroundColor: colors.ink, justifyContent: 'space-between', shadowColor: colors.orange, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 2 },
  linkTitle: { color: colors.white, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  linkDetail: { color: '#CBD5E1', fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
});
