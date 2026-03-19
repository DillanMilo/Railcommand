import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import styles, { statusColorMap, priorityColorMap, colors } from './styles';
import type { PunchListItem } from '@/lib/types';

interface PunchListPDFProps {
  items: PunchListItem[];
  projectName: string;
  generatedBy: string;
}

const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return d.split('T')[0];
};

const formatLabel = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const cols = ['8%', '24%', '16%', '12%', '10%', '16%', '14%'] as const;

const PunchListPDF: React.FC<PunchListPDFProps> = ({ items, projectName, generatedBy }) => {
  const now = new Date().toISOString().split('T')[0];

  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const byPriority = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.priority] = (acc[item.priority] || 0) + 1;
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
          <Text style={styles.reportTitle}>Punch List Report</Text>
          <Text style={styles.headerMeta}>Project: {projectName}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{items.length}</Text>
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
            <Text style={[styles.tableHeaderCell, { width: cols[1] }]}>Title</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[2] }]}>Location</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[3] }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[4] }]}>Priority</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[5] }]}>Assigned To</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[6] }]}>Due Date</Text>
          </View>

          {items.map((item, i) => {
            const statusColor = statusColorMap[item.status] || colors.primary;
            const prioColor = priorityColorMap[item.priority] || colors.primary;
            return (
              <View
                key={item.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, { width: cols[0] }]}>{item.number}</Text>
                <Text style={[styles.tableCell, { width: cols[1] }]}>{item.title}</Text>
                <Text style={[styles.tableCell, { width: cols[2] }]}>{item.location}</Text>
                <Text
                  style={[
                    styles.badge,
                    { color: '#ffffff', backgroundColor: statusColor, width: cols[3] },
                  ]}
                >
                  {formatLabel(item.status)}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    { color: '#ffffff', backgroundColor: prioColor, width: cols[4] },
                  ]}
                >
                  {formatLabel(item.priority)}
                </Text>
                <Text style={[styles.tableCell, { width: cols[5] }]}>
                  {item.assigned_to_profile?.full_name ?? item.assigned_to}
                </Text>
                <Text style={[styles.tableCell, { width: cols[6] }]}>{formatDate(item.due_date)}</Text>
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

export default PunchListPDF;
