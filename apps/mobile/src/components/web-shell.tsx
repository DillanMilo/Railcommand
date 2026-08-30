import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { PropsWithChildren, ReactNode } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { mobileConfig } from '@/lib/config';
import { colors, fonts } from '@/theme';
import railCommandMark from '../../assets/images/icon.png';

export function WebHeader({ projectName, online, expanded, onProjectPress }: {
  projectName: string;
  online: boolean;
  expanded?: boolean;
  onProjectPress?: () => void;
}) {
  const { width } = useWindowDimensions();
  const openSearch = async () => {
    if (!online) {
      Alert.alert('Search requires connectivity', 'Cached project records remain available in their mobile sections. Web search is never silently queued.');
      return;
    }
    try {
      await Linking.openURL(new URL('/search', mobileConfig.apiBaseUrl).toString());
    } catch {
      Alert.alert('Could not open search', 'The mobile app remains unchanged. Check connectivity and try again.');
    }
  };
  return <View style={styles.header}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Active project: ${projectName}. ${online ? 'Online' : 'Offline'}.`}
      accessibilityState={{ expanded }}
      onPress={onProjectPress}
      disabled={!onProjectPress}
      style={({ pressed }) => [styles.project, pressed && styles.pressed]}
    >
      <Image source={railCommandMark} style={styles.mark} resizeMode="cover" accessible={false} alt="" />
      <View style={[styles.connectionDot, !online && styles.connectionDotOffline]} />
      <Text numberOfLines={1} style={styles.projectName}>{projectName}</Text>
      {onProjectPress ? <SymbolView accessible={false} name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }} tintColor="#CBD5E1" size={14} /> : null}
    </Pressable>
    <View style={styles.headerIcons}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open RailCommand search" onPress={() => void openSearch()} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
        <SymbolView accessible={false} name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor="#64748B" size={23} />
      </Pressable>
      {width >= 360 ? <Pressable accessibilityRole="button" accessibilityLabel="Open notification settings" onPress={() => router.push('/(tabs)/account')} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
        <SymbolView accessible={false} name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} tintColor="#64748B" size={21} />
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Open account" onPress={() => router.push('/(tabs)/account')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
        <Text style={styles.avatarText}>RC</Text>
      </Pressable>
    </View>
  </View>;
}

export function BreadcrumbRow({ current }: { current: string }) {
  return <View style={styles.breadcrumb}>
    <Text style={styles.breadcrumbText}>›</Text>
    <Text style={styles.breadcrumbText}>Dashboard</Text>
    <Text style={styles.breadcrumbText}>›</Text>
    <Text numberOfLines={1} style={styles.breadcrumbCurrent}>{current}</Text>
  </View>;
}

export function ModuleHeading({ title, count, subtitle, badges, actions }: {
  title: string;
  count?: number;
  subtitle?: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return <View style={styles.heading}>
    <View style={styles.titleRow}>
      <Text accessibilityRole="header" style={styles.headingTitle}>{title}</Text>
      {typeof count === 'number' ? <Text style={styles.headingCount}>{count}</Text> : null}
      {badges}
    </View>
    {subtitle ? <Text style={styles.headingSubtitle}>{subtitle}</Text> : null}
    {actions ? <View style={styles.actions}>{actions}</View> : null}
  </View>;
}

export function WebActionButton({ title, icon, primary, onPress, disabled }: {
  title: string;
  icon?: ReactNode;
  primary?: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.actionButton, primary && styles.actionButtonPrimary, disabled && styles.disabled, pressed && styles.pressed]}
  >
    {icon}
    <Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]}>{title}</Text>
  </Pressable>;
}

export function FilterTabs<T extends string>({ items, selected, onSelect }: {
  items: readonly T[];
  selected: T;
  onSelect(value: T): void;
}) {
  return <View style={styles.filterTabs}>
    {items.map((item) => <Pressable
      key={item}
      accessibilityRole="tab"
      accessibilityState={{ selected: item === selected }}
      onPress={() => onSelect(item)}
      style={[styles.filterTab, item === selected && styles.filterTabSelected]}
    ><Text style={[styles.filterText, item === selected && styles.filterTextSelected]}>{item}</Text></Pressable>)}
  </View>;
}

export function WebSearch({ value, onChangeText, placeholder }: {
  value: string;
  onChangeText(value: string): void;
  placeholder: string;
}) {
  return <View style={styles.search}>
    <SymbolView accessible={false} name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.muted} size={20} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={styles.searchInput}
      autoCorrect={false}
      clearButtonMode="while-editing"
    />
  </View>;
}

export function WebEmpty({ children }: PropsWithChildren) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{children}</Text></View>;
}

export function RailBotButton() {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="RailBot"
    accessibilityHint="Explains RailBot availability"
    onPress={() => Alert.alert('RailBot', 'RailBot voice remains online-only and is not included in this field release yet.')}
    style={({ pressed }) => [styles.railbot, pressed && styles.pressed]}
  >
    <SymbolView accessible={false} name={{ ios: 'robotic.vacuum', android: 'smart_toy', web: 'smart_toy' }} tintColor={colors.white} size={25} />
  </Pressable>;
}

const styles = StyleSheet.create({
  header: { minHeight: 72, marginHorizontal: -12, marginTop: -12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  project: { maxWidth: '48%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, backgroundColor: colors.ink, borderRadius: 9 },
  mark: { width: 24, height: 24, borderRadius: 2 },
  connectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.successBright },
  connectionDotOffline: { backgroundColor: colors.amber },
  projectName: { flex: 1, minWidth: 0, color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  avatarText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 12 },
  pressed: { opacity: 0.72 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  breadcrumbText: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  breadcrumbCurrent: { flexShrink: 1, color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  heading: { gap: 8 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  headingTitle: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 24, lineHeight: 31, letterSpacing: -0.7 },
  headingCount: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  headingSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  actionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  actionButtonPrimary: { borderColor: colors.orange, backgroundColor: colors.orange },
  actionButtonText: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  actionButtonTextPrimary: { color: colors.white },
  disabled: { opacity: 0.42 },
  filterTabs: { minHeight: 48, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  filterTab: { flexGrow: 1, flexShrink: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 10 },
  filterTabSelected: { borderBottomColor: colors.orange },
  filterText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 18, textAlign: 'center' },
  filterTextSelected: { color: colors.orangeText },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.controlLine, backgroundColor: colors.paper, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontFamily: fonts.body, fontSize: 16 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  railbot: { position: 'absolute', right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.orange, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
