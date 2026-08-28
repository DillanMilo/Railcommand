import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, Screen, SecondaryButton, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function TeamScreen() {
  const { bootstrap, activeProjectId, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  return <Screen>
    <BrandHeader eyebrow="OFFLINE READ-ONLY CACHE" title="Project team" right={<StatusPill online={online} />} />
    <SecondaryButton title="Back" onPress={() => router.back()} />
    <Card><Text style={styles.project}>{project?.name ?? 'No active project'}</Text>
      {bootstrap?.team.length ? bootstrap.team.map((member) => <View key={member.id} style={styles.member}>
        <View style={styles.avatar}><Text style={styles.initial}>{member.fullName.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.name}>{member.fullName}</Text><Text style={uiStyles.muted}>{member.email}</Text></View>
        <Text style={styles.role}>{member.role.replace('_', ' ')}</Text>
      </View>) : <EmptyState title="No cached team" detail="Connect once to synchronize the active project team." />}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  project: { color: colors.ink, fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontFamily: fonts.heading },
  name: { color: colors.ink, fontFamily: fonts.bodyBold },
  role: { color: colors.orange, fontFamily: fonts.mono, fontSize: 9, textTransform: 'uppercase' },
});
