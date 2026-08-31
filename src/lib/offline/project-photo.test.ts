import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import type { SupabaseClient } from '@supabase/supabase-js';
import { processProjectPhotoUpload } from '../project-photo-upload';
import { createProjectPhotoOperation } from './project-photo';
import { scheduleOutboxRetry, MAX_SYNC_ATTEMPTS } from './outbox';
import { PROJECT_PHOTO_MAX_BYTES, validateProjectPhoto } from '../project-photo-policy';

const userId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const photo = () => new File([new Uint8Array([255, 216, 255, 224, 1, 2, 3])], 'IMG_1234.jpeg', { type: 'image/jpeg' });
function form(file = photo(), owner = userId) {
  const data = new FormData();
  data.set('file', file);
  data.set('metadata', JSON.stringify({
    userId: owner, projectId, operationId, fileName: file.name,
    geoLat: null, geoLng: null, capturedAt: '2026-08-31T12:00:00.000Z',
  }));
  return data;
}

// Stateful backend double: it persists uploads/rows across deliveries, enforces
// primary-key collisions, and can lose the insert response after committing.
function backend() {
  let row: Record<string, unknown> | null = null;
  let member = true;
  let authenticated = true;
  let failInsert = false;
  let loseInsertResponse = false;
  let uploadCalls = 0;
  let insertCalls = 0;
  const objects = new Set<string>();
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId } : null }, error: null }) },
    from(table: string) {
      const builder = {
        select: () => builder, eq: () => builder,
        single: async () => ({ data: table === 'project_members' ? (member ? { project_role: 'foreman' } : null) : { role: 'viewer' }, error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
        insert: async (value: Record<string, unknown>) => {
          insertCalls++;
          if (failInsert) return { error: { code: '08006', message: 'Connection lost before insert' } };
          if (row) return { error: { code: '23505', message: 'Duplicate primary key' } };
          row = value;
          return loseInsertResponse ? { error: { code: '08006', message: 'Connection lost after insert' } } : { error: null };
        },
      };
      return builder;
    },
    storage: { from: () => ({ upload: async (path: string) => {
      uploadCalls++;
      if (objects.has(path)) return { error: { statusCode: '400', code: 'Duplicate', message: 'Already exists' } };
      objects.add(path);
      return { error: null };
    } }) },
  };
  return {
    dependencies: { createClient: async () => client as unknown as SupabaseClient, revalidatePath: () => {} },
    stats: () => ({ uploadCalls, insertCalls, objects: objects.size, row }),
    revoke: () => { member = false; }, signOut: () => { authenticated = false; },
    failInsert: (value: boolean) => { failInsert = value; },
    loseResponse: () => { loseInsertResponse = true; },
  };
}

describe('standalone project photo bandwidth and retry safety', () => {
  it('rejects oversized, empty, and unsupported photos instead of uploading originals', () => {
    assert.equal(validateProjectPhoto({ size: PROJECT_PHOTO_MAX_BYTES, type: 'image/jpeg' }), null);
    assert.match(validateProjectPhoto({ size: PROJECT_PHOTO_MAX_BYTES + 1, type: 'image/jpeg' })!, /500 KB/);
    assert.ok(validateProjectPhoto({ size: 0, type: 'image/jpeg' }));
    assert.ok(validateProjectPhoto({ size: 100, type: 'image/heic' }));
  });

  it('keeps one UUID, idempotency key, and blob reference through bounded offline retries', () => {
    const operation = createProjectPhotoOperation(projectId, { id: operationId, file: photo(), category: 'standard', geo_lat: null, geo_lng: null });
    let retried = operation;
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt++) retried = scheduleOutboxRetry(retried, 'Connection lost');
    assert.equal(retried.status, 'failed');
    assert.equal(retried.operationId, operationId);
    assert.equal(retried.blobId, operationId);
    assert.equal(retried.idempotencyKey, `project-photo:${operationId}`);
  });

  it('enforces the size cap and image signature on the server before any storage write', async () => {
    const db = backend();
    const oversized = new File([new Uint8Array(PROJECT_PHOTO_MAX_BYTES + 1)], 'huge.jpeg', { type: 'image/jpeg' });
    assert.equal((await processProjectPhotoUpload(form(oversized), db.dependencies)).success, undefined);
    assert.equal((await processProjectPhotoUpload(form(new File(['not an image'], 'fake.jpeg', { type: 'image/jpeg' })), db.dependencies)).success, undefined);
    assert.equal(db.stats().uploadCalls, 0);
  });

  it('revalidates membership and actor identity, including duplicate delivery after revocation', async () => {
    const db = backend();
    const other = '44444444-4444-4444-8444-444444444444';
    assert.equal((await processProjectPhotoUpload(form(photo(), other), db.dependencies)).success, undefined);
    assert.equal(db.stats().uploadCalls, 0);
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, true);
    db.revoke();
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, undefined);
    assert.equal(db.stats().uploadCalls, 1);
  });

  it('does not resend stored bytes or create another attachment after successful delivery', async () => {
    const db = backend();
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, true);
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, true);
    assert.equal(db.stats().uploadCalls, 1);
    assert.equal(db.stats().insertCalls, 1);
  });

  it('recovers a lost finalization response without duplicating or deleting the uploaded object', async () => {
    const db = backend(); db.loseResponse();
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, true);
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, true);
    assert.equal(db.stats().objects, 1);
    assert.equal(db.stats().insertCalls, 1);
  });

  it('reuses an uploaded object when a connection fails before the attachment insert', async () => {
    const db = backend(); db.failInsert(true);
    const interrupted = await processProjectPhotoUpload(form(), db.dependencies);
    assert.equal(interrupted.success, undefined);
    db.failInsert(false);
    assert.equal((await processProjectPhotoUpload(form(), db.dependencies)).success, true);
    assert.equal(db.stats().objects, 1);
  });

  it('rejects changed bytes under the same operation ID without overwriting the existing photo', async () => {
    const db = backend();
    await processProjectPhotoUpload(form(), db.dependencies);
    const changed = new File([new Uint8Array([255, 216, 255, 99])], 'IMG_1234.jpeg', { type: 'image/jpeg' });
    const result = await processProjectPhotoUpload(form(changed), db.dependencies);
    assert.equal(result.success, undefined);
    assert.equal(db.stats().uploadCalls, 1);
  });

  it('retains a retryable outcome while the session is unavailable', async () => {
    const db = backend(); db.signOut();
    const result = await processProjectPhotoUpload(form(), db.dependencies);
    assert.equal(result.success, undefined);
    if (!result.success) assert.equal(result.retryable, true);
    assert.equal(db.stats().uploadCalls, 0);
  });
});
