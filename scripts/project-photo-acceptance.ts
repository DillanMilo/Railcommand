// Explicit live acceptance against the existing isolated QA project only.
// Run: node --env-file=.env.local --import tsx scripts/project-photo-acceptance.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { processProjectPhotoUpload } from '../src/lib/project-photo-upload';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && anon && service, 'Existing QA environment is required');
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const helper = (command: string, userId?: string) => JSON.parse(execFileSync(
    process.execPath, ['scripts/offline-browser-qa.mjs', command, ...(userId ? [userId] : [])],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ));
  // Credentials are kept in memory and never printed.
  const fixture = helper('setup');
  const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const operationId = randomUUID();
  const prefix = `${fixture.projectId}/project_photo/${fixture.projectId}/${fixture.userId}`;
  const paths = new Set<string>();
  try {
    const signedIn = await user.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
    assert.equal(signedIn.error, null, 'QA sign-in');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FoAAAAASUVORK5CYII=', 'base64');
    const form = (id = operationId, bytes = png) => {
      const data = new FormData();
      data.set('metadata', JSON.stringify({ userId: fixture.userId, projectId: fixture.projectId,
        operationId: id, fileName: 'IMG_QA.png', geoLat: null, geoLng: null,
        capturedAt: '2026-08-31T12:00:00.000Z' }));
      data.set('file', new File([bytes], 'IMG_QA.png', { type: 'image/png' }));
      return data;
    };
    const deps = { createClient: async () => user, revalidatePath: () => {} };
    const deliveries = await Promise.all([1, 2, 3].map(() => processProjectPhotoUpload(form(), deps)));
    deliveries.forEach((result) => assert.deepEqual(result, { success: true }, 'Concurrent duplicate delivery'));
    assert.deepEqual(await processProjectPhotoUpload(form(), deps), { success: true }, 'Repeat completed delivery');
    const rows = await admin.from('attachments').select('id, file_url').eq('uploaded_by', fixture.userId);
    assert.equal(rows.error, null);
    assert.equal(rows.data?.length, 1, 'Exactly one attachment after all deliveries');
    for (const row of rows.data ?? []) paths.add(row.file_url.split('/project-photos/')[1]);
    const objects = await admin.storage.from('project-photos').list(prefix);
    assert.equal(objects.error, null);
    assert.equal(objects.data?.length, 1, 'Exactly one stored object after concurrent delivery');
    for (const object of objects.data ?? []) paths.add(`${prefix}/${object.name}`);
    const altered = await processProjectPhotoUpload(form(operationId, Buffer.concat([png, Buffer.from('changed')])), deps);
    assert(!altered.success && altered.retryable === false, 'Conflicting bytes fail without overwrite');
    helper('revoke', fixture.userId);
    for (const id of [operationId, randomUUID()]) {
      const denied = await processProjectPhotoUpload(form(id), deps);
      assert(!denied.success && denied.retryable === false, 'Revoked member cannot retry or add a photo');
    }
    console.log(JSON.stringify({ result: 'PASS', concurrentDeliveries: 3,
      attachmentRows: 1, storageObjects: 1, repeatDelivery: 'PASS',
      conflictingBytes: 'PASS', revokedMembership: 'PASS', syntheticPhotoBytes: png.length }));
  } finally {
    // Scope cleanup to this synthetic user's known objects and records.
    const objects = await admin.storage.from('project-photos').list(prefix);
    assert.equal(objects.error, null, 'List QA objects for cleanup');
    for (const object of objects.data ?? []) paths.add(`${prefix}/${object.name}`);
    if (paths.size) {
      const removed = await admin.storage.from('project-photos').remove([...paths]);
      assert.equal(removed.error, null, 'QA storage cleanup');
    }
    helper('cleanup', fixture.userId);
    const remaining = await admin.from('attachments').select('id').eq('uploaded_by', fixture.userId);
    assert.equal(remaining.error, null);
    assert.equal(remaining.data?.length, 0, 'QA attachment cleanup');
    console.log(JSON.stringify({ cleanup: 'PASS' }));
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
