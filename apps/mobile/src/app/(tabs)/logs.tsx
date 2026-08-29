import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, StatusBanner } from '@/components/ui';
import { RailBotButton, WebHeader } from '@/components/web-shell';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
}

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function LogsScreen() {
  const { bootstrap, activeProjectId, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const [mode, setMode] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(() => new Date());
  const cells = useMemo(() => monthCells(month), [month]);
  const logsByDate = useMemo(() => new Map((bootstrap?.dailyLogs ?? []).map((log) => [log.logDate, log])), [bootstrap?.dailyLogs]);
  const today = dateKey(new Date());

  return <Screen>
    <WebHeader projectName={project?.name ?? 'Select project'} online={online} onProjectPress={() => router.push('/(tabs)')} />
    {!online ? <StatusBanner tone="warning" title="Offline — saved daily logs remain available" detail="New logs are saved as durable device drafts and queue safely. Existing synchronized logs remain read-only offline." /> : null}
    <Pressable accessibilityRole="button" disabled={!project?.canEdit} accessibilityState={{ disabled: !project?.canEdit }} onPress={() => router.push('/daily-log/new')} style={({ pressed }) => [styles.newLog, !project?.canEdit && styles.disabled, pressed && styles.pressed]}>
      <SymbolView accessible={false} name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={colors.white} size={20} />
      <Text style={styles.newLogText}>New Log</Text>
    </Pressable>
    <View accessibilityRole="tablist" style={styles.modeTabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'calendar' }} onPress={() => setMode('calendar')} style={[styles.modeTab, mode === 'calendar' && styles.modeTabActive]}>
        <SymbolView accessible={false} name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={mode === 'calendar' ? colors.orange : colors.muted} size={19} />
        <Text style={[styles.modeText, mode === 'calendar' && styles.modeTextActive]}>Calendar</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'list' }} onPress={() => setMode('list')} style={[styles.modeTab, mode === 'list' && styles.modeTabActive]}>
        <SymbolView accessible={false} name={{ ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' }} tintColor={mode === 'list' ? colors.orange : colors.muted} size={19} />
        <Text style={[styles.modeText, mode === 'list' && styles.modeTextActive]}>List</Text>
      </Pressable>
    </View>
    {mode === 'calendar' ? <>
      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={styles.monthButton}>
          <SymbolView accessible={false} name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor={colors.ink} size={18} />
        </Pressable>
        <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.monthButton}>
          <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={colors.ink} size={18} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setMonth(new Date())} style={styles.todayButton}><Text style={styles.todayText}>Today</Text></Pressable>
      </View>
      <View style={styles.calendar}>
        <View style={styles.weekdays}>{weekdays.map((day) => <View key={day} style={styles.weekday}><Text style={styles.weekdayText}>{day}</Text></View>)}</View>
        <View style={styles.days}>{cells.map((date) => {
          const key = dateKey(date);
          const log = logsByDate.get(key);
          const currentMonth = date.getMonth() === month.getMonth();
          return <Pressable
            key={key}
            accessibilityRole={log ? 'button' : undefined}
            accessibilityLabel={`${date.toLocaleDateString()}${log ? ', daily log recorded' : ''}`}
            disabled={!log}
            onPress={() => log && router.push(`/daily-log/${log.id}`)}
            style={[styles.day, !currentMonth && styles.dayOutside, key === today && styles.dayToday]}
          ><Text style={[styles.dayText, !currentMonth && styles.dayTextOutside, key === today && styles.dayTextToday]}>{date.getDate()}</Text>{log ? <View style={styles.logDot} /> : null}</Pressable>;
        })}</View>
      </View>
    </> : <View style={styles.list}>
      {(bootstrap?.dailyLogs ?? []).map((log) => <Pressable key={log.id} accessibilityRole="button" onPress={() => router.push(`/daily-log/${log.id}`)} style={styles.logRow}>
        <View style={{ flex: 1 }}><Text style={styles.logDate}>{new Date(`${log.logDate}T12:00:00`).toLocaleDateString()}</Text><Text numberOfLines={2} style={styles.logSummary}>{log.workSummary || 'No work summary recorded'}</Text></View>
        <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={colors.muted} size={18} />
      </Pressable>)}
      {(bootstrap?.dailyLogs.length ?? 0) === 0 ? <Text style={styles.empty}>No daily logs found.</Text> : null}
    </View>}
    <RailBotButton />
  </Screen>;
}

const styles = StyleSheet.create({
  newLog: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.orange },
  newLogText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
  modeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  modeTab: { minWidth: 120, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modeTabActive: { borderBottomColor: colors.orange },
  modeText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 15 },
  modeTextActive: { color: colors.orangeText },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  monthTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  todayButton: { minWidth: 76, height: 42, alignItems: 'center', justifyContent: 'center' },
  todayText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14 },
  calendar: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.paper },
  weekdays: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  weekdayText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: `${100 / 7}%`, minHeight: 68, padding: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  dayOutside: { backgroundColor: '#E8EAE5' },
  dayToday: { borderWidth: 2, borderColor: '#3B82F6' },
  dayText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  dayTextOutside: { color: '#9CA3AF' },
  dayTextToday: { color: '#2563EB', fontFamily: fonts.bodyBold },
  logDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: colors.orange },
  list: { gap: 10 },
  logRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  logDate: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14 },
  logSummary: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 4 },
  empty: { minHeight: 160, textAlign: 'center', textAlignVertical: 'center', color: colors.muted, fontFamily: fonts.body, fontSize: 16 },
});
