import type { MobileRecordDetail } from '@railcommand/domain';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ModuleHeading } from './web-shell';
import { colors, fonts } from '@/theme';

const date = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};
const statusLabel = (status: string) => status === 'conditional' ? 'Approved with conditions' : status.replaceAll('_', ' ');

export function RecordBody({ detail }: { detail: MobileRecordDetail }) {
  const { width, fontScale } = useWindowDimensions();
  const row = detail.record;
  const metadata: [string, string][] = [
    ['Submitted by', row.submittedBy?.name ?? 'Unknown'], ['Submit date', date(row.submitDate)], ['Due date', date(row.dueDate)],
    ...(detail.kind === 'rfis' ? [
      ['Assigned to', detail.record.assignedTo?.name ?? 'Unassigned'], ['Priority', detail.record.priority],
    ] as [string, string][] : [
      ['Reviewed by', detail.record.reviewedBy?.name ?? 'Not reviewed'], ['Review date', date(detail.record.reviewDate)],
    ] as [string, string][]),
    ['Linked milestone', detail.milestone?.name ?? 'None'],
  ];
  return <>
    <ModuleHeading title={detail.kind === 'rfis' ? `${row.number}: ${detail.record.subject}` : `${row.number}: ${detail.record.title}`}
      subtitle={detail.kind === 'submittals' && detail.record.specSection ? `Spec section: ${detail.record.specSection}` : undefined}
      badges={<Text style={[styles.badge, ['approved', 'answered', 'closed'].includes(row.status) && styles.success]}>{statusLabel(row.status)}</Text>} />
    <View style={styles.grid}>{metadata.map(([label, value]) => <View key={label} style={[styles.metadata, width >= 600 && fontScale <= 1.4 && styles.metadataWide]}>
      <Text style={styles.muted}>{label}</Text><Text style={styles.value}>{value}</Text>
    </View>)}</View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{detail.kind === 'rfis' ? 'Question' : 'Description'}</Text>
      <Text selectable style={styles.body}>{(detail.kind === 'rfis' ? detail.record.question : detail.record.description) || 'No description provided.'}</Text>
    </View>
    {detail.kind === 'rfis' ? <>
      {detail.record.answer ? <View style={[styles.card, styles.success]}><Text accessibilityRole="header" style={styles.heading}>Answer</Text><Text selectable style={styles.body}>{detail.record.answer}</Text></View> : null}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Responses ({detail.record.responses.length})</Text>
        {!detail.record.responses.length ? <Text style={styles.muted}>No responses yet.</Text> : detail.record.responses.map((response) => <View key={response.id} style={[styles.response, response.official && styles.success]}>
          <Text style={styles.value}>{response.author?.name ?? 'Unknown'} · {date(response.createdAt)}</Text>
          {response.official ? <Text style={styles.badge}>Official response</Text> : null}
          <Text selectable style={styles.body}>{response.content}</Text>
        </View>)}
      </View>
    </> : <>
      <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Timeline</Text><Timeline detail={detail} /></View>
      {detail.record.reviewNotes ? <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Review notes</Text><Text selectable style={styles.body}>{detail.record.reviewNotes}</Text></View> : null}
    </>}
  </>;
}

function Timeline({ detail }: { detail: Extract<MobileRecordDetail, { kind: 'submittals' }> }) {
  const row = detail.record;
  const reviewed = ['approved', 'conditional', 'rejected'].includes(row.status);
  const steps = [
    { label: 'Created', done: true, current: false, when: row.createdAt, who: row.submittedBy?.name },
    { label: 'Submitted', done: row.status !== 'draft', current: false, when: row.status !== 'draft' ? row.submitDate : null },
    { label: 'Under review', done: reviewed, current: row.status === 'under_review', when: null },
    { label: reviewed ? statusLabel(row.status) : 'Decision', done: reviewed, current: false, when: row.reviewDate, who: reviewed ? row.reviewedBy?.name : null },
  ];
  return <View>{steps.map((step, index) => <View key={step.label} style={styles.timelineRow}>
    <View style={styles.timelineRail}>
      <Text accessible={false} style={[styles.step, (step.done || step.current) && styles.stepDone]}>{step.done ? '✓' : step.current ? '•' : '○'}</Text>
      {index < steps.length - 1 ? <View style={styles.connector} /> : null}
    </View>
    <View style={styles.timelineText}><Text style={styles.value}>{step.label}</Text>
      <Text style={styles.muted}>{step.current ? 'In progress' : !step.done ? 'Upcoming' : step.when ? date(step.when) : 'Completed'}{step.who ? ` · ${step.who}` : ''}</Text>
    </View>
  </View>)}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 8, padding: 16, gap: 12 },
  heading: { fontFamily: fonts.heading, color: colors.ink, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  value: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14, lineHeight: 21 },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metadata: { width: '100%', padding: 14, gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.paper },
  metadataWide: { width: '48%' },
  badge: { alignSelf: 'flex-start', flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E2E8F0', color: colors.ink, textTransform: 'capitalize' },
  success: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  response: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 6, gap: 8 },
  timelineRow: { flexDirection: 'row', gap: 12, minHeight: 72 },
  timelineRail: { alignItems: 'center', width: 28 },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', textAlign: 'center', lineHeight: 28, color: colors.muted },
  stepDone: { backgroundColor: '#D1FAE5', color: colors.success },
  connector: { width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 4 },
  timelineText: { flex: 1, gap: 4, paddingBottom: 20 },
});
export { styles as recordStyles };
