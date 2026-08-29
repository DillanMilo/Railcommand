import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileConfig } from '@/lib/config';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const modules = [
  { label: 'Punch List', path: 'punch-list', ios: 'checklist', android: 'fact_check' },
  { label: 'Safety', path: 'safety', ios: 'exclamationmark.shield', android: 'gpp_maybe' },
  { label: 'QC/QA', path: 'qcqa', ios: 'clipboard', android: 'assignment' },
  { label: 'Documents', path: 'documents', ios: 'folder', android: 'folder' },
  { label: 'Cameras', path: 'cameras', ios: 'video', android: 'videocam', badge: 'Beta', native: '/cameras' },
  { label: 'Photos', path: 'photos', ios: 'camera', android: 'photo_camera' },
  { label: 'Reports', path: 'weekly-reports', ios: 'doc.text.below.ecg', android: 'analytics' },
  { label: 'Schedule', path: 'schedule', ios: 'chart.bar.xaxis', android: 'format_list_bulleted' },
  { label: 'Team', path: 'team', ios: 'person.2', android: 'group', native: '/team' },
] as const;

export default function MoreSheet() {
  const { activeProjectId, online } = useMobileData();
  const open = async (item: typeof modules[number]) => {
    if ('native' in item) {
      router.replace(item.native as never);
      return;
    }
    if (!online || !activeProjectId) {
      Alert.alert(`${item.label} is online-only`, 'This module is not cached in the field release. No input will be collected or discarded while offline.');
      return;
    }
    try {
      await Linking.openURL(new URL(`/projects/${activeProjectId}/${item.path}`, mobileConfig.apiBaseUrl).toString());
    } catch {
      Alert.alert(`Could not open ${item.label}`, 'No mobile input was changed. Check connectivity and try again.');
    }
  };

  return <View style={styles.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close More" onPress={() => router.back()} style={styles.backdrop} />
    <SafeAreaView edges={['bottom']} style={styles.sheet}>
      <View style={styles.sheetHeader}><Text accessibilityRole="header" style={styles.title}>More</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}><SymbolView accessible={false} name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={colors.ink} size={19} /></Pressable></View>
      <View style={styles.grid}>{modules.map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label}${'badge' in item ? `, ${item.badge}` : ''}`} onPress={() => void open(item)} style={({ pressed }) => [styles.module, pressed && styles.pressed]}>
        <SymbolView accessible={false} name={{ ios: item.ios, android: item.android, web: item.android }} tintColor={colors.muted} size={29} />
        <Text style={styles.moduleLabel}>{item.label}</Text>
        {'badge' in item ? <Text style={styles.badge}>{item.badge}</Text> : null}
      </Pressable>)}</View>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.52)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { minHeight: 420, backgroundColor: '#F8FAFC', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 18, paddingTop: 14 },
  sheetHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  close: { width: 46, height: 46, borderWidth: 1, borderColor: colors.controlLine, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 14 },
  module: { width: '33.333%', minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 4 },
  moduleLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, textAlign: 'center' },
  badge: { color: colors.orangeText, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13, marginTop: -6 },
  pressed: { opacity: 0.58 },
});
