import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import styles, { statusColorMap, colors } from './styles';
import type { Submittal } from '@/lib/types';

interface SubmittalsPDFProps {
  submittals: Submittal[];
  projectName: string;
  generatedBy: string;
}

const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return d.split('T')[0];
};

const formatStatus = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const daysBetween = (from: string, to: string): number => {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

const colWidths = ['8%', '28%', '12%', '12%', '15%', '13%', '12%'] as const;

const SubmittalsPDF: React.FC<SubmittalsPDFProps> = ({
  submittals,
  projectName,
  generatedBy,
}) => {
  const now = new Date().toISOString().split('T')[0];
  const byStatus = submittals.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brandTitle}>RailCommand</Text>
              <Text style={styles.brandSubtitle}>by A5 Rail</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.headerMeta}>Generated: {now}</Text>
              <Text style={styles.headerMeta}>By: {generatedBy}</Text>
            </View>
          </View>
          <Text style={styles.reportTitle}>Submittals Report</Text>
          <Text style={styles.headerMeta}>Project: {projectName}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{submittals.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          {Object.entries(byStatus).map(([status, count]) => (
            <View key={status} style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: statusColorMap[status] || colors.primary }]}>
                {count}
              </Text>
              <Text style={styles.summaryLabel}>{formatStatus(status)}</Text>
            </View>
          ))}
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: colWidths[0] }]}>Number</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths[1] }]}>Title</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths[2] }]}>Spec Section</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths[3] }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths[4] }]}>Submitted By</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths[5] }]}>Due Date</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths[6] }]}>Days</Text>
          </View>

          {submittals.map((s, i) => {
            const days = daysBetween(s.submit_date, s.review_date ?? now);
            const statusColor = statusColorMap[s.status] || colors.primary;
            return (
              <View
                key={s.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, { width: colWidths[0] }]}>{s.number}</Text>
                <Text style={[styles.tableCell, { width: colWidths[1] }]}>{s.title}</Text>
                <Text style={[styles.tableCell, { width: colWidths[2] }]}>{s.spec_section}</Text>
                <Text
                  style={[
                    styles.badge,
                    { color: '#ffffff', backgroundColor: statusColor, width: colWidths[3] },
                  ]}
                >
                  {formatStatus(s.status)}
                </Text>
                <Text style={[styles.tableCell, { width: colWidths[4] }]}>
                  {s.submitted_by_profile?.full_name ?? s.submitted_by}
                </Text>
                <Text style={[styles.tableCell, { width: colWidths[5] }]}>{formatDate(s.due_date)}</Text>
                <Text style={[styles.tableCell, { width: colWidths[6] }]}>{days}</Text>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>RailCommand by A5 Rail — {now}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default SubmittalsPDF;
