import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, PrimaryButton, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function OverviewScreen() {
  const { bootstrap, activeProjectId, loading, message, online, selectProject } = useMobileData();
  const active = bootstrap?.projects.find((project) => project.id === activeProjectId) ?? null;
  return <Screen>
    <BrandHeader eyebrow="ACTIVE PROJECT" title={active?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <View style={styles.pageHeader}>
      <Text style={styles.eyebrow}>PROJECT CONTROL / FIELD OVERVIEW</Text>
      <View style={styles.titleRow}><Text accessibilityRole="header" style={styles.pageTitle}>{active?.name ?? 'Dashboard'}</Text>
        {active ? <Text style={styles.activeBadge}>ACTIVE</Text> : null}</View>
      <Text style={uiStyles.muted}>{active?.client || active?.location || 'Select an authorized project workspace'}</Text>
    </View>
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
      <View style={styles.metricCard}><Text style={styles.metricLabel}>DAILY LOGS</Text><Text style={styles.metric}>{bootstrap?.dailyLogs.length ?? 0}</Text><Text style={styles.metricDetail}>cached for offline viewing</Text></View>
      <View style={styles.metricCard}><Text style={styles.metricLabel}>PROJECT TEAM</Text><Text style={styles.metric}>{bootstrap?.team.length ?? 0}</Text><Text style={styles.metricDetail}>cached members</Text></View>
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
  pageHeader: { gap: 7, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  pageTitle: { flexShrink: 1, color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 28, lineHeight: 33, letterSpacing: -1.15 },
  activeBadge: { color: colors.success, backgroundColor: '#E8F8F1', borderWidth: 1, borderColor: '#9BD8C5', paddingHorizontal: 8, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 8, letterSpacing: 1.1 },
  project: { minHeight: 76, borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white },
  projectActive: { borderWidth: 2, borderColor: colors.orange, backgroundColor: '#FFF8F2' },
  projectName: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  projectState: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 1 },
  status: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 17 },
  metrics: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, minHeight: 132, justifyContent: 'space-between', padding: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 1 },
  metricLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, lineHeight: 12, letterSpacing: 1.15 },
  metric: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 34, lineHeight: 41, letterSpacing: -1.2 },
  metricDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
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
