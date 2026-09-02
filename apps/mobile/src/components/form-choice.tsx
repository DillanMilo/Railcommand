import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebActionButton, WebSearch } from './web-shell';
import { colors, fonts } from '@/theme';

export function FormChoice({ label, value, options, onChange, disabled, optional }: {
  label: string; value: string; options: readonly { id: string; name: string }[];
  onChange(value: string): void; disabled?: boolean; optional?: boolean;
}) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState('');
  const selected = options.find((item) => item.id === value)?.name;
  const choices = optional ? [{ id: '', name: 'None' }, ...options] : options;
  const visible = choices.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const emptyMessage = choices.length > 0
    ? 'No matching choices. Clear your search to see all options.'
    : 'No choices are available for this field.';
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ${selected ?? (value ? 'Saved selection unavailable' : 'Select')}`}
      accessibilityState={{ disabled: Boolean(disabled), expanded: open }} onPress={() => { setSearch(''); setOpen(true); }} style={styles.trigger}>
      <Text style={styles.text}>{selected ?? (value ? 'Saved selection — refresh choices' : `Select ${label.toLowerCase()}`)}  ⌄</Text>
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.label}>{label}</Text>
          <WebActionButton title="Cancel" onPress={() => setOpen(false)} />
          <WebSearch value={search} onChangeText={setSearch} placeholder={`Search ${label.toLowerCase()}`} />
          <FlatList data={visible} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.text}>{emptyMessage}</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: item.id === value }}
              onPress={() => { onChange(item.id); setOpen(false); }} style={styles.option}>
              <Text style={styles.text}>{item.name}{item.id === value ? ' ✓' : ''}</Text>
            </Pressable>} />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 7 }, label: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 21 },
  text: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 23, flexShrink: 1 },
  trigger: { minHeight: 50, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: colors.controlLine, borderRadius: 6, backgroundColor: colors.white },
  sheet: { flex: 1, padding: 16, gap: 16, backgroundColor: colors.paper },
  option: { minHeight: 52, padding: 14, borderBottomWidth: 1, borderColor: colors.line, justifyContent: 'center' },
});
