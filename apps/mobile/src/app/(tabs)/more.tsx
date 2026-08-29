import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, PageHeading, Screen, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const webModules = ['Punch List', 'Safety', 'QC/QA', 'Documents', 'Photos', 'Reports', 'Schedule'];

export default function MoreScreen() {
  const { activeProjectId, bootstrap, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  return <Screen>
    <BrandHeader eyebrow="ACTIVE PROJECT" title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="RAILCOMMAND / MORE" title="More" detail="Device operations, project reference data, profile, privacy, and deferred web modules." />
    <View style={styles.links}>
      <Link href="/(tabs)/sync" asChild><Pressable accessibilityRole="link" style={styles.link}><Text style={styles.linkTitle}>Sync Center</Text><Text style={styles.linkDetail}>Review pending, failed, and synchronized device work</Text><Text style={styles.open}>OPEN</Text></Pressable></Link>
      <Link href="/team" asChild><Pressable accessibilityRole="link" style={styles.link}><Text style={styles.linkTitle}>Project Team</Text><Text style={styles.linkDetail}>{bootstrap?.team.length ?? 0} members cached for offline reference</Text><Text style={styles.open}>OPEN</Text></Pressable></Link>
      <Link href="/(tabs)/account" asChild><Pressable accessibilityRole="link" style={styles.link}><Text style={styles.linkTitle}>Account</Text><Text style={styles.linkDetail}>Notifications, support, privacy, and safe sign-out</Text><Text style={styles.open}>OPEN</Text></Pressable></Link>
    </View>
    <Card><Text style={styles.eyebrow}>WEB MODULES</Text><SectionTitle>Available on RailCommand Web</SectionTitle>
      <View style={styles.moduleGrid}>{webModules.map((module) => <View key={module} style={styles.module}><Text style={styles.moduleName}>{module}</Text><Text style={styles.moduleState}>ONLINE-ONLY</Text></View>)}</View>
      <Text style={uiStyles.muted}>These are intentionally non-interactive until their complete native workflows exist. The field app does not claim full offline project work.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  links: { gap: 10 },
  link: { minHeight: 100, padding: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, gap: 5, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 1 },
  linkTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 16, lineHeight: 21 },
  linkDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  open: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 8, lineHeight: 11, letterSpacing: 1.1, marginTop: 5 },
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  module: { width: '48%', minHeight: 60, justifyContent: 'space-between', padding: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  moduleName: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  moduleState: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, lineHeight: 10, letterSpacing: 0.8 },
});
