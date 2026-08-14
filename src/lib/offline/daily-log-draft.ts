import type { GeoTag } from '@/lib/types';
import { OFFLINE_STORES, openOfflineDatabase } from './storage';

export const DAILY_LOG_DRAFT_KIND = 'daily_log_create' as const;

export type DailyLogDraftPersonnel = {
  role: string;
  headcount: number;
  company: string;
};

export type DailyLogDraftEquipment = {
  type: string;
  count: number;
  notes: string;
};

export type DailyLogDraftWorkItem = {
  description: string;
  quantity: number;
  unit: string;
  location: string;
};

export interface DailyLogDraftValues {
  date: string;
  temp: number | '';
  conditions: string;
  wind: string;
  personnel: DailyLogDraftPersonnel[];
  equipment: DailyLogDraftEquipment[];
  workItems: DailyLogDraftWorkItem[];
  workSummary: string;
  safetyNotes: string;
  geoTag: GeoTag | null;
}

export interface DailyLogDraftRecord {
  draftId: string;
  kind: typeof DAILY_LOG_DRAFT_KIND;
  projectId: string;
  clientId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  values: DailyLogDraftValues;
}

export function getDailyLogDraftId(projectId: string): string {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) throw new Error('A project ID is required for a daily-log draft');
  return `${DAILY_LOG_DRAFT_KIND}:${normalizedProjectId}`;
}

function createClientIdentifier(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function dailyLogDraftHasEnteredData(values: DailyLogDraftValues): boolean {
  return Boolean(
    values.temp !== '' ||
    values.conditions.trim() ||
    values.wind.trim() ||
    values.workSummary.trim() ||
    values.safetyNotes.trim() ||
    values.geoTag ||
    values.personnel.some((row) => row.role.trim() || row.company.trim() || row.headcount > 0) ||
    values.equipment.some((row) => row.type.trim() || row.notes.trim() || row.count > 0) ||
    values.workItems.some(
      (row) => row.description.trim() || row.unit.trim() || row.location.trim() || row.quantity > 0
    )
  );
}

export function createDailyLogDraftRecord(
  projectId: string,
  values: DailyLogDraftValues,
  existing: DailyLogDraftRecord | null = null,
  now = new Date()
): DailyLogDraftRecord {
  const timestamp = now.toISOString();
  const clientId = existing?.clientId ?? createClientIdentifier();
  return {
    draftId: getDailyLogDraftId(projectId),
    kind: DAILY_LOG_DRAFT_KIND,
    projectId,
    clientId,
    idempotencyKey: existing?.idempotencyKey ?? `daily-log-create:${clientId}`,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    values,
  };
}

export async function readDailyLogDraft(
  userId: string,
  projectId: string
): Promise<DailyLogDraftRecord | null> {
  const database = await openOfflineDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.drafts, 'readonly');
    const request = transaction.objectStore(OFFLINE_STORES.drafts).get(getDailyLogDraftId(projectId));
    request.onsuccess = () => resolve((request.result as DailyLogDraftRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read the daily-log draft'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function listDailyLogDrafts(userId: string): Promise<DailyLogDraftRecord[]> {
  const database = await openOfflineDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.drafts, 'readonly');
    const request = transaction.objectStore(OFFLINE_STORES.drafts).getAll();
    request.onsuccess = () => resolve(
      ((request.result as DailyLogDraftRecord[]) ?? [])
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    );
    request.onerror = () => reject(request.error ?? new Error('Could not inspect saved drafts'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function writeDailyLogDraft(
  userId: string,
  projectId: string,
  values: DailyLogDraftValues,
  existing: DailyLogDraftRecord | null = null
): Promise<DailyLogDraftRecord> {
  const database = await openOfflineDatabase(userId);
  const record = createDailyLogDraftRecord(projectId, values, existing);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.drafts, 'readwrite');
    transaction.objectStore(OFFLINE_STORES.drafts).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve(record);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not save the daily-log draft'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Daily-log draft save was interrupted'));
    };
  });
}

export async function deleteDailyLogDraft(userId: string, projectId: string): Promise<void> {
  const database = await openOfflineDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.drafts, 'readwrite');
    transaction.objectStore(OFFLINE_STORES.drafts).delete(getDailyLogDraftId(projectId));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not remove the daily-log draft'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Daily-log draft removal was interrupted'));
    };
  });
}
