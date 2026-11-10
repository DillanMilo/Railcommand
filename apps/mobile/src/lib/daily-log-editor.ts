import { copyDailyLogFields, emptyDailyLogFields, newEquipmentEntry, newPersonnelEntry, newWorkEntry, type MobileDailyLogDraft } from '@railcommand/domain';

export type DailyLogNotice = {
  kind: 'working' | 'saving' | 'saved' | 'save-error' | 'attention' | 'queued';
  detail: string;
};

export function dailyLogStatusBanner(notice: DailyLogNotice, dirty: boolean, online: boolean): {
  title: string; tone: 'neutral' | 'success' | 'warning' | 'danger'; detail: string;
} {
  const detail = notice.detail;
  if (notice.kind === 'save-error') return { title: 'Draft not saved', tone: 'danger', detail };
  if (notice.kind === 'saving') return { title: 'Saving draft on this device', tone: 'neutral', detail };
  // A later device action must never make unsaved edits look durable.
  if (dirty) return { title: 'Draft has unsaved changes', tone: 'warning', detail };
  if (notice.kind === 'attention') return { title: 'Action needs attention', tone: 'warning', detail };
  if (notice.kind === 'queued') return { title: 'Daily log queued', tone: online ? 'neutral' : 'warning', detail };
  if (notice.kind === 'working') return { title: 'Working on this device', tone: 'neutral', detail };
  return { title: online ? 'Draft saved on this device' : 'Offline draft saved on this device', tone: 'success', detail };
}

export function prepareDailyLogEditor(draft: MobileDailyLogDraft, createId: () => string): MobileDailyLogDraft {
  const fields = draft.fieldEntries ? copyDailyLogFields(draft.fieldEntries) : emptyDailyLogFields();
  return { ...draft, fieldEntries: { ...fields,
    personnel: fields.personnel.length ? fields.personnel : [newPersonnelEntry(createId())],
    equipment: fields.equipment.length ? fields.equipment : [newEquipmentEntry(createId())],
    workItems: fields.workItems.length ? fields.workItems : [newWorkEntry(createId())] } };
}

export function createDailyLogWriter(save: (draft: MobileDailyLogDraft) => Promise<void>) {
  let pending = Promise.resolve();
  return (draft: MobileDailyLogDraft) => {
    const snapshot = { ...draft, geoTag: draft.geoTag ? { ...draft.geoTag } : null,
      ...(draft.fieldEntries ? { fieldEntries: copyDailyLogFields(draft.fieldEntries) } : {}) };
    pending = pending.catch(() => undefined).then(() => save(snapshot));
    return pending;
  };
}

export function localDailyLogDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validateDailyLogDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
