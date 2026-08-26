import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import { accountDeletionErrorMessage, accountDeletionHttpStatus } from './account-deletion';

const migration = readFileSync(
  'supabase/migrations/20260826123325_phase4_account_deletion_compliance.sql',
  'utf8',
);
const finalizer = readFileSync('src/lib/account-deletion-finalizer.ts', 'utf8');
const mobileScreen = readFileSync('apps/mobile/src/app/account-deletion.tsx', 'utf8');
const middleware = readFileSync('src/middleware.ts', 'utf8');

describe('Phase 4 account-deletion compliance', () => {
  it('requires recent password authentication and zero local work', () => {
    assert.match(migration, /auth\.jwt\(\)\s*->\s*'amr'/);
    assert.match(migration, /method'\s*=\s*'password'/);
    assert.match(migration, /interval '5 minutes'/);
    assert.match(migration, /RC409_UNSYNCHRONIZED_WORK/);
    assert.match(migration, /p_local_drafts_count[\s\S]*p_local_outbox_count[\s\S]*p_local_photos_count/);
  });

  it('makes submission idempotent and blocks a sole organization admin', () => {
    assert.match(migration, /account_deletion_requests_one_active_per_profile/);
    assert.match(migration, /status in \('pending', 'reviewing', 'processing', 'failed'\)/);
    assert.match(migration, /duplicate_request/);
    assert.match(migration, /v_other_admins = 0/);
    assert.match(migration, /RC409_SOLE_ORGANIZATION_ADMIN/);
    assert.match(migration, /revoke insert on public\.account_deletion_requests from authenticated/);
  });

  it('limits cancellation to the authenticated owner before processing', () => {
    assert.match(migration, /profile_id = v_user_id/);
    assert.match(migration, /status in \('pending', 'reviewing'\)/);
    assert.match(migration, /result_code = 'user_canceled'/);
  });

  it('keeps finalization staged, retryable, anonymized, and audit-safe', () => {
    assert.match(finalizer, /status\.in\.\(processing,failed\)/);
    assert.match(finalizer, /\.eq\('updated_at', candidate\.updated_at\)/);
    assert.match(finalizer, /if \(claimError\) throw/);
    assert.match(finalizer, /anonymized_at/);
    assert.match(finalizer, /identity_deleted_at/);
    assert.match(finalizer, /completion_email_sent_at/);
    assert.match(finalizer, /idempotencyKey: `account-deletion-completed\/\$\{requestId\}`/);
    assert.match(finalizer, /deleteUser\(candidate\.profile_id, true\)/);
    assert.match(finalizer, /completion_recipient: null/);
    assert.match(finalizer, /retryable_finalization_failure/);
    assert.doesNotMatch(finalizer, /metadata:\s*\{\s*code:\s*finalizationError/);
  });

  it('never queues deletion offline and preserves the existing device work gate', () => {
    assert.match(mobileScreen, /No request is queued offline/);
    assert.match(mobileScreen, /inspectExpoUnsynced/);
    assert.match(mobileScreen, /Synchronize, reopen, or permanently discard/);
    assert.match(mobileScreen, /Final confirmation/);
  });

  it('maps server policy failures to user-safe guidance', () => {
    assert.match(accountDeletionErrorMessage('RC401_RECENT_PASSWORD_REQUIRED'), /current password/);
    assert.match(accountDeletionErrorMessage('RC409_UNSYNCHRONIZED_WORK'), /Synchronize/);
    assert.match(accountDeletionErrorMessage('RC409_SOLE_ORGANIZATION_ADMIN'), /Transfer/);
    assert.equal(accountDeletionErrorMessage('internal email address leaked'), 'Could not process the account deletion request.');
    assert.equal(accountDeletionHttpStatus('Confirm your current password.'), 401);
    assert.equal(accountDeletionHttpStatus('Synchronize your work.'), 409);
    assert.equal(accountDeletionHttpStatus('Transfer organization administration.'), 409);
    assert.equal(accountDeletionHttpStatus('Other sessions could not be revoked.'), 503);
  });

  it('keeps policy, support, and deletion instructions publicly reachable', () => {
    assert.match(middleware, /pathname === '\/privacy'/);
    assert.match(middleware, /pathname === '\/support'/);
    assert.match(middleware, /pathname === '\/account-deletion'/);
  });
});
