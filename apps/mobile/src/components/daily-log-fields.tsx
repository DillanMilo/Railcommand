import { DAILY_LOG_CONDITIONS, DAILY_LOG_ROLES, DAILY_LOG_ROW_LIMIT, DAILY_LOG_UNITS, newEquipmentEntry, newPersonnelEntry, newWorkEntry, type MobileDailyLogFields } from '@railcommand/domain';
import * as Crypto from 'expo-crypto';
import type { ReactNode } from 'react';
import { Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Field, uiStyles } from './ui';
import { FormChoice } from './form-choice';
import { WebActionButton } from './web-shell';
import { colors, fonts } from '@/theme';

const roles = DAILY_LOG_ROLES.map((id) => ({ id, name: id }));
const units = DAILY_LOG_UNITS.map((id) => ({ id, name: id }));
const weather = DAILY_LOG_CONDITIONS.map((id) => ({ id, name: id }));
export function DailyLogSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.card}><View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.title}>{title}</Text></View><View style={styles.content}>{children}</View></View>;
}
function RowFields({ children }: { children: ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[styles.rowFields, width >= 700 && fontScale < 1.4 && styles.wide]}>{children}</View>;
}
function Cell({ children }: { children: ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[styles.cell, width >= 700 && fontScale < 1.4 && styles.wideCell]}>{children}</View>;
}
function RemoveRow({ title, disabled, onRemove }: { title: string; disabled: boolean; onRemove(): void }) {
  return <WebActionButton title={`Remove ${title}`} disabled={disabled} onPress={() => Alert.alert(`Remove ${title}?`, 'This removes only this row from the device draft.', [
    { text: 'Keep row', style: 'cancel' }, { text: 'Remove row', style: 'destructive', onPress: onRemove },
  ])} />;
}

export function DailyLogFieldSections({ fields, conditions, disabled, onChange, onConditions }: {
  fields: MobileDailyLogFields; conditions: string; disabled: boolean;
  onChange(fields: MobileDailyLogFields): void; onConditions(value: string): void;
}) {
  // Keep older free-text condition values visible until the user chooses another.
  const conditionsChoices = conditions && !weather.some((item) => item.id === conditions) ? [{ id: conditions, name: conditions }, ...weather] : weather;
  return <>
    <DailyLogSection title="Weather"><RowFields>
      <Cell><Field label="Temperature (°F)" value={fields.weatherTemp} onChangeText={(weatherTemp) => onChange({ ...fields, weatherTemp })} editable={!disabled} keyboardType="numbers-and-punctuation" placeholder="e.g. 42" maxLength={24} /></Cell>
      <Cell><FormChoice label="Conditions" value={conditions} options={conditionsChoices} disabled={disabled} optional onChange={onConditions} /></Cell>
      <Cell><Field label="Wind" value={fields.weatherWind} onChangeText={(weatherWind) => onChange({ ...fields, weatherWind })} editable={!disabled} placeholder="e.g. NW 8 mph" maxLength={200} /></Cell>
    </RowFields></DailyLogSection>
    <DailyLogSection title="Personnel">
      {fields.personnel.map((row, index) => <View key={row.rowId} style={styles.row}>
        <Text style={styles.rowLabel}>Personnel {index + 1}</Text><RowFields>
          <Cell><FormChoice label="Role" value={row.role} options={roles} disabled={disabled} onChange={(role) => onChange({ ...fields, personnel: fields.personnel.map((item) => item.rowId === row.rowId ? { ...item, role } : item) })} /></Cell>
          <Cell><Field label="Count" value={row.headcount} keyboardType="number-pad" editable={!disabled} maxLength={10} onChangeText={(headcount) => onChange({ ...fields, personnel: fields.personnel.map((item) => item.rowId === row.rowId ? { ...item, headcount } : item) })} /></Cell>
          <Cell><Field label="Company" value={row.company} placeholder="Company" editable={!disabled} maxLength={300} onChangeText={(company) => onChange({ ...fields, personnel: fields.personnel.map((item) => item.rowId === row.rowId ? { ...item, company } : item) })} /></Cell>
        </RowFields>
        <RemoveRow title={`personnel row ${index + 1}`} disabled={disabled || fields.personnel.length === 1} onRemove={() => onChange({ ...fields, personnel: fields.personnel.filter((item) => item.rowId !== row.rowId) })} />
      </View>)}
      <WebActionButton title="Add Personnel" disabled={disabled || fields.personnel.length >= DAILY_LOG_ROW_LIMIT} onPress={() => onChange({ ...fields, personnel: [...fields.personnel, newPersonnelEntry(Crypto.randomUUID())] })} />
    </DailyLogSection>
    <DailyLogSection title="Equipment">
      {fields.equipment.map((row, index) => <View key={row.rowId} style={styles.row}>
        <Text style={styles.rowLabel}>Equipment {index + 1}</Text><RowFields>
          <Cell><Field label="Equipment Type" value={row.type} placeholder="e.g. Excavator" editable={!disabled} maxLength={300} onChangeText={(type) => onChange({ ...fields, equipment: fields.equipment.map((item) => item.rowId === row.rowId ? { ...item, type } : item) })} /></Cell>
          <Cell><Field label="Count" value={row.count} keyboardType="number-pad" editable={!disabled} maxLength={10} onChangeText={(count) => onChange({ ...fields, equipment: fields.equipment.map((item) => item.rowId === row.rowId ? { ...item, count } : item) })} /></Cell>
          <Cell><Field label="Notes" value={row.notes} placeholder="Notes" editable={!disabled} maxLength={2000} onChangeText={(notes) => onChange({ ...fields, equipment: fields.equipment.map((item) => item.rowId === row.rowId ? { ...item, notes } : item) })} /></Cell>
        </RowFields>
        <RemoveRow title={`equipment row ${index + 1}`} disabled={disabled || fields.equipment.length === 1} onRemove={() => onChange({ ...fields, equipment: fields.equipment.filter((item) => item.rowId !== row.rowId) })} />
      </View>)}
      <WebActionButton title="Add Equipment" disabled={disabled || fields.equipment.length >= DAILY_LOG_ROW_LIMIT} onPress={() => onChange({ ...fields, equipment: [...fields.equipment, newEquipmentEntry(Crypto.randomUUID())] })} />
    </DailyLogSection>
    <DailyLogSection title="Work Items">
      {fields.workItems.map((row, index) => <View key={row.rowId} style={styles.row}>
        <Text style={styles.rowLabel}>Work item {index + 1}</Text><RowFields>
          <Cell><Field label="Description" value={row.description} placeholder="Work description" editable={!disabled} maxLength={2000} onChangeText={(description) => onChange({ ...fields, workItems: fields.workItems.map((item) => item.rowId === row.rowId ? { ...item, description } : item) })} /></Cell>
          <Cell><Field label="Qty" value={row.quantity} keyboardType="decimal-pad" editable={!disabled} maxLength={24} onChangeText={(quantity) => onChange({ ...fields, workItems: fields.workItems.map((item) => item.rowId === row.rowId ? { ...item, quantity } : item) })} /></Cell>
          <Cell><FormChoice label="Unit" value={row.unit} options={units} disabled={disabled} onChange={(unit) => onChange({ ...fields, workItems: fields.workItems.map((item) => item.rowId === row.rowId ? { ...item, unit } : item) })} /></Cell>
          <Cell><Field label="Location" value={row.location} placeholder="Location" editable={!disabled} maxLength={500} onChangeText={(location) => onChange({ ...fields, workItems: fields.workItems.map((item) => item.rowId === row.rowId ? { ...item, location } : item) })} /></Cell>
        </RowFields>
        <RemoveRow title={`work item ${index + 1}`} disabled={disabled || fields.workItems.length === 1} onRemove={() => onChange({ ...fields, workItems: fields.workItems.filter((item) => item.rowId !== row.rowId) })} />
      </View>)}
      <WebActionButton title="Add Work Item" disabled={disabled || fields.workItems.length >= DAILY_LOG_ROW_LIMIT} onPress={() => onChange({ ...fields, workItems: [...fields.workItems, newWorkEntry(Crypto.randomUUID())] })} />
    </DailyLogSection>
  </>;
}

const styles = StyleSheet.create({
  card: { ...uiStyles.card, padding: 0, gap: 0 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 24, color: colors.ink },
  content: { padding: 16, gap: 16 }, row: { gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line },
  rowLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18 },
  rowFields: { gap: 12 }, wide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }, cell: { minWidth: 140, gap: 8 }, wideCell: { flexGrow: 1, flexBasis: 140 },
});
