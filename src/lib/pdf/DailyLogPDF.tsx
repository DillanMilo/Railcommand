import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import styles, { colors } from './styles';
import type { DailyLog } from '@/lib/types';

interface DailyLogPDFProps {
  log: DailyLog;
  projectName: string;
  generatedBy: string;
}

const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return d.split('T')[0];
};

const DailyLogPDF: React.FC<DailyLogPDFProps> = ({ log, projectName, generatedBy }) => {
  const now = new Date().toISOString().split('T')[0];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
          <Text style={styles.reportTitle}>Daily Log Report</Text>
          <Text style={styles.headerMeta}>Project: {projectName}</Text>
          <Text style={styles.headerMeta}>Log Date: {formatDate(log.log_date)}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Weather */}
        <Text style={styles.sectionTitle}>Weather</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{log.weather_temp}°F</Text>
            <Text style={styles.summaryLabel}>Temperature</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { fontSize: 12 }]}>{log.weather_conditions}</Text>
            <Text style={styles.summaryLabel}>Conditions</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { fontSize: 12 }]}>{log.weather_wind}</Text>
            <Text style={styles.summaryLabel}>Wind</Text>
          </View>
        </View>

        {/* Work Summary */}
        <Text style={styles.sectionTitle}>Work Summary</Text>
        <Text style={styles.sectionBody}>{log.work_summary}</Text>

        {/* Personnel Table */}
        {log.personnel.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Personnel</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: '40%' }]}>Role</Text>
                <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Headcount</Text>
                <Text style={[styles.tableHeaderCell, { width: '40%' }]}>Company</Text>
              </View>
              {log.personnel.map((p, i) => (
                <View
                  key={p.id}
                  style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: '40%' }]}>{p.role}</Text>
                  <Text style={[styles.tableCell, { width: '20%' }]}>{p.headcount}</Text>
                  <Text style={[styles.tableCell, { width: '40%' }]}>{p.company}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Equipment Table */}
        {log.equipment.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Equipment</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: '40%' }]}>Type</Text>
                <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Count</Text>
                <Text style={[styles.tableHeaderCell, { width: '40%' }]}>Notes</Text>
              </View>
              {log.equipment.map((e, i) => (
                <View
                  key={e.id}
                  style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: '40%' }]}>{e.equipment_type}</Text>
                  <Text style={[styles.tableCell, { width: '20%' }]}>{e.count}</Text>
                  <Text style={[styles.tableCell, { width: '40%' }]}>{e.notes}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Work Items Table */}
        {log.work_items.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Work Items</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Description</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Quantity</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Unit</Text>
                <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Location</Text>
              </View>
              {log.work_items.map((w, i) => (
                <View
                  key={w.id}
                  style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: '35%' }]}>{w.description}</Text>
                  <Text style={[styles.tableCell, { width: '15%' }]}>{w.quantity}</Text>
                  <Text style={[styles.tableCell, { width: '15%' }]}>{w.unit}</Text>
                  <Text style={[styles.tableCell, { width: '35%' }]}>{w.location}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Safety Notes */}
        {log.safety_notes && (
          <>
            <Text style={styles.sectionTitle}>Safety Notes</Text>
            <Text style={styles.sectionBody}>{log.safety_notes}</Text>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>RailCommand by A5 Rail — {now}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

export default DailyLogPDF;
