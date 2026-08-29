import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, PageHeading, Screen, SecondaryButton, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function TeamScreen() {
  const { bootstrap, activeProjectId, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const getInitials = (name: string) => name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="PROJECT ACCESS / TEAM" title="Project Team"
      badge={`${bootstrap?.team.length ?? 0} CACHED`} detail="People and field roles synchronized for this project." />
    <SecondaryButton title="Back" onPress={() => router.back()} />
    <StatusBanner tone={online ? 'success' : 'warning'}
      title={online ? 'Project roster synchronized' : 'Saved project team — read only'}
      detail={online ? 'This roster remains available when the device loses connectivity.' : 'Cached membership is reference data only. Reconnect before managing project access.'} />
    <View style={styles.listHeader}><Text style={styles.eyebrow}>TEAM MEMBERS</Text><Text style={uiStyles.muted}>{project?.name ?? 'No active project'}</Text></View>
    {bootstrap?.team.length ? bootstrap.team.map((member) => <View key={member.id} style={styles.member}>
        <View style={styles.avatar}><Text style={styles.initial}>{getInitials(member.fullName)}</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.name}>{member.fullName}</Text><Text style={uiStyles.muted}>{member.email}</Text></View>
        <Text style={styles.role}>{member.role.replace('_', ' ')}</Text>
      </View>) : <Card><EmptyState title="No cached team" detail="Connect once to synchronize the active project team." /></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  listHeader: { gap: 4 },
  member: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontFamily: fonts.heading, fontSize: 12 },
  name: { color: colors.ink, fontFamily: fonts.bodyBold },
  role: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, textTransform: 'uppercase' },
});
