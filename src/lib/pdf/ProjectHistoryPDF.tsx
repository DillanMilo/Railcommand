import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import styles, { colors, statusColorMap } from './styles';
import type { HistoryExportSection, ProjectHistoryExportData } from '@/lib/project-history-export';
import {
  buildNormalizedHistoryRows,
  formatHistoryCurrency,
  formatHistoryDate,
  formatHistoryLabel,
  hasExportSection,
} from '@/lib/project-history-export';

interface ProjectHistoryPDFProps {
  data: ProjectHistoryExportData;
  sections: HistoryExportSection[];
  generatedBy: string;
}

const localStyles = StyleSheet.create({
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    width: '31.8%',
    padding: 7,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.rowAlt,
    borderRadius: 3,
  },
  detailValue: {
    fontSize: 8,
    color: colors.primary,
  },
  tableText: {
    fontSize: 7,
    color: colors.primary,
    lineHeight: 1.25,
  },
  sectionMeta: {
    fontSize: 8,
    color: colors.secondary,
    marginBottom: 5,
  },
});

const rowColumns = [
  { label: 'Record', width: '14%' },
  { label: 'Title', width: '24%' },
  { label: 'Status', width: '11%' },
  { label: 'Date', width: '14%' },
  { label: 'Actor', width: '14%' },
  { label: 'Amount', width: '11%' },
  { label: 'Details', width: '12%' },
];

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && <Text style={localStyles.sectionMeta}>{count} record{count === 1 ? '' : 's'}</Text>}
    </>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TableHeader() {
  return (
    <View style={styles.tableHeaderRow}>
      {rowColumns.map((column) => (
        <Text key={column.label} style={[styles.tableHeaderCell, { width: column.width }]}>
          {column.label}
        </Text>
      ))}
    </View>
  );
}

function truncate(value: string, length = 120) {
  if (!value) return '--';
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function statusStyle(status: string, width: string) {
  if (!status) return [localStyles.tableText, { width }];
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  return [
    styles.badge,
    {
      width,
      color: colors.white,
      backgroundColor: statusColorMap[normalized] ?? colors.statusDraft,
    },
  ];
}

function ProjectSnapshot({ data }: { data: ProjectHistoryExportData }) {
  const items = [
    ['Client', data.project.client],
    ['Location', data.project.location],
    ['Status', formatHistoryLabel(data.project.status)],
    ['Start Date', formatHistoryDate(data.project.start_date)],
    ['Target End', formatHistoryDate(data.project.target_end_date)],
    ['Actual End', formatHistoryDate(data.project.actual_end_date)],
    ['Budget Total', formatHistoryCurrency(data.project.budget_total)],
    ['Budget Spent', formatHistoryCurrency(data.project.budget_spent)],
    ['Turnover', formatHistoryDate(data.project.turnover_date)],
    ['Substantial Completion', formatHistoryDate(data.project.substantial_completion_date)],
    ['Project Completion', formatHistoryDate(data.project.project_completion_date)],
    ['Created', formatHistoryDate(data.project.created_at)],
  ];

  return (
    <View wrap={false}>
      <SectionHeading title="Project Snapshot" />
      <View style={localStyles.detailGrid}>
        {items.map(([label, value]) => (
          <View key={label} style={localStyles.detailItem}>
            <Text style={styles.label}>{label}</Text>
            <Text style={localStyles.detailValue}>{value || '--'}</Text>
          </View>
        ))}
      </View>
      {data.project.description && <Text style={styles.sectionBody}>{data.project.description}</Text>}
    </View>
  );
}

const ProjectHistoryPDF: React.FC<ProjectHistoryPDFProps> = ({ data, sections, generatedBy }) => {
  const now = new Date().toISOString().split('T')[0];
  const rows = buildNormalizedHistoryRows(data, sections).filter((row) => row.section !== 'Project Snapshot');
  const rowsBySection = rows.reduce<Record<string, typeof rows>>((groups, row) => {
    groups[row.section] = groups[row.section] ?? [];
    groups[row.section].push(row);
    return groups;
  }, {});
  const approvedTotal = data.changeOrders
    .filter((changeOrder) => changeOrder.status === 'approved')
    .reduce((total, changeOrder) => total + changeOrder.amount, 0);
  const summaryCards = [
    ...(hasExportSection(sections, 'project')
      ? [{ label: 'Budget Total', value: formatHistoryCurrency(data.project.budget_total) }]
      : []),
    ...(hasExportSection(sections, 'milestones')
      ? [{ label: 'Milestones', value: data.milestones.length }]
      : []),
    ...(hasExportSection(sections, 'changeOrders')
      ? [
          { label: 'Change Orders', value: data.changeOrders.length },
          { label: 'Approved CO Total', value: formatHistoryCurrency(approvedTotal), color: colors.statusApproved },
        ]
      : []),
    ...(hasExportSection(sections, 'modifications')
      ? [{ label: 'Modifications', value: data.modifications.length }]
      : []),
    ...(hasExportSection(sections, 'activity')
      ? [{ label: 'Activity Items', value: data.activityLog.length }]
      : []),
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
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
          <Text style={styles.reportTitle}>Project History Export</Text>
          <Text style={styles.headerMeta}>Project: {data.project.name}</Text>
          <View style={styles.headerDivider} />
        </View>

        {summaryCards.length > 0 && (
          <View style={styles.summaryRow}>
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} label={card.label} value={card.value} color={card.color} />
            ))}
          </View>
        )}

        {hasExportSection(sections, 'project') && <ProjectSnapshot data={data} />}

        {Object.entries(rowsBySection).map(([section, sectionRows]) => (
          <View key={section}>
            <SectionHeading title={section} count={sectionRows.length} />
            <View style={styles.table}>
              <TableHeader />
              {sectionRows.map((row, index) => (
                <View key={`${row.section}-${row.record_id}-${index}`} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                  <Text style={[localStyles.tableText, { width: rowColumns[0].width }]}>
                    {row.number || row.record_type}
                  </Text>
                  <Text style={[localStyles.tableText, { width: rowColumns[1].width }]}>
                    {truncate(row.title || row.description)}
                  </Text>
                  <Text style={statusStyle(row.status, rowColumns[2].width)}>{row.status || '--'}</Text>
                  <Text style={[localStyles.tableText, { width: rowColumns[3].width }]}>
                    {row.date || '--'}
                  </Text>
                  <Text style={[localStyles.tableText, { width: rowColumns[4].width }]}>
                    {truncate(row.actor, 60)}
                  </Text>
                  <Text style={[localStyles.tableText, { width: rowColumns[5].width }]}>
                    {row.amount || '--'}
                  </Text>
                  <Text style={[localStyles.tableText, { width: rowColumns[6].width }]}>
                    {truncate(row.details || row.linked_milestone, 80)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>RailCommand by A5 Rail - {now}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default ProjectHistoryPDF;
