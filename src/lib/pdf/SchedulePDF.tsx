import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import styles, { statusColorMap, colors } from './styles';
import type { Milestone } from '@/lib/types';

interface SchedulePDFProps {
  milestones: Milestone[];
  projectName: string;
  generatedBy: string;
  budgetPlanned: number;
  budgetActual: number;
}

const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return d.split('T')[0];
};

const formatLabel = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatCurrency = (n: number): string =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const cols = ['22%', '12%', '14%', '14%', '19%', '19%'] as const;

const SchedulePDF: React.FC<SchedulePDFProps> = ({
  milestones,
  projectName,
  generatedBy,
  budgetPlanned,
  budgetActual,
}) => {
  const now = new Date().toISOString().split('T')[0];

  const totalComplete = milestones.filter((m) => m.status === 'complete').length;
  const avgProgress =
    milestones.length > 0
      ? Math.round(milestones.reduce((s, m) => s + m.percent_complete, 0) / milestones.length)
      : 0;
  const onTrack = milestones.filter((m) => m.status === 'on_track').length;
  const atRisk = milestones.filter((m) => m.status === 'at_risk').length;
  const behind = milestones.filter((m) => m.status === 'behind').length;

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
          <Text style={styles.reportTitle}>Schedule &amp; Milestones Report</Text>
          <Text style={styles.headerMeta}>Project: {projectName}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* KPIs */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{avgProgress}%</Text>
            <Text style={styles.summaryLabel}>Avg Progress</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.statusComplete }]}>
              {totalComplete}
            </Text>
            <Text style={styles.summaryLabel}>Complete</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.statusOnTrack }]}>{onTrack}</Text>
            <Text style={styles.summaryLabel}>On Track</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.statusAtRisk }]}>{atRisk}</Text>
            <Text style={styles.summaryLabel}>At Risk</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.statusBehind }]}>{behind}</Text>
            <Text style={styles.summaryLabel}>Behind</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{formatCurrency(budgetPlanned)}</Text>
            <Text style={styles.summaryLabel}>Budget Planned</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text
              style={[
                styles.summaryValue,
                { color: budgetActual > budgetPlanned ? colors.statusCritical : colors.statusOnTrack },
              ]}
            >
              {formatCurrency(budgetActual)}
            </Text>
            <Text style={styles.summaryLabel}>Budget Actual</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: cols[0] }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[1] }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[2] }]}>Target Date</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[3] }]}>% Complete</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[4] }]}>Budget Planned</Text>
            <Text style={[styles.tableHeaderCell, { width: cols[5] }]}>Budget Actual</Text>
          </View>

          {milestones.map((m, i) => {
            const statusColor = statusColorMap[m.status] || colors.primary;
            return (
              <View
                key={m.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, { width: cols[0] }]}>{m.name}</Text>
                <Text
                  style={[
                    styles.badge,
                    { color: '#ffffff', backgroundColor: statusColor, width: cols[1] },
                  ]}
                >
                  {formatLabel(m.status)}
                </Text>
                <Text style={[styles.tableCell, { width: cols[2] }]}>{formatDate(m.target_date)}</Text>
                <Text style={[styles.tableCell, { width: cols[3] }]}>{m.percent_complete}%</Text>
                <Text style={[styles.tableCell, { width: cols[4] }]}>{formatCurrency(m.budget_planned)}</Text>
                <Text style={[styles.tableCell, { width: cols[5] }]}>{formatCurrency(m.budget_actual)}</Text>
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

export default SchedulePDF;
