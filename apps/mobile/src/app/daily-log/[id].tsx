import { router, useLocalSearchParams } from 'expo-router';
import { normalizeDailyLogReadFields } from '@railcommand/domain';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, EmptyState, PageHeading, Screen, SecondaryButton, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { shareDailyLogSummary } from '@/lib/device';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const unavailableFields = 'Not available in this cached copy. Reconnect and refresh the project.';

export default function DailyLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProjectId, bootstrap, online } = useMobileData();
  const log = bootstrap?.dailyLogs.find((item) => item.id === id && item.projectId === activeProjectId);
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const fields = normalizeDailyLogReadFields(log);
  const displayDate = log ? new Date(`${log.logDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : 'Daily Log';
  return <Screen>
    <BrandHeader title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="FIELD RECORD / DAILY LOG" title={displayDate}
      badge={log ? 'READ ONLY' : undefined} detail="Synchronized project record cached for field reference." />
    <SecondaryButton title="Back to logs" onPress={() => router.back()} />
    {!log ? <Card><EmptyState title="Record unavailable" detail="This log is not in the recent device cache. Reconnect and refresh the project." /></Card> : <>
      <StatusBanner tone={online ? 'success' : 'warning'} title={online ? 'Cached copy available offline' : 'Viewing saved device data'}
        detail="Existing-record editing is unavailable in this field release. Reconnect and use RailCommand web for authorized edits." />
      <Text style={uiStyles.muted}>{log.authorName || 'Team member'} · {new Date(log.createdAt).toLocaleString()} · {log.id.slice(0, 8)}</Text>
      <Card><Text style={styles.eyebrow}>WEATHER</Text><SectionTitle>Field conditions</SectionTitle>
        <Text style={styles.value}>{log.weatherConditions || 'Not recorded'}</Text>
        <Text style={styles.label}>Temperature</Text>
        <Text style={styles.value}>{fields.weatherTemp === undefined ? unavailableFields : fields.weatherTemp === null ? 'Not recorded' : `${fields.weatherTemp}°F`}</Text>
        <Text style={styles.label}>Wind</Text>
        <Text style={styles.value}>{fields.weatherWind === undefined ? unavailableFields : fields.weatherWind || 'Not recorded'}</Text>
      </Card>
      <Card><Text style={styles.eyebrow}>CREW</Text><SectionTitle>Personnel</SectionTitle>
        {fields.personnel === undefined ? <Text style={uiStyles.muted}>{unavailableFields}</Text>
          : fields.personnel.length === 0 ? <Text style={uiStyles.muted}>No personnel recorded.</Text>
            : fields.personnel.map((row) => <View key={row.id} style={styles.row}>
              <Text style={styles.label}>{row.role || 'Role not recorded'}</Text>
              <Text style={styles.value}>Headcount: {row.headcount}</Text>
              <Text style={styles.value}>{row.company || 'Company not recorded'}</Text>
            </View>)}
      </Card>
      <Card><Text style={styles.eyebrow}>RESOURCES</Text><SectionTitle>Equipment</SectionTitle>
        {fields.equipment === undefined ? <Text style={uiStyles.muted}>{unavailableFields}</Text>
          : fields.equipment.length === 0 ? <Text style={uiStyles.muted}>No equipment recorded.</Text>
            : fields.equipment.map((row) => <View key={row.id} style={styles.row}>
              <Text style={styles.label}>{row.equipmentType || 'Equipment type not recorded'}</Text>
              <Text style={styles.value}>Count: {row.count}</Text>
              <Text style={styles.value}>{row.notes || 'No equipment notes recorded.'}</Text>
            </View>)}
      </Card>
      <Card><Text style={styles.eyebrow}>PRODUCTION</Text><SectionTitle>Work Items</SectionTitle>
        {fields.workItems === undefined ? <Text style={uiStyles.muted}>{unavailableFields}</Text>
          : fields.workItems.length === 0 ? <Text style={uiStyles.muted}>No work items recorded.</Text>
            : fields.workItems.map((row) => <View key={row.id} style={styles.row}>
              <Text style={styles.label}>{row.description || 'Description not recorded'}</Text>
              <Text style={styles.value}>Quantity: {row.quantity}{row.unit ? ` ${row.unit}` : ''}</Text>
              <Text style={styles.value}>{row.location || 'Location not recorded'}</Text>
            </View>)}
      </Card>
      <Card><Text style={styles.eyebrow}>FIELD ACTIVITY</Text><SectionTitle>Work Summary</SectionTitle><Text style={styles.value}>{log.workSummary || 'Not recorded'}</Text></Card>
      <Card><Text style={styles.eyebrow}>SAFETY</Text><SectionTitle>Safety Notes</SectionTitle><Text style={styles.value}>{log.safetyNotes || 'Not recorded'}</Text></Card>
      <Card><Text style={styles.eyebrow}>FIELD LOCATION</Text><SectionTitle>GPS location</SectionTitle>
        {fields.geoTag === undefined ? <Text style={uiStyles.muted}>{unavailableFields}</Text>
          : fields.geoTag === null ? <Text style={uiStyles.muted}>Not recorded</Text> : <>
            <Text selectable style={styles.value}>{fields.geoTag.lat.toFixed(6)}, {fields.geoTag.lng.toFixed(6)}</Text>
            {fields.geoTag.accuracy !== undefined ? <Text style={styles.value}>Accuracy: {fields.geoTag.accuracy} m</Text> : null}
            {fields.geoTag.altitude !== undefined ? <Text style={styles.value}>Altitude: {fields.geoTag.altitude} m</Text> : null}
            <Text style={uiStyles.muted}>Captured: {new Date(fields.geoTag.timestamp).toLocaleString()}</Text>
          </>}
      </Card>
      <SecondaryButton title="Share summary" onPress={() => void shareDailyLogSummary(`${log.logDate}\n${log.workSummary}\n${log.safetyNotes}`)} />
      <Text style={uiStyles.muted}>Existing-record editing is unavailable in this version. Use RailCommand on the web when connected.</Text>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  label: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  value: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  row: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 4 },
});
