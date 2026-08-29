import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, MetricTile, PageHeading, PrimaryButton, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function OverviewScreen() {
  const { bootstrap, activeProjectId, loading, message, online, selectProject } = useMobileData();
  const active = bootstrap?.projects.find((project) => project.id === activeProjectId) ?? null;
  return <Screen>
    <BrandHeader eyebrow="ACTIVE PROJECT" title={active?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="PROJECT CONTROL / FIELD OVERVIEW" title={active?.name ?? 'Dashboard'}
      badge={active ? 'ACTIVE' : undefined} detail={active?.client || active?.location || 'Select an authorized project workspace'} />
    {bootstrap && bootstrap.projects.length > 1 ? <Card>
      <SectionTitle>Switch project</SectionTitle>
      {bootstrap?.projects.length ? bootstrap.projects.map((project) => <Pressable
        accessibilityRole="button" accessibilityState={{ selected: project.id === activeProjectId }} key={project.id}
        onPress={() => void selectProject(project.id)} style={[styles.project, project.id === activeProjectId && styles.projectActive]}>
        <View style={{ flex: 1 }}><Text style={styles.projectName}>{project.name}</Text>
          <Text style={uiStyles.muted}>{project.location || project.client || 'Project field workspace'}</Text></View>
        <Text style={styles.projectState}>{project.id === activeProjectId ? 'ACTIVE' : 'SELECT'}</Text>
      </Pressable>) : <Text style={uiStyles.muted}>{loading ? 'Loading projects…' : 'No project is available for this account.'}</Text>}
      <Text style={styles.status}>{message}</Text>
    </Card> : <Text style={styles.status}>{message}</Text>}
    <View style={styles.metrics}>
      <MetricTile label="DAILY LOGS" value={bootstrap?.dailyLogs.length ?? 0} detail="cached for offline viewing" />
      <MetricTile label="PROJECT TEAM" value={bootstrap?.team.length ?? 0} detail="cached members" />
    </View>
    <Card>
      <Text style={styles.eyebrow}>QUICK ACTION</Text>
      <SectionTitle>Today in the field</SectionTitle>
      <Text style={uiStyles.muted}>Create a durable daily-log draft now. It remains on this device until synchronization succeeds.</Text>
      <PrimaryButton title="Create daily log" disabled={!active || !active.canEdit} onPress={() => router.push('/daily-log/new')} />
      {!active?.canEdit && active ? <Text style={styles.warning}>Your project role is read-only. Daily-log creation is unavailable.</Text> : null}
    </Card>
    <View style={styles.row}>
      <Link href="/team" asChild><Pressable accessibilityRole="link" accessibilityLabel={`Project team, ${bootstrap?.team.length ?? 0} cached members`} style={styles.linkCard}><Text style={styles.linkTitle}>Project team</Text><Text style={styles.linkDetail}>{bootstrap?.team.length ?? 0} cached members</Text></Pressable></Link>
      <Link href="/(tabs)/sync" asChild><Pressable accessibilityRole="link" accessibilityLabel="Sync Center, review device work" style={styles.linkCard}><Text style={styles.linkTitle}>Sync Center</Text><Text style={styles.linkDetail}>Review device work</Text></Pressable></Link>
    </View>
    <Card>
      <Text style={styles.eyebrow}>PROJECT MODULES</Text>
      <SectionTitle>Available on RailCommand web</SectionTitle>
      <View style={styles.moduleGrid}>{['Submittals', 'RFIs', 'Punch list', 'Safety', 'Documents', 'Schedule'].map((module) => <View key={module} style={styles.module}><Text style={styles.moduleName}>{module}</Text><Text style={styles.moduleState}>ONLINE-ONLY</Text></View>)}</View>
      <Text style={uiStyles.muted}>These modules retain the same RailCommand information architecture, but their full native workflows are not included in this daily-log field release. Administration, billing, EarthCam administration, and RailBot voice also remain unavailable here.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  project: { minHeight: 76, borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white },
  projectActive: { borderWidth: 2, borderColor: colors.orange, backgroundColor: '#FFF8F2' },
  projectName: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  projectState: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 1 },
  status: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 17 },
  metrics: { flexDirection: 'row', gap: 10 },
  warning: { color: colors.warning, fontFamily: fonts.bodyMedium, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12 },
  linkCard: { flex: 1, minHeight: 104, padding: 14, backgroundColor: colors.ink, justifyContent: 'space-between', shadowColor: colors.orange, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 2 },
  linkTitle: { color: colors.white, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  linkDetail: { color: '#CBD5E1', fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  module: { width: '48%', minHeight: 62, justifyContent: 'space-between', padding: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  moduleName: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  moduleState: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, lineHeight: 10, letterSpacing: 0.8 },
});
