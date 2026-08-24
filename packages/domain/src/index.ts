export type ProjectRole =
  | 'engineer'
  | 'contractor'
  | 'owner'
  | 'inspector'
  | 'manager'
  | 'superintendent'
  | 'foreman';

export interface MobileProject {
  id: string;
  name: string;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  location: string;
  client: string;
  role: ProjectRole | 'admin';
  canEdit: boolean;
  updatedAt: string;
}

export interface MobileDailyLog {
  id: string;
  projectId: string;
  logDate: string;
  weatherConditions: string;
  workSummary: string;
  safetyNotes: string;
  createdAt: string;
}

export interface MobileBootstrap {
  userId: string;
  projects: MobileProject[];
  activeProjectId: string | null;
  dailyLogs: MobileDailyLog[];
  synchronizedAt: string;
}

export interface MobileGeoTag {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  timestamp: string;
}

export interface MobileDailyLogDraft {
  draftId: string;
  projectId: string;
  clientId: string;
  idempotencyKey: string;
  logDate: string;
  weatherConditions: string;
  workSummary: string;
  safetyNotes: string;
  geoTag: MobileGeoTag | null;
  createdAt: string;
  updatedAt: string;
}

export interface MobilePhotoRecord {
  photoId: string;
  draftId: string;
  projectId: string;
  parentClientId: string;
  fileName: string;
  fileType: string;
  size: number;
  capturedAt: string;
  geoTag: MobileGeoTag | null;
  blob: Blob;
}

export interface MobileDailyLogPhotoSyncOperation {
  operationId: string;
  userId: string;
  projectId: string;
  parentEntityId: string;
  idempotencyKey: string;
  payload: {
    fileName: string;
    fileType: string;
    fileSize: number;
    photoCategory: 'standard' | 'thermal';
    geoLat: number | null;
    geoLng: number | null;
    capturedAt: string;
  };
}

export interface MobileDailyLogPhotoPrepareResult {
  bucket: string;
  path: string;
  token: string;
}

export interface MobileDailyLogPhotoFinalizeResult {
  id: string;
  duplicate: boolean;
}

export interface MobileDailyLogSyncOperation {
  operationId: string;
  userId: string;
  projectId: string;
  clientId: string;
  idempotencyKey: string;
  payload: {
    log_date: string;
    weather_temp: number;
    weather_conditions: string;
    weather_wind: string;
    work_summary: string;
    safety_notes: string;
    geo_tag: MobileGeoTag | null;
    personnel: unknown[];
    equipment: unknown[];
    work_items: unknown[];
  };
  status: 'pending' | 'retry' | 'failed';
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string;
  lastError: string | null;
}

export interface MobileDailyLogSyncResult {
  id: string;
  projectId: string;
  duplicate: boolean;
}

export type MobileDeepLink =
  | { kind: 'auth_callback'; code: string | null; accessToken: string | null; refreshToken: string | null }
  | { kind: 'project'; projectId: string }
  | { kind: 'daily_log'; projectId: string; dailyLogId: string }
  | { kind: 'unsupported' };

function segment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return null;
  }
}

export function parseMobileDeepLink(rawUrl: string): MobileDeepLink {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'unsupported' };
  }

  const isCustom = url.protocol === 'railcommand:';
  const isVerifiedWeb = url.protocol === 'https:' && url.hostname === 'railcommand.io';
  if (!isCustom && !isVerifiedWeb) return { kind: 'unsupported' };

  const path = [isCustom ? url.hostname : '', ...url.pathname.split('/')]
    .map((part) => segment(part))
    .filter((part): part is string => Boolean(part));

  if (path[0] === 'auth' && path[1] === 'callback') {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    return {
      kind: 'auth_callback',
      code: url.searchParams.get('code'),
      accessToken: hash.get('access_token'),
      refreshToken: hash.get('refresh_token'),
    };
  }
  if (path[0] !== 'projects' || !path[1]) return { kind: 'unsupported' };
  if (path[2] === 'daily-logs' && path[3]) {
    return { kind: 'daily_log', projectId: path[1], dailyLogId: path[3] };
  }
  return { kind: 'project', projectId: path[1] };
}

export function createMobileDraft(
  projectId: string,
  values: Pick<MobileDailyLogDraft, 'logDate' | 'weatherConditions' | 'workSummary' | 'safetyNotes'>
    & Partial<Pick<MobileDailyLogDraft, 'geoTag'>>,
  existing: MobileDailyLogDraft | null = null,
  now = new Date(),
  createId: () => string = () => crypto.randomUUID(),
): MobileDailyLogDraft {
  const timestamp = now.toISOString();
  const clientId = existing?.clientId ?? createId();
  return {
    draftId: `daily-log:${projectId}`,
    projectId,
    clientId,
    idempotencyKey: existing?.idempotencyKey ?? `daily-log-create:${clientId}`,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    logDate: values.logDate,
    weatherConditions: values.weatherConditions,
    workSummary: values.workSummary,
    safetyNotes: values.safetyNotes,
    geoTag: Object.hasOwn(values, 'geoTag') ? values.geoTag ?? null : existing?.geoTag ?? null,
  };
}

export function draftToSyncOperation(
  userId: string,
  draft: MobileDailyLogDraft,
): MobileDailyLogSyncOperation {
  return {
    operationId: draft.clientId,
    userId,
    projectId: draft.projectId,
    clientId: draft.clientId,
    idempotencyKey: draft.idempotencyKey,
    payload: {
      log_date: draft.logDate,
      weather_temp: 0,
      weather_conditions: draft.weatherConditions,
      weather_wind: '',
      work_summary: draft.workSummary,
      safety_notes: draft.safetyNotes,
      geo_tag: draft.geoTag,
      personnel: [],
      equipment: [],
      work_items: [],
    },
    status: 'pending',
    attemptCount: 0,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    nextAttemptAt: draft.updatedAt,
    lastError: null,
  };
}

export function isValidSyncOperation(value: unknown): value is MobileDailyLogSyncOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as Partial<MobileDailyLogSyncOperation>;
  return operation.operationId === operation.clientId
    && typeof operation.userId === 'string'
    && Boolean(operation.userId)
    && typeof operation.projectId === 'string'
    && Boolean(operation.projectId)
    && typeof operation.idempotencyKey === 'string'
    && operation.idempotencyKey.length >= 16
    && typeof operation.payload?.log_date === 'string'
    && typeof operation.payload?.work_summary === 'string';
}

export function photoToSyncOperation(
  userId: string,
  photo: MobilePhotoRecord,
  parentEntityId: string,
): MobileDailyLogPhotoSyncOperation {
  return {
    operationId: photo.photoId,
    userId,
    projectId: photo.projectId,
    parentEntityId,
    idempotencyKey: `daily-log-photo:${photo.photoId}`,
    payload: {
      fileName: photo.fileName,
      fileType: photo.fileType,
      fileSize: photo.size,
      photoCategory: 'standard',
      geoLat: photo.geoTag?.lat ?? null,
      geoLng: photo.geoTag?.lng ?? null,
      capturedAt: photo.capturedAt,
    },
  };
}

export function isValidPhotoSyncOperation(
  value: unknown,
): value is MobileDailyLogPhotoSyncOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as Partial<MobileDailyLogPhotoSyncOperation>;
  const payload = operation.payload;
  return typeof operation.operationId === 'string'
    && Boolean(operation.operationId)
    && typeof operation.userId === 'string'
    && Boolean(operation.userId)
    && typeof operation.projectId === 'string'
    && Boolean(operation.projectId)
    && typeof operation.parentEntityId === 'string'
    && Boolean(operation.parentEntityId)
    && typeof operation.idempotencyKey === 'string'
    && operation.idempotencyKey.length >= 16
    && typeof payload?.fileName === 'string'
    && payload.fileName.length > 0
    && payload.fileName.length <= 500
    && typeof payload.fileType === 'string'
    && payload.fileType.startsWith('image/')
    && typeof payload.fileSize === 'number'
    && payload.fileSize > 0
    && payload.fileSize <= 25 * 1024 * 1024
    && (payload.photoCategory === 'standard' || payload.photoCategory === 'thermal')
    && typeof payload.capturedAt === 'string'
    && Number.isFinite(Date.parse(payload.capturedAt));
}
