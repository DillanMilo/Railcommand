import type { MobileRecordAttachment, MobileRecordAttachmentLink, MobileRecordDetail, MobileRecordPerson, MobileRecordScope } from '@railcommand/domain';

export const recordCacheMaxAge = 30 * 24 * 60 * 60 * 1000;
export const recordCacheMaxBytes = 2 * 1024 * 1024;
export const recordRefreshInterval = 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function recordScope(kind: unknown, projectId: unknown, recordId: unknown): MobileRecordScope | null {
  return (kind === 'rfis' || kind === 'submittals') && typeof projectId === 'string' && uuid.test(projectId)
    && typeof recordId === 'string' && uuid.test(recordId)
    ? { kind, projectId: projectId.toLowerCase(), recordId: recordId.toLowerCase() } : null;
}
export const recordCacheKey = (scope: MobileRecordScope) => `record:${scope.kind}:${scope.projectId}:${scope.recordId}`;
const text = (value: unknown): string => { if (typeof value !== 'string') throw new Error('Invalid record text'); return value; };
const nullableText = (value: unknown) => value === null ? null : text(value);
const person = (value: MobileRecordPerson | null) => value === null ? null : { id: text(value.id), name: text(value.name) };

// Allowlist cached fields. Transport URLs, tokens, profile emails, and other future
// response fields must never be spread into the private record cache.
export function cleanRecordDetail(value: MobileRecordDetail, scope: MobileRecordScope, now = Date.now()): MobileRecordDetail | null {
  try {
    if (value.kind !== scope.kind || value.record.id !== scope.recordId || value.record.projectId !== scope.projectId) return null;
    const fetched = Date.parse(value.fetchedAt);
    if (!Number.isFinite(fetched) || fetched < now - recordCacheMaxAge || fetched > now + 5 * 60_000) return null;
    if (!Array.isArray(value.attachments) || value.attachments.length > 200) return null;
    const common = {
      fetchedAt: text(value.fetchedAt),
      milestone: person(value.milestone),
      attachments: value.attachments.map((item) => {
        if (!uuid.test(item.id) || !Number.isFinite(item.size) || item.size < 0) throw new Error('Invalid attachment');
        return { id: item.id, fileName: text(item.fileName), fileType: text(item.fileType), size: item.size, category: text(item.category) };
      }),
    };
    const row = value.record;
    const base = { id: scope.recordId, projectId: scope.projectId, number: text(row.number), dueDate: text(row.dueDate),
      createdAt: text(row.createdAt), submitDate: text(row.submitDate), submittedBy: person(row.submittedBy) };
    let result: MobileRecordDetail;
    if (value.kind === 'rfis') {
      const rfi = value.record;
      if (!['open', 'answered', 'closed', 'overdue'].includes(rfi.status) || !['low', 'medium', 'high', 'critical'].includes(rfi.priority)
        || !Array.isArray(rfi.responses) || rfi.responses.length > 200) return null;
      result = { ...common, kind: 'rfis', record: { ...base, subject: text(rfi.subject), status: rfi.status, priority: rfi.priority,
        question: text(rfi.question), answer: nullableText(rfi.answer), responseDate: nullableText(rfi.responseDate), assignedTo: person(rfi.assignedTo),
        responses: rfi.responses.map((response) => {
          if (typeof response.official !== 'boolean') throw new Error('Invalid response');
          return { id: text(response.id), author: person(response.author), content: text(response.content), official: response.official, createdAt: text(response.createdAt) };
        }),
      } };
    } else {
      const submittal = value.record;
      if (!['draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected'].includes(submittal.status)) return null;
      result = { ...common, kind: 'submittals', record: { ...base, title: text(submittal.title), status: submittal.status,
        description: text(submittal.description), specSection: text(submittal.specSection), reviewDate: nullableText(submittal.reviewDate),
        reviewNotes: nullableText(submittal.reviewNotes), reviewedBy: person(submittal.reviewedBy),
      } };
    }
    return new TextEncoder().encode(JSON.stringify(result)).length <= recordCacheMaxBytes ? result : null;
  } catch { return null; }
}

export type RecordReadState = { detail: MobileRecordDetail | null; loading: boolean; cached: boolean; message: string };
export interface RecordReadDependencies {
  read(): Promise<MobileRecordDetail | null>;
  save(value: MobileRecordDetail): Promise<void>;
  remove(): Promise<void>;
  fetch(): Promise<MobileRecordDetail>;
  isCurrent(): boolean;
  emit(state: RecordReadState): void;
}

export async function loadRecordDetail(
  scope: MobileRecordScope,
  online: boolean,
  deps: RecordReadDependencies,
  options: { force?: boolean; now?: number } = {},
): Promise<void> {
  const now = options.now ?? Date.now();
  let cached: MobileRecordDetail | null = null;
  const emit = (state: RecordReadState) => { if (deps.isCurrent()) deps.emit(state); };
  try { const stored = await deps.read(); cached = stored && cleanRecordDetail(stored, scope); } catch { /* A fresh read can still succeed. */ }
  if (!deps.isCurrent()) return;
  emit({ detail: cached, cached: Boolean(cached), loading: online, message: cached ? 'Saved copy — read-only' : 'This record has not been saved on this device.' });
  if (!online) return;
  const fetchedAt = cached ? Date.parse(cached.fetchedAt) : 0;
  if (!options.force && cached && Number.isFinite(fetchedAt) && fetchedAt >= now - recordRefreshInterval) {
    emit({ detail: cached, cached: true, loading: false, message: 'Recently synchronized · Text saved for offline reading' });
    return;
  }
  let detail: MobileRecordDetail;
  try {
    const next = await deps.fetch();
    if (!deps.isCurrent()) return;
    const valid = cleanRecordDetail(next, scope);
    if (!valid) throw new Error('The record response could not be verified.');
    detail = valid;
  } catch (error) {
    if (!deps.isCurrent()) return;
    const denied = typeof error === 'object' && error !== null && 'status' in error && [401, 403, 404].includes(Number(error.status));
    if (denied) {
      emit({ detail: null, cached: false, loading: false, message: 'This record is no longer accessible. Sign in again or check your project access.' });
      try { await deps.remove(); } catch {
        emit({ detail: null, cached: false, loading: false, message: 'Access is unavailable and the saved copy could not be removed. Sign out to clear this account’s device data.' });
      }
    } else {
      const tooLarge = typeof error === 'object' && error !== null && 'status' in error && Number(error.status) === 413;
      emit({ detail: cached, cached: Boolean(cached), loading: false, message: tooLarge
        ? `This record is too large for mobile viewing. Open it on the web.${cached ? ' The saved copy below is older.' : ''}`
        : cached ? 'Could not refresh. Showing the saved, read-only copy.' : 'Could not load this record. Reconnect and try again.' });
    }
    return;
  }
  try {
    await deps.save(detail);
    emit({ detail, cached: false, loading: false, message: 'Up to date · Text saved for offline reading' });
  } catch {
    emit({ detail, cached: false, loading: false, message: 'Up to date, but not saved on this device. Check available storage before going offline.' });
  }
}

export function verifiedAttachmentUrl(link: MobileRecordAttachmentLink, attachment: MobileRecordAttachment, scope: MobileRecordScope, supabaseUrl: string, now = Date.now()): string | null {
  try {
    const url = new URL(link.url);
    const expiry = Date.parse(link.expiresAt);
    const bucket = { standard: 'project-photos', thermal: 'thermal-photos', document: 'project-documents' }[attachment.category];
    const prefix = `/storage/v1/object/sign/${bucket}/${scope.projectId}/${scope.kind === 'rfis' ? 'rfi' : 'submittal'}/${scope.recordId}/`;
    if (!bucket || link.attachmentId !== attachment.id || !Number.isFinite(expiry) || expiry <= now || expiry > now + 120_000
      || url.protocol !== 'https:' || url.origin !== new URL(supabaseUrl).origin || url.username || url.password || url.hash
      || !url.pathname.startsWith(prefix) || !url.searchParams.get('token') || [...url.searchParams.keys()].some((key) => key !== 'token')) return null;
    const fileName = decodeURIComponent(url.pathname.slice(prefix.length));
    return /^[a-z0-9][a-z0-9._-]*$/i.test(fileName) ? url.toString() : null;
  } catch { return null; }
}
