import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MobileAccountDeletionRequest,
  MobileAccountDeletionResult,
} from '@railcommand/domain';
import { createAdminClient } from '@/lib/supabase/admin';

type DeletionRow = {
  id: string;
  status: MobileAccountDeletionResult['status'];
  requested_at: string;
  scheduled_for: string;
  duplicate?: boolean;
};

function toResult(row: DeletionRow): MobileAccountDeletionResult {
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requested_at,
    scheduledFor: row.scheduled_for,
    duplicate: row.duplicate ?? false,
  };
}

export function accountDeletionErrorMessage(message: string): string {
  if (message.includes('RC401_RECENT_PASSWORD_REQUIRED')) {
    return 'Confirm your current password immediately before submitting this request.';
  }
  if (message.includes('RC409_UNSYNCHRONIZED_WORK')) {
    return 'Synchronize, reopen, or permanently discard all device work before requesting deletion.';
  }
  if (message.includes('RC409_SOLE_ORGANIZATION_ADMIN')) {
    return 'Transfer organization administration to another eligible member, or request organization closure, before deleting this account.';
  }
  return 'Could not process the account deletion request.';
}

export function accountDeletionHttpStatus(message: string): number {
  if (message.includes('current password')) return 401;
  if (message.includes('Synchronize') || message.includes('Transfer')) return 409;
  if (message.includes('sessions could not be revoked')) return 503;
  return 500;
}

export async function getActiveAccountDeletion(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileAccountDeletionResult | null> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('id, status, requested_at, scheduled_for')
    .eq('profile_id', userId)
    .in('status', ['pending', 'reviewing', 'processing', 'failed'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Could not load the account deletion request');
  return data ? toResult(data as DeletionRow) : null;
}

export async function submitAccountDeletion(
  supabase: SupabaseClient,
  accessToken: string,
  request: MobileAccountDeletionRequest,
  source: 'mobile' | 'web',
): Promise<MobileAccountDeletionResult> {
  const { data, error } = await supabase.rpc('request_account_deletion', {
    p_client_request_id: request.clientRequestId,
    p_request_source: source,
    p_local_drafts_count: request.localWork.drafts,
    p_local_outbox_count: request.localWork.outbox,
    p_local_photos_count: request.localWork.photos,
  });
  if (error) throw new Error(accountDeletionErrorMessage(error.message));
  const row = (data as DeletionRow[] | null)?.[0];
  if (!row) throw new Error('Could not create the account deletion request');

  const result = toResult(row);
  const admin = createAdminClient();
  const { error: revokeError } = await admin.auth.admin.signOut(accessToken, 'global');
  const { error: auditError } = await admin.from('account_deletion_audit').insert({
    request_id: result.id,
    event_code: revokeError ? 'session_revocation_failed' : 'sessions_revoked',
    actor: 'system',
    metadata: { scope: 'global' },
  });
  if (auditError) throw new Error('The deletion request was saved, but its security audit could not be recorded. Contact support.');
  if (revokeError) {
    throw new Error('The deletion request was saved, but other sessions could not be revoked. Retry or contact support.');
  }
  return { ...result, sessionsRevoked: true };
}

export async function cancelAccountDeletion(
  supabase: SupabaseClient,
  requestId: string,
): Promise<MobileAccountDeletionResult> {
  const { data, error } = await supabase.rpc('cancel_account_deletion', {
    p_request_id: requestId,
  });
  if (error) throw new Error(accountDeletionErrorMessage(error.message));
  const row = (data as DeletionRow[] | null)?.[0];
  if (!row) throw new Error('Could not cancel the account deletion request');
  return toResult(row);
}
