import type { MobileRfi } from '@railcommand/domain';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Screen, StatusBanner } from '@/components/ui';
import { BreadcrumbRow, FilterTabs, ModuleHeading, RailBotButton, WebActionButton, WebEmpty, WebHeader, WebSearch } from '@/components/web-shell';
import { mobileConfig } from '@/lib/config';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const filters = ['All', 'Open', 'Answered', 'Closed', 'Overdue'] as const;
type Filter = typeof filters[number];
const filterStatus: Record<Filter, MobileRfi['status'] | null> = { All: null, Open: 'open', Answered: 'answered', Closed: 'closed', Overdue: 'overdue' };

export default function RfisScreen() {
  const { activeProjectId, bootstrap, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const records = useMemo(() => bootstrap?.rfis ?? [], [bootstrap?.rfis]);
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => records.filter((item) => {
    const status = filterStatus[filter];
    const query = search.trim().toLocaleLowerCase();
    return (!status || item.status === status) && (!query || `${item.number} ${item.subject}`.toLocaleLowerCase().includes(query));
  }), [filter, records, search]);

  const openWeb = async (suffix = '') => {
    if (!online || !activeProjectId) {
      Alert.alert('RFIs are online-only', 'Cached RFIs remain readable, but creation and export require connectivity.');
      return;
    }
    const url = new URL(`/projects/${activeProjectId}/rfis${suffix}`, mobileConfig.apiBaseUrl);
    try {
      await Linking.openURL(url.toString());
    } catch {
      Alert.alert('Could not open RFIs on web', 'Cached records and saved mobile work are unchanged. Check connectivity and try again.');
    }
  };

  return <Screen>
    <WebHeader projectName={project?.name ?? 'Select project'} online={online} onProjectPress={() => router.push('/(tabs)')} />
    <BreadcrumbRow current="RFIs" />
    <ModuleHeading title="RFIs" subtitle={`${records.length} item${records.length === 1 ? '' : 's'}`} actions={<>
      <WebActionButton title="Export PDF" onPress={() => void openWeb('?export=pdf')} icon={<SymbolView accessible={false} name={{ ios: 'document.badge.arrow.up', android: 'download', web: 'download' }} tintColor={colors.ink} size={19} />} />
      <WebActionButton title="New RFI" primary onPress={() => void openWeb('/new')} icon={<SymbolView accessible={false} name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={colors.white} size={19} />} />
    </>} />
    {!online ? <StatusBanner tone="warning" title="Offline — showing saved RFIs" detail="Previously synchronized records remain readable. Creating, responding, editing, and exporting are online-only and are never silently queued." /> : null}
    <FilterTabs items={filters} selected={filter} onSelect={(value) => setFilter(value as Filter)} />
    <WebSearch value={search} onChangeText={setSearch} placeholder="Search RFIs…" />
    {visible.length ? <View style={styles.list}>{visible.map((item) => <View key={item.id} style={styles.row}>
      <View style={styles.rowTop}><Text style={styles.number}>{item.number}</Text><Text style={styles.status}>{item.status}</Text></View>
      <Text style={styles.title}>{item.subject}</Text>
      <Text style={styles.meta}>{item.priority.toUpperCase()} · Due {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString()}</Text>
    </View>)}</View> : <WebEmpty>No RFIs match your filters.</WebEmpty>}
    <RailBotButton />
  </Screen>;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { gap: 5, padding: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  number: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 10, lineHeight: 14 },
  status: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, textTransform: 'capitalize' },
  title: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  meta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
});
