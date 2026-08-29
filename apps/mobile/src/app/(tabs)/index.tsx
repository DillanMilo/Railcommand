import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, MetricTile, PageHeading, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const formatLogDate = (logDate: string) => new Date(`${logDate}T12:00:00`).toLocaleDateString();

export default function OverviewScreen() {
  const { bootstrap, activeProjectId, loading, message, online, selectProject } = useMobileData();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const active = bootstrap?.projects.find((project) => project.id === activeProjectId) ?? null;
  const hasProjectChoice = (bootstrap?.projects.length ?? 0) > 1;
  const recentLogs = bootstrap?.dailyLogs.slice(0, 4) ?? [];
  return <Screen>
    <BrandHeader title={active?.name ?? 'Select'} right={<StatusPill online={online} />} expanded={projectsOpen}
      onPress={hasProjectChoice ? () => setProjectsOpen((open) => !open) : undefined} />
    <PageHeading eyebrow="PROJECT CONTROL / LIVE OVERVIEW" title={active?.name ?? 'Dashboard'}
      badge={active ? 'ACTIVE' : undefined} detail={active?.client || active?.location || 'Select an authorized project workspace'} />
    {projectsOpen && bootstrap && bootstrap.projects.length > 1 ? <Card>
      <SectionTitle>Switch project</SectionTitle>
      {bootstrap?.projects.length ? bootstrap.projects.map((project) => <Pressable
        accessibilityRole="button" accessibilityState={{ selected: project.id === activeProjectId }} key={project.id}
        onPress={() => void selectProject(project.id)} style={[styles.project, project.id === activeProjectId && styles.projectActive]}>
        <View style={{ flex: 1 }}><Text style={styles.projectName}>{project.name}</Text>
          <Text style={uiStyles.muted}>{project.location || project.client || 'Project field workspace'}</Text></View>
        <Text style={styles.projectState}>{project.id === activeProjectId ? 'ACTIVE' : 'SELECT'}</Text>
      </Pressable>) : <Text style={uiStyles.muted}>{loading ? 'Loading projects…' : 'No project is available for this account.'}</Text>}
      <Text style={styles.status}>{message}</Text>
    </Card> : <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>}
    <View style={styles.metrics}>
      <MetricTile label="BUDGET" value="—" detail="Available on RailCommand web"
        icon={<SymbolView accessible={false} name={{ ios: 'dollarsign', android: 'attach_money', web: 'attach_money' }} tintColor={colors.ink} size={17} />} />
      <MetricTile label="SCHEDULE" value="—" detail="Available on RailCommand web"
        icon={<SymbolView accessible={false} name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={colors.successBright} size={17} />} />
      <MetricTile label="SUBMITTALS" value="—" detail="Online-only in this field release"
        icon={<SymbolView accessible={false} name={{ ios: 'doc.text', android: 'description', web: 'description' }} tintColor={colors.info} size={17} />} />
      <MetricTile label="OPEN RFIS" value="—" detail="Online-only in this field release"
        icon={<SymbolView accessible={false} name={{ ios: 'ellipsis.message', android: 'chat', web: 'chat' }} tintColor={colors.info} size={17} />} />
      <MetricTile label="PUNCH LIST" value="—" detail="Available on RailCommand web"
        icon={<SymbolView accessible={false} name={{ ios: 'checkmark.square', android: 'fact_check', web: 'fact_check' }} tintColor={colors.amber} size={17} />} />
      <MetricTile label="DAILY LOGS" value={bootstrap?.dailyLogs.length ?? 0} detail="cached for offline viewing"
        icon={<SymbolView accessible={false} name={{ ios: 'calendar.badge.clock', android: 'event_note', web: 'event_note' }} tintColor={colors.successBright} size={17} />} />
    </View>
    <View style={styles.dashboardColumns}>
      <Card>
        <SectionTitle>Recent Activity</SectionTitle>
        {recentLogs.length ? recentLogs.map((log) => <Pressable
          key={log.id}
          accessibilityRole="button"
          accessibilityLabel={`Open daily log from ${formatLogDate(log.logDate)}`}
          accessibilityHint="Opens the cached daily log"
          onPress={() => router.push(`/daily-log/${log.id}`)}
          style={styles.activityRow}
        >
          <View style={styles.activityDot} />
          <View style={styles.activityText}>
            <Text numberOfLines={1} style={styles.activityTitle}>{log.workSummary || 'Daily log recorded'}</Text>
            <Text style={styles.activityDetail}>{formatLogDate(log.logDate)}</Text>
          </View>
        </Pressable>) : <Text style={uiStyles.muted}>No recent daily logs are cached on this device.</Text>}
      </Card>
      <Card>
        <SectionTitle>Quick Actions</SectionTitle>
        <View style={styles.actionGrid}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !active?.canEdit }} disabled={!active?.canEdit} onPress={() => router.push('/daily-log/new')}
            style={({ pressed }) => [styles.action, !active?.canEdit && styles.actionDisabled, pressed && styles.actionPressed]}>
            <SymbolView accessible={false} name={{ ios: 'calendar.badge.plus', android: 'event_note', web: 'event_note' }} tintColor={colors.muted} size={23} />
            <Text style={styles.actionText}>New Daily Log</Text>
          </Pressable>
          <Link href="/(tabs)/sync" asChild><Pressable accessibilityRole="link" accessibilityLabel="Sync Center, review device work" style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <SymbolView accessible={false} name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }} tintColor={colors.muted} size={23} />
            <Text style={styles.actionText}>Sync Center</Text>
          </Pressable></Link>
          <Link href="/team" asChild><Pressable accessibilityRole="link" accessibilityLabel={`Project team, ${bootstrap?.team.length ?? 0} cached members`} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <SymbolView accessible={false} name={{ ios: 'person.2', android: 'group', web: 'group' }} tintColor={colors.muted} size={23} />
            <Text style={styles.actionText}>Project Team</Text>
          </Pressable></Link>
          <Link href="/logs" asChild><Pressable accessibilityRole="link" accessibilityLabel="View cached daily logs" style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <SymbolView accessible={false} name={{ ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' }} tintColor={colors.muted} size={23} />
            <Text style={styles.actionText}>View Logs</Text>
          </Pressable></Link>
        </View>
        {!active?.canEdit && active ? <Text style={styles.warning}>Your project role is read-only. Daily-log creation is unavailable.</Text> : null}
      </Card>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  project: { minHeight: 76, borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white },
  projectActive: { borderWidth: 2, borderColor: colors.orange, backgroundColor: '#FFF8F2' },
  projectName: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  projectState: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 1 },
  status: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warning: { color: colors.warning, fontFamily: fonts.bodyMedium, lineHeight: 19 },
  dashboardColumns: { gap: 18 },
  activityRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  activityText: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17 },
  activityDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, marginTop: 2 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '48%', minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: 10 },
  actionDisabled: { opacity: 0.42 },
  actionPressed: { backgroundColor: '#FFF8F2', borderColor: colors.orange },
  actionText: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
