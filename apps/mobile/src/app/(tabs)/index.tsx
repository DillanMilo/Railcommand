import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, MetricTile, Screen, SectionTitle, uiStyles } from '@/components/ui';
import { BreadcrumbRow, RailBotButton, WebHeader } from '@/components/web-shell';
import { mobileConfig } from '@/lib/config';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const formatLogDate = (logDate: string) => new Date(`${logDate}T12:00:00`).toLocaleDateString();
const scheduleReferenceTime = Date.now();

export default function OverviewScreen() {
  const { bootstrap, activeProjectId, loading, message, online, selectProject } = useMobileData();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const active = bootstrap?.projects.find((project) => project.id === activeProjectId) ?? null;
  const hasProjectChoice = (bootstrap?.projects.length ?? 0) > 1;
  const recentLogs = bootstrap?.dailyLogs.slice(0, 4) ?? [];
  const dashboard = bootstrap?.dashboard;
  const scheduleStart = active?.startDate ? new Date(active.startDate).getTime() : 0;
  const scheduleEnd = active?.targetEndDate ? new Date(active.targetEndDate).getTime() : 0;
  const schedulePercent = scheduleEnd > scheduleStart
    ? Math.min(100, Math.max(0, Math.round(((scheduleReferenceTime - scheduleStart) / (scheduleEnd - scheduleStart)) * 100)))
    : 0;
  const budgetTotal = active?.budgetTotal ?? 0;
  const budgetSpent = active?.budgetSpent ?? 0;
  const openWebCreate = async (module: string) => {
    if (!online || !activeProjectId) {
      Alert.alert('Connectivity required', `Creating this ${module.replace('-', ' ')} is online-only and is never silently queued.`);
      return;
    }
    try {
      await Linking.openURL(new URL(`/projects/${activeProjectId}/${module}/new`, mobileConfig.apiBaseUrl).toString());
    } catch {
      Alert.alert('Could not open RailCommand web', 'Your saved mobile work is unchanged. Check connectivity and try again.');
    }
  };
  return <Screen>
    <WebHeader projectName={active?.name ?? 'Select project'} online={online} expanded={projectsOpen}
      onProjectPress={hasProjectChoice ? () => setProjectsOpen((open) => !open) : undefined} />
    <BreadcrumbRow current="Dashboard" />
    <View style={styles.projectHeading}><Text style={styles.projectEyebrow}>PROJECT CONTROL / LIVE OVERVIEW</Text><View style={styles.projectTitleRow}><Text accessibilityRole="header" style={styles.projectTitle}>{active?.name ?? 'Dashboard'}</Text>{active ? <Text style={styles.activeBadge}>ACTIVE</Text> : null}</View><Text style={styles.projectDetail}>{active?.client || active?.location || 'Select an authorized project workspace'}</Text></View>
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
      <MetricTile label="BUDGET" value={budgetTotal ? `$${(budgetTotal / 1_000_000).toFixed(1)}M` : '—'} detail={budgetTotal ? `$${(budgetSpent / 1_000_000).toFixed(1)}M spent` : 'Restricted'}
        icon={<SymbolView accessible={false} name={{ ios: 'dollarsign', android: 'attach_money', web: 'attach_money' }} tintColor={colors.ink} size={17} />} />
      <MetricTile label="SCHEDULE" value={`${schedulePercent}%`} detail="On schedule"
        icon={<SymbolView accessible={false} name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={colors.successBright} size={17} />} />
      <MetricTile label="SUBMITTALS" value={dashboard?.submittalsTotal ?? 0} detail={`${dashboard?.submittalsPending ?? 0} pending review`}
        icon={<SymbolView accessible={false} name={{ ios: 'doc.text', android: 'description', web: 'description' }} tintColor={colors.info} size={17} />} />
      <MetricTile label="OPEN RFIS" value={dashboard?.openRfis ?? 0} detail={`${dashboard?.overdueRfis ?? 0} overdue`}
        icon={<SymbolView accessible={false} name={{ ios: 'ellipsis.message', android: 'chat', web: 'chat' }} tintColor={colors.info} size={17} />} />
      <MetricTile label="PUNCH LIST" value={`${dashboard?.openPunchItems ?? 0} open`} detail={`${dashboard?.criticalPunchItems ?? 0} critical`}
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
          <Pressable accessibilityRole="button" onPress={() => void openWebCreate('rfis')} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}><SymbolView accessible={false} name={{ ios: 'bubble.left.and.text.bubble.right', android: 'chat', web: 'chat' }} tintColor={colors.muted} size={23} /><Text style={styles.actionText}>New RFI</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void openWebCreate('submittals')} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}><SymbolView accessible={false} name={{ ios: 'doc.badge.plus', android: 'note_add', web: 'note_add' }} tintColor={colors.muted} size={23} /><Text style={styles.actionText}>New Submittal</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void openWebCreate('punch-list')} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}><SymbolView accessible={false} name={{ ios: 'clipboard', android: 'assignment_add', web: 'assignment_add' }} tintColor={colors.muted} size={23} /><Text style={styles.actionText}>New Punch Item</Text></Pressable>
        </View>
        {!active?.canEdit && active ? <Text style={styles.warning}>Your project role is read-only. Daily-log creation is unavailable.</Text> : null}
      </Card>
      <Card><SectionTitle>Milestones</SectionTitle><Text style={styles.milestoneEmpty}>No milestones yet.</Text></Card>
    </View>
    <RailBotButton />
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  projectHeading: { gap: 7, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  projectEyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  projectTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  projectTitle: { flexShrink: 1, color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 29, lineHeight: 36, letterSpacing: -1.25 },
  activeBadge: { color: colors.success, backgroundColor: '#E8F8F1', paddingHorizontal: 8, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 8, lineHeight: 11, letterSpacing: 1.1 },
  projectDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
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
  milestoneEmpty: { minHeight: 100, color: colors.muted, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, textAlign: 'center', textAlignVertical: 'center' },
});
