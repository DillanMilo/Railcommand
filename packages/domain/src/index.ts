import { copyDailyLogFields, dailyLogFieldPayload, type MobileDailyLogFields, type MobileDailyLogReadFields } from './daily-log-fields';
export * from './daily-log-fields';

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
  startDate?: string;
  targetEndDate?: string;
  budgetTotal?: number;
  budgetSpent?: number;
  canViewEarthCam?: boolean;
  canManageEarthCam?: boolean;
  canCreateRfi?: boolean;
  canCreateSubmittal?: boolean;
}

export interface MobileSubmittal {
  id: string;
  projectId: string;
  number: string;
  title: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'conditional' | 'rejected';
  dueDate: string;
  createdAt: string;
}

export interface MobileRfi {
  id: string;
  projectId: string;
  number: string;
  subject: string;
  status: 'open' | 'answered' | 'closed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate: string;
  createdAt: string;
}

export type MobilePdfReportKind = 'rfis' | 'submittals';

export interface MobilePdfReportRequest {
  projectId: string;
  kind: MobilePdfReportKind;
  recordIds: string[];
}

export interface MobilePdfReport {
  fileName: string;
  mimeType: 'application/pdf';
  base64: string;
  byteLength: number;
  recordCount: number;
}

export type MobileRecordKind = 'rfis' | 'submittals';
export interface MobileRecordScope { kind: MobileRecordKind; projectId: string; recordId: string }
export interface MobileRecordAttachment { id: string; fileName: string; fileType: string; size: number; category: string }
export interface MobileRecordPerson { id: string; name: string }
export interface MobileRecordResponse { id: string; author: MobileRecordPerson | null; content: string; official: boolean; createdAt: string }
export type MobileRecordDetail = {
  fetchedAt: string;
  attachments: MobileRecordAttachment[];
  milestone: { id: string; name: string } | null;
} & (
  { kind: 'rfis'; record: MobileRfi & {
    question: string; answer: string | null; submitDate: string; responseDate: string | null;
    submittedBy: MobileRecordPerson | null; assignedTo: MobileRecordPerson | null; responses: MobileRecordResponse[];
  } }
  | { kind: 'submittals'; record: MobileSubmittal & {
    description: string; specSection: string; submitDate: string; reviewDate: string | null; reviewNotes: string | null;
    submittedBy: MobileRecordPerson | null; reviewedBy: MobileRecordPerson | null;
  } }
);
export interface MobileRecordAttachmentLink { url: string; expiresAt: string; attachmentId: string }

export interface MobileRecordDraft {
  version: 1;
  kind: MobileRecordKind;
  projectId: string;
  clientId: string;
  title: string;
  body: string;
  priority: MobileRfi['priority'];
  assignedTo: string;
  dueDate: string;
  milestoneId: string;
  specSection: string;
  updatedAt: string;
  // Set locally after confirmed creation; prevents replay if local cleanup fails.
  createdId?: string;
}
export interface MobileRecordCreateResult { id: string; number: string; projectId: string; kind: MobileRecordKind; duplicate: boolean }
export interface MobileRecordFormOptions {
  kind: MobileRecordKind;
  projectId: string;
  fetchedAt: string;
  assignees: MobileRecordPerson[];
  milestones: MobileRecordPerson[];
}

export const MOBILE_SPEC_SECTIONS = [
  '34 11 13 - Track Construction', '34 11 16 - Turnouts and Crossings',
  '34 42 13 - Signal Systems', '34 42 16 - Grade Crossing Protection',
  '33 40 00 - Storm Drainage', '31 23 00 - Excavation and Fill',
  '03 30 00 - Cast-in-Place Concrete', '26 56 00 - Exterior Lighting',
] as const;

export function validateRecordDraft(draft: MobileRecordDraft): string | null {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (draft.version !== 1 || !['rfis', 'submittals'].includes(draft.kind) || !uuid.test(draft.projectId) || !uuid.test(draft.clientId)) return 'The draft identity is invalid.';
  if (!draft.title.trim() || draft.title.length > 300) return 'Enter a title or subject of up to 300 characters.';
  if (draft.body.length > 50_000 || (draft.kind === 'rfis' && !draft.body.trim())) return 'Enter the question (up to 50,000 characters).';
  if (draft.milestoneId && !uuid.test(draft.milestoneId)) return 'Select a valid milestone.';
  if (draft.kind === 'rfis' && (!uuid.test(draft.assignedTo) || !['low', 'medium', 'high', 'critical'].includes(draft.priority))) return 'Select an assignee and priority.';
  if (draft.kind === 'submittals' && !MOBILE_SPEC_SECTIONS.includes(draft.specSection as typeof MOBILE_SPEC_SECTIONS[number])) return 'Select a specification section.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate)) return 'Enter a due date in YYYY-MM-DD format.';
  const date = new Date(`${draft.dueDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== draft.dueDate) return 'Enter a valid due date.';
  return null;
}

export interface MobileEarthCamEmbed {
  id: string;
  projectId: string;
  label: string;
  url: string;
  createdAt: string;
}

export interface MobileEarthCamEmbedInput {
  projectId: string;
  id?: string;
  label: string;
  embedInput: string;
}

export interface MobileEarthCamEmbedDeleteInput {
  projectId: string;
  id: string;
}

export interface MobileEarthCamEmbedDeleteResult {
  id: string;
  deleted: true;
}

export interface MobileDashboardSummary {
  submittalsTotal: number;
  submittalsPending: number;
  openRfis: number;
  overdueRfis: number;
  openPunchItems: number;
  criticalPunchItems: number;
}

export interface MobileDailyLog extends MobileDailyLogReadFields {
  id: string;
  projectId: string;
  logDate: string;
  weatherConditions: string;
  workSummary: string;
  safetyNotes: string;
  createdAt: string;
}

export interface MobileTeamMember {
  id: string;
  projectId: string;
  fullName: string;
  email: string;
  role: ProjectRole;
  canEdit: boolean;
}

export interface MobileBootstrap {
  userId: string;
  projects: MobileProject[];
  activeProjectId: string | null;
  dailyLogs: MobileDailyLog[];
  team: MobileTeamMember[];
  submittals?: MobileSubmittal[];
  rfis?: MobileRfi[];
  earthCamEmbeds?: MobileEarthCamEmbed[];
  dashboard?: MobileDashboardSummary;
  pagination?: {
    offset: number;
    limit: number;
    dailyLogsHasMore: boolean;
    submittalsHasMore: boolean;
    rfisHasMore: boolean;
  };
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
  /** Optional for compatibility with pre-parity drafts already on devices. */
  fieldEntries?: MobileDailyLogFields;
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

export interface MobilePushRegistration {
  expoPushToken: string;
  platform: 'ios' | 'android';
  appProfile: 'development' | 'staging' | 'production';
  deviceName: string | null;
}

export interface MobileAccountDeletionRequest {
  clientRequestId: string;
  localWork: {
    drafts: number;
    outbox: number;
    photos: number;
  };
}

export interface MobileAccountDeletionResult {
  id: string;
  status: 'pending' | 'reviewing' | 'processing' | 'failed' | 'canceled';
  requestedAt: string;
  scheduledFor: string;
  duplicate?: boolean;
  sessionsRevoked?: boolean;
}

export interface MobileInvitation {
  token: string;
  projectId: string;
  projectName: string;
  email: string;
  role: ProjectRole;
  expiresAt: string;
}

export type MobileDeepLink =
  | { kind: 'auth_callback'; code: string | null; accessToken: string | null; refreshToken: string | null }
  | { kind: 'project'; projectId: string }
  | { kind: 'daily_log'; projectId: string; dailyLogId: string }
  | { kind: 'invitation'; token: string }
  | { kind: 'unsupported' };

function segment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return null;
  }
}

export function parseMobileDeepLink(
  rawUrl: string,
  verifiedWebHosts: readonly string[] = ['railcommand.io'],
): MobileDeepLink {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'unsupported' };
  }

  const isCustom = url.protocol === 'railcommand:';
  const isVerifiedWeb = url.protocol === 'https:'
    && verifiedWebHosts.some((host) => url.hostname === host.toLowerCase());
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
  if (path[0] === 'invite' && path[1] && /^[a-f0-9]{32,128}$/i.test(path[1])) {
    return { kind: 'invitation', token: path[1] };
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
    & Partial<Pick<MobileDailyLogDraft, 'geoTag' | 'fieldEntries'>>,
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
    ...((values.fieldEntries ?? existing?.fieldEntries) ? { fieldEntries: copyDailyLogFields((values.fieldEntries ?? existing?.fieldEntries)!) } : {}),
  };
}

export function draftToSyncOperation(
  userId: string,
  draft: MobileDailyLogDraft,
): MobileDailyLogSyncOperation {
  if (draft.weatherConditions.length > 200 || draft.workSummary.length > 20000 || draft.safetyNotes.length > 20000) throw new Error('Weather, work summary, or safety notes exceed the server text limit. Shorten the text before queueing; your draft was not truncated.');
  const operation: MobileDailyLogSyncOperation = {
    operationId: draft.clientId,
    userId,
    projectId: draft.projectId,
    clientId: draft.clientId,
    idempotencyKey: draft.idempotencyKey,
    payload: {
      log_date: draft.logDate,
      ...dailyLogFieldPayload(draft.fieldEntries),
      weather_conditions: draft.weatherConditions,
      work_summary: draft.workSummary,
      safety_notes: draft.safetyNotes,
      geo_tag: draft.geoTag,
    },
    status: 'pending',
    attemptCount: 0,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    nextAttemptAt: draft.updatedAt,
    lastError: null,
  };
  if (new TextEncoder().encode(JSON.stringify(operation)).length > 60 * 1024) throw new Error('This daily log exceeds the mobile synchronization size limit. Shorten the text or split the work before queueing; the draft remains saved.');
  return operation;
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
