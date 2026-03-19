import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import styles, { statusColorMap, priorityColorMap, colors } from './styles';
import type { RFI } from '@/lib/types';

interface RFIsPDFProps {
  rfis: RFI[];
  projectName: string;
  generatedBy: string;
}

const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return d.split('T')[0];
};

const formatLabel = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const daysBetween = (from: string, to: string): number => {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

const cols = ['7%', '22%', '10%', '10%', '13%', '13%', '13%', '12%'] as const;

const RFIsPDF: React.FC<RFIsPDFProps> = ({ rfis, projectName, generatedBy }) => {
  const now = new Date().toISOString().split('T')[0];

  const byStatus = rfis.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const byPriority = rfis.reduce<Record<string, number>>((acc, r) => {
    acc[r.priority] = (acc[r.priority] || 0) + 1;
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
          <Text style={styles.reportTitle}>RFIs Report</Text>
          <Text style={styles.headerMeta}>Project: {projectName}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{rfis.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          {Object.entries(byStatus).map(([status, count]) => (
            <View key={status} style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: statusColorMap[status] || colors.primary }]}>
                {count}
              </Text>
              <Text style={styles.summaryLabel}>{formatLabel(status)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryRow}>
          {Object.entries(byPriority).map(([priority, count]) => (
            <View key={priority} style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: priorityColorMap[priority] || colors.primary }]}>
                {count}
              </Text>
              <Text style={styles.summaryLabel}>{formatLabel(priority)}</Text>
            </View>
          ))}
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: cols[0] }]}>Number</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[1] }]}>Subject</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[2] }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[3] }]}>Priority</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[4] }]}>Submitted By</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[5] }]}>Assigned To</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[6] }]}>Due Date</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[7] }]}>Days Open</Text>
          </View>

          {rfis.map((r, i) => {
            const daysOpen = daysBetween(r.submit_date, r.response_date ?? now);
            const statusColor = statusColorMap[r.status] || colors.primary;
            const prioColor = priorityColorMap[r.priority] || colors.primary;
            return (
              <View
                key={r.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, { width: cols[0] }]}>{r.number}</Text>
                <Text style={[styles.tableCell, { width: cols[1] }]}>{r.subject}</Text>
                <Text
                  style={[
                    styles.badge,
                    { color: '#ffffff', backgroundColor: statusColor, width: cols[2] },
                  ]}
                >
                  {formatLabel(r.status)}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    { color: '#ffffff', backgroundColor: prioColor, width: cols[3] },
                  ]}
                >
                  {formatLabel(r.priority)}
                </Text>
                <Text style={[styles.tableCell, { width: cols[4] }]}>
                  {r.submitted_by_profile?.full_name ?? r.submitted_by}
                </Text>
                <Text style={[styles.tableCell, { width: cols[5] }]}>
                  {r.assigned_to_profile?.full_name ?? r.assigned_to}
                </Text>
                <Text style={[styles.tableCell, { width: cols[6] }]}>{formatDate(r.due_date)}</Text>
                <Text style={[styles.tableCell, { width: cols[7] }]}>{daysOpen}</Text>
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

export default RFIsPDF;
