import { createAdminClient } from '@/lib/supabase/admin';

export type EmailEventStatus = 'sent' | 'failed' | 'suppressed' | 'skipped';

type RecordEmailEventInput = {
  type: string;
  recipientEmail?: string | null;
  recipientCount?: number;
  subject?: string | null;
  providerMessageId?: string | null;
  status: EmailEventStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordEmailEvent(input: RecordEmailEventInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('email_events').insert({
      type: input.type || 'unknown',
      recipient_email: input.recipientEmail ?? null,
      recipient_count: Math.max(1, input.recipientCount ?? 1),
      subject: input.subject ?? null,
      provider: 'resend',
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.warn('[email-events] Could not record email event:', error.message);
    }
  } catch (err) {
    console.warn(
      '[email-events] Could not record email event:',
      err instanceof Error ? err.message : err,
    );
  }
}
