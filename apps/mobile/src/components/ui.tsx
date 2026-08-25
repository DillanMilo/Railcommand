import { forwardRef, type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.content}>{children}</View>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function BrandHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return <View style={styles.header}>
    <View style={styles.brandMark}><Text style={styles.brandMarkText}>RC</Text></View>
    <View style={styles.headerText}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text></View>
    {right}
  </View>;
}

export function Card({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View>; }

export function SectionTitle({ children }: PropsWithChildren) { return <Text style={styles.sectionTitle}>{children}</Text>; }

export function PrimaryButton({ title, onPress, disabled, busy, tone = 'orange' }: {
  title: string; onPress(): void; disabled?: boolean; busy?: boolean; tone?: 'orange' | 'dark' | 'danger';
}) {
  return <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, tone === 'dark' && styles.buttonDark, tone === 'danger' && styles.buttonDanger,
      (disabled || busy) && styles.buttonDisabled, pressed && styles.buttonPressed]}>
    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
  </Pressable>;
}

export function SecondaryButton({ title, onPress, disabled }: { title: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.secondary, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}>
    <Text style={styles.secondaryText}>{title}</Text>
  </Pressable>;
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string }>(function Field(
  { label, multiline, ...props },
  ref,
) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput ref={ref} {...props} multiline={multiline}
    placeholderTextColor="#8b8f97" style={[styles.input, multiline && styles.multiline]} /></View>;
});

export function StatusPill({ online, label }: { online?: boolean; label?: string }) {
  return <View style={[styles.pill, online === false && styles.pillOffline]}><Text style={styles.pillText}>{label ?? (online ? 'ONLINE' : 'OFFLINE')}</Text></View>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, keyboard: { flex: 1 }, scroll: { flexGrow: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', flex: 1, padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 }, brandMark: { width: 42, height: 42, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontWeight: '900', fontSize: 13 }, headerText: { flex: 1 }, eyebrow: { fontSize: 10, letterSpacing: 1.4, color: colors.orange, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' }, card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, button: { minHeight: 52, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonDark: { backgroundColor: colors.ink }, buttonDanger: { backgroundColor: colors.danger }, buttonDisabled: { opacity: 0.42 }, buttonPressed: { opacity: 0.78 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 48, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, secondaryText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  field: { gap: 7 }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', color: colors.ink, paddingHorizontal: 14, fontSize: 16 },
  multiline: { minHeight: 112, paddingTop: 13, textAlignVertical: 'top' }, pill: { borderWidth: 1, borderColor: '#74cbb3', backgroundColor: '#effbf7', paddingHorizontal: 10, paddingVertical: 7 },
  pillOffline: { borderColor: '#e8b36f', backgroundColor: '#fff7e8' }, pillText: { color: colors.ink, fontSize: 10, letterSpacing: 1.2, fontWeight: '900' },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 6 }, emptyTitle: { fontSize: 16, color: colors.ink, fontWeight: '800' }, muted: { color: colors.muted, lineHeight: 20, textAlign: 'center' },
});

export const uiStyles = styles;
