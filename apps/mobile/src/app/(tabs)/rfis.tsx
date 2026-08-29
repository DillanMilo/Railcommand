import { StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, PageHeading, Screen, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function RfisScreen() {
  const { activeProjectId, bootstrap, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="PROJECT CONTROL / RFIS" title="RFIs" badge="WEB WORKFLOW"
      detail="Keep project questions, assignments, due dates, responses, and status history in one controlled record." />
    <StatusBanner tone={online ? 'neutral' : 'warning'}
      title={online ? 'Native workflow not included in this field release' : 'RFIs require connectivity'}
      detail="This screen matches RailCommand’s module structure without claiming that native RFI records are available. Use RailCommand web for authorized RFI work." />
    <Card><Text style={styles.eyebrow}>WORKFLOW STATUS</Text><SectionTitle>Online-only in this Release</SectionTitle>
      <Text style={uiStyles.muted}>RFI lists, filters, detail history, responses, attachments, and creation will become native only with mobile-safe authenticated endpoints and complete permission, retry, error, and conflict states.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
});
