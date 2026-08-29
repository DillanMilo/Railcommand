import { forwardRef, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii, spacing } from '@/theme';
import railCommandMark from '../../assets/images/icon.png';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const { width } = useWindowDimensions();
  const content = <View style={[styles.content, width >= 700 && styles.contentWide]}>{children}</View>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
        >
          {content}
        </ScrollView>
      ) : content}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function BrandHeader({ eyebrow, title, right, onPress, expanded }: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  onPress?: () => void;
  expanded?: boolean;
}) {
  const projectControl = <>
    <Image
      source={railCommandMark}
      style={styles.brandMark}
      resizeMode="cover"
      accessible={false}
      alt=""
      accessibilityIgnoresInvertColors
    />
    <View style={styles.headerText}>
      {eyebrow ? <Text maxFontSizeMultiplier={1.5} style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={styles.title}>{title}</Text>
    </View>
    {onPress ? <Text accessible={false} style={styles.projectChevron}>⌄</Text> : null}
  </>;

  return <View style={styles.header}>
    {onPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Active project: ${title}`}
        accessibilityHint="Shows available RailCommand projects"
        onPress={onPress}
        style={({ pressed }) => [styles.projectControl, pressed && styles.projectControlPressed]}
      >{projectControl}</Pressable>
    ) : <View style={styles.projectControl}>{projectControl}</View>}
    <View style={styles.headerActions}>{right}</View>
  </View>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function PageHeading({ eyebrow, title, detail, badge }: {
  eyebrow: string;
  title: string;
  detail?: string;
  badge?: string;
}) {
  return <View style={styles.pageHeading}>
    <View style={styles.breadcrumb}>
      <Text style={styles.breadcrumbRoot}>RailCommand</Text>
      <Text style={styles.breadcrumbDivider}>›</Text>
      <Text numberOfLines={1} style={styles.breadcrumbCurrent}>{title}</Text>
    </View>
    <Text maxFontSizeMultiplier={1.5} style={styles.pageEyebrow}>{eyebrow}</Text>
    <View style={styles.pageTitleRow}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.pageTitle}>{title}</Text>
      {badge ? <Text style={styles.pageBadge}>{badge}</Text> : null}
    </View>
    {detail ? <Text style={styles.pageDetail}>{detail}</Text> : null}
  </View>;
}

export function StatusBanner({ title, detail, tone = 'neutral' }: {
  title: string;
  detail: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return <View
    accessible
    accessibilityRole="text"
    accessibilityLiveRegion="polite"
    style={[
      styles.statusBanner,
      tone === 'success' && styles.statusBannerSuccess,
      tone === 'warning' && styles.statusBannerWarning,
      tone === 'danger' && styles.statusBannerDanger,
    ]}
  >
    <Text style={[
      styles.statusBannerTitle,
      tone === 'success' && styles.statusBannerTitleSuccess,
      tone === 'warning' && styles.statusBannerTitleWarning,
      tone === 'danger' && styles.statusBannerTitleDanger,
    ]}>{title}</Text>
    <Text style={styles.statusBannerDetail}>{detail}</Text>
  </View>;
}

export function MetricTile({ label, value, detail, icon, trend }: {
  label: string;
  value: string | number;
  detail: string;
  icon?: ReactNode;
  trend?: string;
}) {
  return <View style={styles.metricTile}>
    <View style={styles.metricTop}><Text style={styles.metricLabel}>{label}</Text>{icon}</View>
    <View style={styles.metricBody}>
      <Text style={styles.metricValue}>{value}</Text>
      {trend ? <Text style={styles.metricTrend}>{trend}</Text> : null}
    </View>
    <Text style={styles.metricDetail}>{detail}</Text>
  </View>;
}

export function PrimaryButton({ title, onPress, disabled, busy, tone = 'orange' }: {
  title: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'orange' | 'dark' | 'danger';
}) {
  const foreground = tone === 'orange' ? colors.ink : colors.white;
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
    disabled={disabled || busy}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      tone === 'dark' && styles.buttonDark,
      tone === 'danger' && styles.buttonDanger,
      (disabled || busy) && styles.buttonDisabled,
      pressed && styles.buttonPressed,
    ]}
  >
    {busy ? <ActivityIndicator color={foreground} /> : (
      <Text style={[styles.buttonText, tone !== 'orange' && styles.buttonTextLight]}>{title}</Text>
    )}
  </Pressable>;
}

export function SecondaryButton({ title, onPress, disabled }: { title: string; onPress(): void; disabled?: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.secondary, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}
  >
    <Text style={styles.secondaryText}>{title}</Text>
  </Pressable>;
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string }>(function Field(
  { label, multiline, ...props },
  ref,
) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={ref}
      {...props}
      multiline={multiline}
      accessibilityLabel={props.accessibilityLabel ?? label}
      placeholderTextColor={colors.muted}
      style={[styles.input, multiline && styles.multiline]}
    />
  </View>;
});

export function StatusPill({ online, label }: { online?: boolean; label?: string }) {
  const status = label ?? (online ? 'ONLINE' : 'OFFLINE');
  return <View
    accessible
    accessibilityRole="text"
    accessibilityLabel={`Connectivity: ${status.toLowerCase()}`}
    style={[styles.pill, online === false && styles.pillOffline]}
  >
    <View style={[styles.statusDot, online === false && styles.statusDotOffline]} />
    <Text style={styles.pillText}>{status}</Text>
  </View>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.empty}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.mutedCentered}>{detail}</Text>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: spacing.xxl,
    gap: 20,
  },
  contentWide: { paddingHorizontal: 12, paddingTop: 12, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 66,
    marginHorizontal: -12,
    marginTop: -12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  projectControl: {
    minWidth: 0,
    maxWidth: 210,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.ink,
  },
  projectControlPressed: { opacity: 0.82 },
  brandMark: { width: 20, height: 20, borderRadius: 2, backgroundColor: colors.inkSoft },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 7, lineHeight: 9, letterSpacing: 0.8, color: '#CBD5E1' },
  title: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, letterSpacing: -0.1 },
  projectChevron: { color: '#CBD5E1', fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 16, marginTop: -3 },
  headerActions: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.command,
    padding: spacing.md,
    gap: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.045,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 2,
  },
  sectionTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 17, lineHeight: 23, letterSpacing: -0.25 },
  pageHeading: { gap: 7, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  breadcrumb: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  breadcrumbRoot: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  breadcrumbDivider: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 16 },
  breadcrumbCurrent: { flexShrink: 1, color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16 },
  pageEyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  pageTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  pageTitle: { flexShrink: 1, color: colors.ink, fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, letterSpacing: -1.2 },
  pageBadge: { color: colors.success, backgroundColor: '#E8F8F1', paddingHorizontal: 8, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 8, lineHeight: 11, letterSpacing: 1.1 },
  pageDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  statusBanner: { gap: 4, padding: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  statusBannerSuccess: { borderColor: '#9BD8C5', backgroundColor: '#EFFBF7' },
  statusBannerWarning: { borderColor: '#E8B36F', backgroundColor: '#FFF7E8' },
  statusBannerDanger: { borderColor: '#F3A6A6', backgroundColor: '#FFF1F1' },
  statusBannerTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  statusBannerTitleSuccess: { color: colors.success },
  statusBannerTitleWarning: { color: colors.warning },
  statusBannerTitleDanger: { color: colors.danger },
  statusBannerDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  metricTile: { width: '48%', minHeight: 148, justifyContent: 'space-between', padding: 13, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.045, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 1 },
  metricTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  metricBody: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  metricLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, lineHeight: 12, letterSpacing: 1.15 },
  metricValue: { color: colors.ink, fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, letterSpacing: -1.15 },
  metricTrend: { color: colors.success, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14 },
  metricDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  button: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.orangeDark,
    borderRadius: radii.control,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 2,
  },
  buttonDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  buttonDanger: { backgroundColor: colors.danger, borderColor: '#991B1B' },
  buttonDisabled: { opacity: 0.42, shadowOpacity: 0, elevation: 0 },
  buttonPressed: { opacity: 0.78, transform: [{ translateX: 1 }, { translateY: 1 }] },
  buttonText: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  buttonTextLight: { color: colors.white },
  secondary: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radii.control,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  field: { gap: 7 },
  fieldLabel: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.controlLine,
    borderRadius: radii.control,
    backgroundColor: colors.white,
    color: colors.ink,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  },
  multiline: { minHeight: 112, paddingTop: 13, textAlignVertical: 'top' },
  pill: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#74CBB3',
    borderRadius: radii.pill,
    backgroundColor: '#EFFBF7',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillOffline: { borderColor: '#E8B36F', backgroundColor: '#FFF7E8' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusDotOffline: { backgroundColor: colors.warning },
  pillText: { color: colors.ink, fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 1.05 },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, lineHeight: 22, color: colors.ink, fontFamily: fonts.heading },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  mutedCentered: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

export const uiStyles = styles;
