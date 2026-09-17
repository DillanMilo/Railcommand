import type { MobileGeoTag } from './index';

// Raw numeric text is deliberately retained in drafts (including incomplete
// input such as '-' or '1.'). Only explicit queueing converts it to numbers.
export interface MobilePersonnelEntry { rowId: string; role: string; headcount: string; company: string }
export interface MobileEquipmentEntry { rowId: string; type: string; count: string; notes: string }
export interface MobileWorkEntry { rowId: string; description: string; quantity: string; unit: string; location: string }
export interface MobileDailyLogFields {
  weatherTemp: string;
  weatherWind: string;
  personnel: MobilePersonnelEntry[];
  equipment: MobileEquipmentEntry[];
  workItems: MobileWorkEntry[];
}

export interface MobileDailyLogPersonnel { id: string; role: string; headcount: number; company: string }
export interface MobileDailyLogEquipment { id: string; equipmentType: string; count: number; notes: string }
export interface MobileDailyLogWorkItem { id: string; description: string; quantity: number; unit: string; location: string }
export interface MobileDailyLogReadFields {
  // Missing fields belong to an older/unavailable cached projection; null and
  // empty arrays mean the server returned a field with no recorded value.
  weatherTemp?: number | null;
  weatherWind?: string;
  geoTag?: MobileGeoTag | null;
  personnel?: MobileDailyLogPersonnel[];
  equipment?: MobileDailyLogEquipment[];
  workItems?: MobileDailyLogWorkItem[];
}

/** Allowlist optional readback fields at the API and device-cache boundaries. */
export function normalizeDailyLogReadFields(value: unknown): MobileDailyLogReadFields {
  const object = (entry: unknown): Record<string, unknown> | null => entry !== null && typeof entry === 'object' && !Array.isArray(entry)
    ? entry as Record<string, unknown> : null;
  const number = (entry: unknown): number | undefined => {
    const parsed = typeof entry === 'number' ? entry
      : typeof entry === 'string' && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(entry.trim()) ? Number(entry) : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const nonnegative = (entry: unknown, integer = false): number | undefined => {
    const parsed = number(entry);
    return parsed !== undefined && parsed >= 0 && (!integer || Number.isInteger(parsed)) ? parsed : undefined;
  };
  function rows<T>(entries: unknown, normalize: (entry: Record<string, unknown>) => T | undefined): T[] | undefined {
    if (!Array.isArray(entries)) return undefined;
    const result: T[] = [];
    const ids = new Set<string>();
    for (const entry of entries) {
      const record = object(entry);
      if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id)) return undefined;
      const row = normalize(record);
      if (!row) return undefined;
      ids.add(record.id);
      result.push(row);
    }
    return result;
  }
  const input = object(value);
  if (!input) return {};
  const result: MobileDailyLogReadFields = {};
  const temperature = input.weatherTemp === null ? null : number(input.weatherTemp);
  if (temperature !== undefined) result.weatherTemp = temperature;
  if (typeof input.weatherWind === 'string') result.weatherWind = input.weatherWind;
  if (input.geoTag === null) result.geoTag = null;
  else {
    const geo = object(input.geoTag);
    const lat = number(geo?.lat);
    const lng = number(geo?.lng);
    if (geo && lat !== undefined && Math.abs(lat) <= 90 && lng !== undefined && Math.abs(lng) <= 180
      && typeof geo.timestamp === 'string' && Number.isFinite(Date.parse(geo.timestamp))) {
      const accuracy = nonnegative(geo.accuracy);
      const altitude = number(geo.altitude);
      result.geoTag = { lat, lng, timestamp: geo.timestamp,
        ...(accuracy !== undefined ? { accuracy } : {}), ...(altitude !== undefined ? { altitude } : {}) };
    }
  }
  const personnel = rows(input.personnel, (row): MobileDailyLogPersonnel | undefined => {
    const headcount = nonnegative(row.headcount, true);
    return typeof row.role === 'string' && typeof row.company === 'string' && headcount !== undefined
      ? { id: row.id as string, role: row.role, headcount, company: row.company } : undefined;
  });
  const equipment = rows(input.equipment, (row): MobileDailyLogEquipment | undefined => {
    const count = nonnegative(row.count, true);
    return typeof row.equipmentType === 'string' && typeof row.notes === 'string' && count !== undefined
      ? { id: row.id as string, equipmentType: row.equipmentType, count, notes: row.notes } : undefined;
  });
  const workItems = rows(input.workItems, (row): MobileDailyLogWorkItem | undefined => {
    const quantity = nonnegative(row.quantity);
    return typeof row.description === 'string' && typeof row.unit === 'string' && typeof row.location === 'string' && quantity !== undefined
      ? { id: row.id as string, description: row.description, quantity, unit: row.unit, location: row.location } : undefined;
  });
  if (personnel !== undefined) result.personnel = personnel;
  if (equipment !== undefined) result.equipment = equipment;
  if (workItems !== undefined) result.workItems = workItems;
  return result;
}
export const DAILY_LOG_CONDITIONS = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Snow', 'Snow', 'Rain', 'Foggy'] as const;
export const DAILY_LOG_ROLES = ['Foreman', 'Track Laborer', 'Operator', 'Signal Tech', 'Inspector', 'Grading Foreman', 'Laborer'] as const;
export const DAILY_LOG_UNITS = ['LF', 'CY', 'each', 'SF', 'tons', 'hours'] as const;
export const DAILY_LOG_ROW_LIMIT = 100;

export function newPersonnelEntry(id: string): MobilePersonnelEntry { return { rowId: id, role: '', headcount: '', company: '' }; }
export function newEquipmentEntry(id: string): MobileEquipmentEntry { return { rowId: id, type: '', count: '', notes: '' }; }
export function newWorkEntry(id: string): MobileWorkEntry { return { rowId: id, description: '', quantity: '', unit: '', location: '' }; }
export function emptyDailyLogFields(): MobileDailyLogFields { return { weatherTemp: '', weatherWind: '', personnel: [], equipment: [], workItems: [] }; }

export function copyDailyLogFields(value: MobileDailyLogFields): MobileDailyLogFields {
  if (!value || typeof value.weatherTemp !== 'string' || typeof value.weatherWind !== 'string') throw new Error('Saved weather fields could not be read. The draft has not been deleted.');
  function rows<T>(values: T[], fields: readonly string[]): T[] {
    if (!Array.isArray(values)) throw new Error('Saved daily-log rows could not be read. The draft has not been deleted.');
    const ids = new Set<string>();
    return values.map((row) => {
      const record = row as Record<string, unknown>;
      if (!record || fields.some((field) => typeof record[field] !== 'string') || !record.rowId || ids.has(record.rowId as string)) throw new Error('Saved daily-log row identity or fields are unreadable. The draft has not been deleted.');
      ids.add(record.rowId as string);
      return Object.fromEntries(fields.map((field) => [field, record[field]])) as T;
    });
  }
  return { weatherTemp: value.weatherTemp, weatherWind: value.weatherWind,
    personnel: rows(value.personnel, ['rowId', 'role', 'headcount', 'company']),
    equipment: rows(value.equipment, ['rowId', 'type', 'count', 'notes']),
    workItems: rows(value.workItems, ['rowId', 'description', 'quantity', 'unit', 'location']) };
}

function numeric(text: string, label: string, integer = false, signed = false): number {
  const input = text.trim();
  if (!input) return 0;
  const pattern = integer ? /^\d+$/ : signed ? /^-?(?:\d+(?:\.\d*)?|\.\d+)$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  const number = Number(input);
  if (!pattern.test(input) || !Number.isFinite(number) || Math.abs(number) > (integer ? 2147483647 : Number.MAX_SAFE_INTEGER)) throw new Error(`${label}: enter a valid ${integer ? 'whole nonnegative count' : signed ? 'number' : 'nonnegative quantity'}. Your input remains in the draft.`);
  return number;
}

function databaseDecimal(text: string, label: string, scale: number, magnitudeLimit: number, signed = false): number {
  const value = numeric(text, label, false, signed);
  const fractionalDigits = text.trim().split('.')[1] ?? '';
  if (Math.abs(value) >= magnitudeLimit || /[1-9]/.test(fractionalDigits.slice(scale))) {
    throw new Error(`${label}: use at most ${scale} decimal place${scale === 1 ? '' : 's'} and a value less than ${magnitudeLimit} in magnitude. Your input remains in the draft.`);
  }
  return value;
}

function boundedText(value: string, limit: number, label: string): string {
  if (value.length > limit) throw new Error(`${label} exceeds ${limit} characters. Shorten it before queueing; the draft was not truncated.`);
  return value;
}

export function dailyLogFieldPayload(value?: MobileDailyLogFields) {
  const fields = value ? copyDailyLogFields(value) : emptyDailyLogFields();
  for (const rows of [fields.personnel, fields.equipment, fields.workItems]) if (rows.length > DAILY_LOG_ROW_LIMIT) throw new Error('A daily log supports up to 100 rows per section. The draft was kept.');
  return {
    weather_temp: databaseDecimal(fields.weatherTemp, 'Temperature', 1, 10_000, true),
    weather_wind: boundedText(fields.weatherWind, 200, 'Wind'),
    personnel: fields.personnel.filter((row) => row.role.trim() || row.company.trim() || row.headcount.trim()).map((row, index) => {
      if (!row.role.trim()) throw new Error(`Personnel row ${index + 1}: select a role before queueing. Company and count remain saved.`);
      return { role: boundedText(row.role, 200, 'Role'), headcount: numeric(row.headcount, `Personnel row ${index + 1}`, true), company: boundedText(row.company, 300, 'Company') };
    }),
    equipment: fields.equipment.filter((row) => row.type.trim() || row.notes.trim() || row.count.trim()).map((row, index) => {
      if (!row.type.trim()) throw new Error(`Equipment row ${index + 1}: enter a type before queueing. Notes and count remain saved.`);
      return { equipment_type: boundedText(row.type, 300, 'Equipment type'), count: numeric(row.count, `Equipment row ${index + 1}`, true), notes: boundedText(row.notes, 2000, 'Equipment notes') };
    }),
    work_items: fields.workItems.filter((row) => row.description.trim() || row.quantity.trim() || row.unit.trim() || row.location.trim()).map((row, index) => {
      if (!row.description.trim()) throw new Error(`Work item ${index + 1}: enter a description before queueing. All entered values remain saved.`);
      return { description: boundedText(row.description, 2000, 'Work description'), quantity: databaseDecimal(row.quantity, `Work item ${index + 1}`, 2, 10_000_000_000), unit: boundedText(row.unit, 100, 'Unit'), location: boundedText(row.location, 500, 'Work location') };
    }),
  };
}
