import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'rxuvchdqbzvovqijvfhx';
const STAGING_HOST = 'mobile-staging.railcommand.io';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const publishableKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const apiBaseUrl = required('NEXT_PUBLIC_APP_URL');
const qaEmail = required('ACCOUNT_DELETION_QA_EMAIL').toLowerCase();
const qaPassword = required('ACCOUNT_DELETION_QA_PASSWORD');
const expectedUserId = required('ACCOUNT_DELETION_QA_EXPECTED_USER_ID').toLowerCase();
const leavePending = process.env.ACCOUNT_DELETION_QA_LEAVE_PENDING === 'true';
const cancelRequestId = process.env.ACCOUNT_DELETION_QA_CANCEL_REQUEST_ID?.trim() ?? '';

assert.equal(new URL(supabaseUrl).hostname, `${STAGING_REF}.supabase.co`);
assert.equal(new URL(apiBaseUrl).hostname, STAGING_HOST);
assert.match(qaEmail, /^(phase4-deletion-qa)@railcommand\.io$/);
assert.match(expectedUserId, /^[0-9a-f-]{36}$/);

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function signIn() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: qaEmail,
    password: qaPassword,
  });
  if (error || !data.session || !data.user) {
    throw error ?? new Error('Deletion QA sign-in did not return a session');
  }
  assert.equal(data.user.id, expectedUserId, 'Deletion QA user ID mismatch');
  return data.session.access_token;
}

async function post(path, token, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  assert.equal(
    response.headers.get('cache-control'),
    'no-store, max-age=0',
    `${path} must be explicitly no-store`,
  );
  return { response, body: await response.json() };
}

function assertStatus(result, expected, label) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: ${JSON.stringify(result.body)}`,
  );
}

if (cancelRequestId) {
  assert.match(cancelRequestId, /^[0-9a-f-]{36}$/);
  const cancelToken = await signIn();
  const canceled = await post('/api/mobile/v1/account/deletion-request/cancel', cancelToken, {
    requestId: cancelRequestId,
  });
  assertStatus(canceled, 200, 'Deletion request cleanup failed');
  assert.equal(canceled.body.id, cancelRequestId);
  assert.equal(canceled.body.status, 'canceled');
  await supabase.auth.signOut({ scope: 'local' });
  console.log(JSON.stringify({
    stagingProject: STAGING_REF,
    canceledRequestId: cancelRequestId,
    cleanupOnly: true,
  }, null, 2));
  process.exit(0);
}

let token = await signIn();
const blocked = await post('/api/mobile/v1/account/deletion-request', token, {
  clientRequestId: randomUUID(),
  localWork: { drafts: 1, outbox: 0, photos: 0 },
});
assertStatus(blocked, 409, 'Unsynchronized-work rejection failed');
assert.match(blocked.body.error, /Synchronize, reopen, or permanently discard/);

const firstClientRequestId = randomUUID();
const first = await post('/api/mobile/v1/account/deletion-request', token, {
  clientRequestId: firstClientRequestId,
  localWork: { drafts: 0, outbox: 0, photos: 0 },
});
assertStatus(first, 201, 'Deletion request creation failed');
assert.equal(first.body.status, 'pending');
assert.equal(first.body.duplicate, false);
assert.equal(first.body.sessionsRevoked, true);
assert.match(first.body.id, /^[0-9a-f-]{36}$/);

token = await signIn();
const duplicate = await post('/api/mobile/v1/account/deletion-request', token, {
  clientRequestId: randomUUID(),
  localWork: { drafts: 0, outbox: 0, photos: 0 },
});
assertStatus(duplicate, 201, 'Duplicate deletion request failed');
assert.equal(duplicate.body.id, first.body.id);
assert.equal(duplicate.body.duplicate, true);
assert.equal(duplicate.body.sessionsRevoked, true);

token = await signIn();
const canceled = await post('/api/mobile/v1/account/deletion-request/cancel', token, {
  requestId: first.body.id,
});
assertStatus(canceled, 200, 'Deletion request cancellation failed');
assert.equal(canceled.body.id, first.body.id);
assert.equal(canceled.body.status, 'canceled');

let pendingRequestId = null;
if (leavePending) {
  token = await signIn();
  const pending = await post('/api/mobile/v1/account/deletion-request', token, {
    clientRequestId: randomUUID(),
    localWork: { drafts: 0, outbox: 0, photos: 0 },
  });
  assertStatus(pending, 201, 'Pending deletion request preparation failed');
  assert.equal(pending.body.status, 'pending');
  assert.equal(pending.body.duplicate, false);
  assert.equal(pending.body.sessionsRevoked, true);
  pendingRequestId = pending.body.id;
}

await supabase.auth.signOut({ scope: 'local' });

console.log(JSON.stringify({
  stagingProject: STAGING_REF,
  unsynchronizedWorkRejected: true,
  requestCreated: true,
  duplicateRequestIdempotent: true,
  sessionsRevoked: true,
  cancellationVerified: true,
  pendingRequestId,
}, null, 2));
