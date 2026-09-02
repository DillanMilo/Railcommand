// Online-only, synthetic API QA. Importing this module performs no work.
// Caller owns the exact Preview/Supabase target guards and memory-only sign-in.
// Creates at most 3 top-level records + 1 photo; no cleanup, account, or admin writes.
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { deflateSync } from 'node:zlib';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createMobileDraft, draftToSyncOperation, MOBILE_SPEC_SECTIONS,
  type MobileBootstrap, type MobileDailyLogPhotoFinalizeResult, type MobileDailyLogPhotoPrepareResult,
  type MobileDailyLogPhotoSyncOperation, type MobileDailyLogSyncResult, type MobilePdfReport,
  type MobileRecordCreateResult, type MobileRecordDetail, type MobileRecordDraft, type MobileRecordFormOptions,
} from '../../packages/domain/src/index';

type Api = (path: string, body?: unknown, expectedStatus?: number, headers?: Record<string, string>) => Promise<unknown>;
type Options = { api: Api; supabase: SupabaseClient; userId: string; projectId: string; report: (label: string, details?: Record<string, unknown>) => void };
const SYNTHETIC_PROJECT = '20000000-0000-4000-8000-000000000001';
function check(value: unknown, label: string): asserts value { if (!value) throw new Error(`Preview QA: ${label}`); }
const same = (actual: unknown, expected: unknown, label: string) => check(isDeepStrictEqual(actual, expected), label);

/** A valid 1x1 RGBA PNG generated entirely in memory; no real photo or metadata. */
function syntheticPng(): Buffer {
  function chunk(type: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 22, 163, 74, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

export async function verifyPreviewWorkflows({ api, supabase, userId, projectId, report }: Options): Promise<void> {
  check(projectId === SYNTHETIC_PROJECT, 'refusing a non-synthetic project');
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId), 'invalid reviewer identity');
  const ids = { dailyLog: randomUUID(), photo: randomUUID(), rfi: randomUUID(), submittal: randomUUID(), missing: randomUUID() };
  // Recovery identifiers must be visible before any mutation, even if a later check fails.
  report('Fresh synthetic QA identifiers — retain if interrupted', { projectId, ...ids });
  const json = async <T>(path: string, body?: unknown, status = 200, headers: Record<string, string> = {}) =>
    await api(`/api/mobile/v1${path}`, body, status, headers) as T;
  const query = (values: Record<string, string>) => new URLSearchParams(values).toString();
  const bootstrap = () => json<MobileBootstrap>(`/bootstrap?${query({ projectId })}`);
  const initial = await bootstrap();
  same(initial.userId, userId, 'bootstrap identity mismatch'); same(initial.activeProjectId, projectId, 'bootstrap project mismatch');
  const project = initial.projects.find((item) => item.id === projectId);
  check(project?.name === 'Synthetic US Track Renewal' && project.canEdit && project.canCreateRfi && project.canCreateSubmittal,
    'synthetic project or required creation permissions unavailable');
  check(initial.team.some((member) => member.id === userId && member.projectId === projectId), 'reviewer absent from project team');
  const rfiOptions = await json<MobileRecordFormOptions>(`/records/options?${query({ kind: 'rfis', projectId })}`);
  const submittalOptions = await json<MobileRecordFormOptions>(`/records/options?${query({ kind: 'submittals', projectId })}`);
  for (const [kind, options] of [['rfis', rfiOptions], ['submittals', submittalOptions]] as const) {
    same(options.kind, kind, 'options kind mismatch'); same(options.projectId, projectId, 'options project mismatch');
    check(Array.isArray(options.assignees) && Array.isArray(options.milestones), 'options arrays unavailable');
  }
  check(rfiOptions.assignees.some((person) => person.id === userId), 'reviewer is not an allowed RFI assignee');
  report('Bootstrap and RFI/Submittal options verified');

  const now = new Date(); const today = now.toISOString().slice(0, 10);
  const dueDate = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const marker = `Synthetic Preview QA ${ids.dailyLog}`;
  const geoTag = { lat: 0, lng: 0, accuracy: 0, altitude: 0, timestamp: now.toISOString() };
  const draft = createMobileDraft(projectId, {
    logDate: today, weatherConditions: 'Clear', workSummary: `${marker}; no customer data`, safetyNotes: 'Synthetic safety check only', geoTag,
    fieldEntries: { weatherTemp: '-4.5', weatherWind: 'NW 8 mph',
      personnel: [{ rowId: 'qa-personnel', role: 'Foreman', headcount: '0', company: 'Synthetic QA Crew' }],
      equipment: [{ rowId: 'qa-equipment', type: 'Synthetic tamper', count: '1', notes: 'No real equipment' }],
      workItems: [{ rowId: 'qa-work', description: 'Synthetic track inspection', quantity: '12.25', unit: 'LF', location: 'Synthetic station' }],
    },
  }, null, now, () => ids.dailyLog);
  const operation = draftToSyncOperation(userId, draft);
  for (let attempt = 0; attempt < 3; attempt++) {
    const receipt = await json<MobileDailyLogSyncResult>('/daily-logs/sync', operation);
    same(receipt.id, ids.dailyLog, 'daily-log identity changed'); same(receipt.projectId, projectId, 'daily-log receipt project mismatch');
    same(receipt.duplicate, attempt > 0, 'daily-log creation/replay state mismatch');
  }
  const afterLog = await bootstrap();
  const logs = afterLog.dailyLogs.filter((log) => log.id === ids.dailyLog);
  same(logs.length, 1, 'created daily log missing or duplicated in bootstrap');
  const log = logs[0]; same(log.projectId, projectId, 'daily-log readback project mismatch');
  same([log.logDate, log.weatherTemp, log.weatherConditions, log.weatherWind, log.workSummary, log.safetyNotes],
    [today, -4.5, draft.weatherConditions, 'NW 8 mph', draft.workSummary, draft.safetyNotes], 'daily-log text/weather readback mismatch');
  same(log.geoTag, geoTag, 'daily-log location readback mismatch');
  same(log.personnel?.map(({ role, headcount, company }) => ({ role, headcount, company })), operation.payload.personnel, 'personnel readback mismatch');
  same(log.equipment?.map(({ equipmentType, count, notes }) => ({ equipment_type: equipmentType, count, notes })), operation.payload.equipment, 'equipment readback mismatch');
  same(log.workItems?.map(({ description, quantity, unit, location }) => ({ description, quantity, unit, location })), operation.payload.work_items, 'work-item readback mismatch');
  const logRows = await supabase.from('daily_logs').select('id').eq('project_id', projectId).eq('created_by', userId).eq('idempotency_key', operation.idempotencyKey);
  check(!logRows.error, 'could not verify daily-log idempotency rows'); same(logRows.data?.map((row) => row.id), [ids.dailyLog], 'daily-log idempotency row count mismatch');
  report('Rich daily log created once; two replays and all child fields verified', { id: ids.dailyLog });

  const png = syntheticPng();
  const photo: MobileDailyLogPhotoSyncOperation = { operationId: ids.photo, userId, projectId, parentEntityId: ids.dailyLog,
    idempotencyKey: `daily-log-photo:${ids.photo}`, payload: { fileName: 'preview-qa.png', fileType: 'image/png', fileSize: png.length,
      photoCategory: 'standard', geoLat: geoTag.lat, geoLng: geoTag.lng, capturedAt: now.toISOString() } };
  await json('/daily-logs/photos/prepare', { ...photo, parentEntityId: ids.missing }, 409);
  const prepared = await json<MobileDailyLogPhotoPrepareResult>('/daily-logs/photos/prepare', photo);
  same(prepared.bucket, 'project-photos', 'photo bucket mismatch');
  same(prepared.path, `${projectId}/daily_log/${ids.dailyLog}/${ids.photo}-preview-qa.png`, 'photo upload path mismatch');
  check(typeof prepared.token === 'string' && prepared.token.length > 0, 'photo upload authorization missing');
  const storage = { bucket: prepared.bucket, path: prepared.path };
  await json('/daily-logs/photos/finalize', { operation: photo, storage: { ...storage, path: `${storage.path}-tampered` } }, 400);
  const uploaded = await supabase.storage.from(storage.bucket).uploadToSignedUrl(storage.path, prepared.token, png, { contentType: 'image/png' });
  check(!uploaded.error, 'synthetic PNG upload failed');
  for (let attempt = 0; attempt < 2; attempt++) {
    const receipt = await json<MobileDailyLogPhotoFinalizeResult>('/daily-logs/photos/finalize', { operation: photo, storage });
    same(receipt.id, ids.photo, 'photo identity changed'); same(receipt.duplicate, attempt > 0, 'photo finalize replay state mismatch');
  }
  const attachments = await supabase.from('attachments').select('id,entity_id,entity_type,project_id,file_size,file_type,photo_category,geo_lat,geo_lng,captured_at')
    .eq('project_id', projectId).eq('entity_id', ids.dailyLog).eq('idempotency_key', photo.idempotencyKey);
  check(!attachments.error, 'could not verify photo metadata'); same(attachments.data?.length, 1, 'photo metadata duplicated/missing');
  const attached = attachments.data![0];
  same([attached.id, attached.entity_id, attached.entity_type, attached.project_id, Number(attached.file_size), attached.file_type, attached.photo_category],
    [ids.photo, ids.dailyLog, 'daily_log', projectId, png.length, 'image/png', 'standard'], 'photo metadata mismatch');
  same([attached.geo_lat, attached.geo_lng, Date.parse(attached.captured_at)], [geoTag.lat, geoTag.lng, now.getTime()], 'photo location/time mismatch');
  const downloaded = await supabase.storage.from(storage.bucket).download(storage.path);
  check(!downloaded.error && downloaded.data, 'authenticated photo download failed');
  check(Buffer.from(await downloaded.data.arrayBuffer()).equals(png), 'downloaded photo bytes differ');
  report('One synthetic PNG uploaded, finalized once, replayed, and downloaded byte-for-byte', { id: ids.photo, bytes: png.length });

  for (const kind of ['rfis', 'submittals'] as const) {
    const clientId = kind === 'rfis' ? ids.rfi : ids.submittal;
    const record: MobileRecordDraft = { version: 1, kind, projectId, clientId, title: `${marker} ${kind}`,
      body: 'Synthetic API acceptance only; no customer data', priority: 'medium', assignedTo: kind === 'rfis' ? userId : '',
      dueDate, milestoneId: '', specSection: kind === 'submittals' ? MOBILE_SPEC_SECTIONS[0] : '', updatedAt: now.toISOString() };
    const headers = { 'idempotency-key': clientId };
    let number: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const receipt = await json<MobileRecordCreateResult>('/records/create', record, attempt === 0 ? 201 : 200, headers);
      same([receipt.id, receipt.projectId, receipt.kind, receipt.duplicate], [clientId, projectId, kind, attempt > 0], 'record creation/replay identity mismatch');
      check(new RegExp(`^${kind === 'rfis' ? 'RFI' : 'SUB'}-\\d+$`).test(receipt.number), 'server-assigned record number missing');
      if (number) same(receipt.number, number, 'replay changed server record number'); number = receipt.number;
    }
    await json('/records/create', { ...record, body: `${record.body}; changed content` }, 409, headers);
    const scope = { kind, projectId, recordId: clientId };
    const detail = await json<MobileRecordDetail>(`/records/detail?${query(scope)}`);
    same([detail.kind, detail.record.id, detail.record.projectId, detail.record.number, detail.record.dueDate, detail.record.submittedBy?.id],
      [kind, clientId, projectId, number, dueDate, userId], 'record detail identity/references mismatch');
    same(detail.attachments, [], 'fresh record has unexpected attachments'); same(detail.milestone, null, 'fresh record has unexpected milestone');
    if (detail.kind === 'rfis') {
      same([detail.record.subject, detail.record.question, detail.record.priority, detail.record.status, detail.record.assignedTo?.id],
        [record.title, record.body, 'medium', 'open', userId], 'RFI detail changed after conflict'); same(detail.record.responses, [], 'fresh RFI has unexpected responses');
    } else same([detail.record.title, detail.record.description, detail.record.specSection, detail.record.status],
      [record.title, record.body, record.specSection, 'submitted'], 'submittal detail changed after conflict');
    const pdf = await json<MobilePdfReport>('/reports/pdf', { kind, projectId, recordIds: [clientId] });
    check(typeof pdf.base64 === 'string', 'PDF base64 missing'); const bytes = Buffer.from(pdf.base64, 'base64');
    same([pdf.mimeType, pdf.recordCount, pdf.byteLength], ['application/pdf', 1, bytes.length], 'PDF metadata/count mismatch');
    check(bytes.length > 100 && bytes.length <= 2 * 1024 * 1024 && bytes.subarray(0, 5).toString() === '%PDF-' && bytes.subarray(-32).toString().includes('%%EOF'), 'PDF bytes invalid');
    await json(`/records/detail?${query({ ...scope, recordId: ids.missing })}`, undefined, 404);
    await json(`/records/attachment?${query({ ...scope, attachmentId: ids.photo })}`, undefined, 404);
    await json('/reports/pdf', { kind, projectId, recordIds: [clientId, ids.missing] }, 409);
    report(`${kind}: created once, replay/conflict, detail, PDF, and missing-record/attachment denials verified`, { id: clientId, number, pdfBytes: bytes.length });
  }
  const final = await bootstrap();
  same(final.dailyLogs.filter((row) => row.id === ids.dailyLog).length, 1, 'final daily-log count mismatch');
  same(final.rfis?.filter((row) => row.id === ids.rfi).length, 1, 'final RFI count mismatch');
  same(final.submittals?.filter((row) => row.id === ids.submittal).length, 1, 'final submittal count mismatch');
  report('Online-only synthetic API workflows passed; records retained, not device offline proof', { records: 3, photos: 1, ...ids });
}
