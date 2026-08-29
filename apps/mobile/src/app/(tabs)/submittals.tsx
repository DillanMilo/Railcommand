import { StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, PageHeading, Screen, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function SubmittalsScreen() {
  const { activeProjectId, bootstrap, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="PROJECT CONTROL / SUBMITTALS" title="Submittals" badge="WEB WORKFLOW"
      detail="Track packages, review status, due dates, and responses using RailCommand’s project record structure." />
    <StatusBanner tone={online ? 'neutral' : 'warning'}
      title={online ? 'Native workflow not included in this field release' : 'Submittals require connectivity'}
      detail="This screen preserves RailCommand’s information architecture without presenting a dead or incomplete record control. Use RailCommand web for authorized submittal work." />
    <Card><Text style={styles.eyebrow}>WORKFLOW STATUS</Text><SectionTitle>Online-only in this Release</SectionTitle>
      <Text style={uiStyles.muted}>Submittal lists, detail review, attachments, routing, and creation will become native only when their authenticated mobile endpoints and complete loading, empty, failure, permission, and conflict states are implemented.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
});
