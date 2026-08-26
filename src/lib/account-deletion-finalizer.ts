import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordEmailEvent } from '@/lib/email-events';

type DueRequest = {
  id: string;
  profile_id: string;
  status: 'pending' | 'reviewing' | 'processing' | 'failed';
  requested_at: string;
  scheduled_for: string;
  updated_at: string;
  anonymized_at: string | null;
  identity_deleted_at: string | null;
  completion_email_sent_at: string | null;
  completion_recipient: string | null;
};

type FinalizationResult = {
  requestId: string;
  status: 'completed' | 'failed' | 'skipped';
  emailSent?: boolean;
};

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'RailCommand <noreply@railcommand.io>';

async function sendCompletionEmail(email: string, requestId: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = 'Your RailCommand account deletion is complete';
  const { data, error } = await resend.emails.send(
    {
      from: FROM_ADDRESS,
      to: email,
      subject,
      html: `<p>Your RailCommand sign-in identity and personal profile data have been deleted.</p><p>Organization-owned construction records may be retained or anonymized as described in the RailCommand Privacy Policy.</p><p>Request reference: ${requestId}</p>`,
      tags: [{ name: 'type', value: 'account_deletion_completed' }],
    },
    { idempotencyKey: `account-deletion-completed/${requestId}` },
  );
  await recordEmailEvent({
    type: 'account_deletion_completed',
    recipientEmail: email,
    subject,
    providerMessageId: data?.id,
    status: error ? 'failed' : 'sent',
    errorMessage: error?.message,
    metadata: { requestId },
  });
  if (error) throw new Error(`Completion email failed: ${error.message}`);
  return true;
}

async function removeAvatarFiles(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('avatars').list(userId, { limit: 1000 });
  if (error) {
    if (error.message.toLowerCase().includes('not found')) return;
    throw error;
  }
  if (!data?.length) return;
  const { error: removeError } = await admin.storage
    .from('avatars')
    .remove(data.map((item) => `${userId}/${item.name}`));
  if (removeError) throw removeError;
}

function isMissingAuthUser(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('user not found') || normalized.includes('not found');
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function recordDeletionAudit(
  admin: AdminClient,
  requestId: string,
  eventCode: string,
  metadata: Record<string, unknown> = {},
  once = false,
): Promise<void> {
  if (once) {
    const { data, error } = await admin
      .from('account_deletion_audit')
      .select('id')
      .eq('request_id', requestId)
      .eq('event_code', eventCode)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return;
  }
  const { error } = await admin.from('account_deletion_audit').insert({
    request_id: requestId,
    event_code: eventCode,
    actor: 'system',
    metadata,
  });
  if (error) throw error;
}

export async function finalizeDueAccountDeletions(limit = 25): Promise<FinalizationResult[]> {
  const admin = createAdminClient();
  const staleProcessing = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pending, error } = await admin
    .from('account_deletion_requests')
    .select('id, profile_id, status, requested_at, scheduled_for, updated_at, anonymized_at, identity_deleted_at, completion_email_sent_at, completion_recipient')
    .not('profile_id', 'is', null)
    .lte('scheduled_for', new Date().toISOString())
    .or(`status.in.(pending,reviewing),and(status.in.(processing,failed),updated_at.lt.${staleProcessing})`)
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Could not load due account-deletion requests: ${error.message}`);

  const results: FinalizationResult[] = [];
  for (const candidate of (pending ?? []) as DueRequest[]) {
    const { data: claimed, error: claimError } = await admin
      .from('account_deletion_requests')
      .update({ status: 'processing', updated_at: new Date().toISOString(), result_code: null })
      .eq('id', candidate.id)
      .eq('status', candidate.status)
      .eq('updated_at', candidate.updated_at)
      .select('id')
      .maybeSingle();
    if (claimError) throw new Error(`Could not claim account-deletion request: ${claimError.message}`);
    if (!claimed) {
      results.push({ requestId: candidate.id, status: 'skipped' });
      continue;
    }

    try {
      await recordDeletionAudit(admin, candidate.id, 'processing_started');
      if (!candidate.anonymized_at) {
        await removeAvatarFiles(candidate.profile_id);
        const { error: deviceError } = await admin
          .from('mobile_device_registrations')
          .delete()
          .eq('profile_id', candidate.profile_id);
        if (deviceError) throw deviceError;

        const anonymizedAt = new Date().toISOString();
        const { error: profileUpdateError } = await admin
          .from('profiles')
          .update({
            email: `deleted-${candidate.id}@deleted.invalid`,
            full_name: 'Former user',
            phone: null,
            avatar_url: '',
            notification_preferences: {},
            time_zone: null,
            updated_at: anonymizedAt,
          })
          .eq('id', candidate.profile_id);
        if (profileUpdateError) throw profileUpdateError;
        const { error: stageError } = await admin
          .from('account_deletion_requests')
          .update({ anonymized_at: anonymizedAt, updated_at: anonymizedAt })
          .eq('id', candidate.id);
        if (stageError) throw stageError;
        await recordDeletionAudit(
          admin,
          candidate.id,
          'profile_anonymized',
          { label: 'Former user' },
          true,
        );
      }

      if (!candidate.identity_deleted_at) {
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(candidate.profile_id, true);
        if (authDeleteError && !isMissingAuthUser(authDeleteError.message)) throw authDeleteError;
        const identityDeletedAt = new Date().toISOString();
        const { error: stageError } = await admin
          .from('account_deletion_requests')
          .update({ identity_deleted_at: identityDeletedAt, updated_at: identityDeletedAt })
          .eq('id', candidate.id);
        if (stageError) throw stageError;
        await recordDeletionAudit(admin, candidate.id, 'identity_deleted', {}, true);
      }

      if (!candidate.completion_recipient) throw new Error('Completion recipient is missing');
      if (!candidate.completion_email_sent_at) {
        await sendCompletionEmail(candidate.completion_recipient, candidate.id);
        const emailSentAt = new Date().toISOString();
        const { error: stageError } = await admin
          .from('account_deletion_requests')
          .update({ completion_email_sent_at: emailSentAt, updated_at: emailSentAt })
          .eq('id', candidate.id);
        if (stageError) throw stageError;
        await recordDeletionAudit(admin, candidate.id, 'completion_email_sent', {}, true);
      }
      const completedAt = new Date().toISOString();
      await recordDeletionAudit(
        admin,
        candidate.id,
        'completed',
        { completion_email_sent: true },
        true,
      );
      const { error: completionError } = await admin
        .from('account_deletion_requests')
        .update({
          status: 'completed',
          completed_at: completedAt,
          updated_at: completedAt,
          result_code: 'completed',
          completion_recipient: null,
        })
        .eq('id', candidate.id);
      if (completionError) throw completionError;
      results.push({ requestId: candidate.id, status: 'completed', emailSent: true });
    } catch (finalizationError) {
      // Provider/storage errors can contain identifiers. Keep operational details in
      // protected runtime logs and persist only a stable, non-PII retry code.
      console.error('[account-deletion] Finalization failed', {
        requestId: candidate.id,
        error: finalizationError instanceof Error ? finalizationError.name : 'unknown',
      });
      const code = 'retryable_finalization_failure';
      await admin.from('account_deletion_requests').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
        result_code: code,
      }).eq('id', candidate.id);
      await admin.from('account_deletion_audit').insert({
        request_id: candidate.id,
        event_code: 'failed',
        actor: 'system',
        metadata: { code },
      });
      results.push({ requestId: candidate.id, status: 'failed' });
    }
  }
  return results;
}
