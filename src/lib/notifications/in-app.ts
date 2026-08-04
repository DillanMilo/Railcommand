import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationPayload } from './types';
import { normalizeNotificationPreferences } from './types';

type InAppNotificationContent = {
  title: string;
  body: string;
  href: string;
  projectId: string;
  entityType: string;
  entityId: string | null;
};

function buildContent(payload: NotificationPayload): InAppNotificationContent {
  switch (payload.type) {
    case 'submittal_status_changed':
      return {
        title: `${payload.submittalNumber} status changed`,
        body: `${payload.reviewerName} changed “${payload.submittalTitle}” to ${payload.newStatus.replace(/_/g, ' ')}.`,
        href: `/projects/${payload.projectId}/submittals/${payload.submittalId}`,
        projectId: payload.projectId,
        entityType: 'submittal',
        entityId: payload.submittalId,
      };
    case 'rfi_assigned':
      return {
        title: `${payload.rfiNumber} assigned to you`,
        body: `${payload.submitterName} assigned “${payload.rfiSubject}” to you in ${payload.projectName}.`,
        href: `/projects/${payload.projectId}/rfis/${payload.rfiId}`,
        projectId: payload.projectId,
        entityType: 'rfi',
        entityId: payload.rfiId,
      };
    case 'rfi_response_received':
      return {
        title: `${payload.isOfficial ? 'Official response' : 'New response'} on ${payload.rfiNumber}`,
        body: `${payload.responderName} responded to “${payload.rfiSubject}”.`,
        href: `/projects/${payload.projectId}/rfis/${payload.rfiId}`,
        projectId: payload.projectId,
        entityType: 'rfi',
        entityId: payload.rfiId,
      };
    case 'punch_list_assigned':
      return {
        title: `${payload.itemNumber} assigned to you`,
        body: `${payload.creatorName} assigned “${payload.itemTitle}” to you in ${payload.projectName}.`,
        href: `/projects/${payload.projectId}/punch-list/${payload.itemId}`,
        projectId: payload.projectId,
        entityType: 'punch_list',
        entityId: payload.itemId,
      };
    case 'punch_list_status_changed':
      return {
        title: `${payload.itemNumber} status changed`,
        body: `${payload.changedByName} changed “${payload.itemTitle}” to ${payload.newStatus.replace(/_/g, ' ')}.`,
        href: `/projects/${payload.projectId}/punch-list/${payload.itemId}`,
        projectId: payload.projectId,
        entityType: 'punch_list',
        entityId: payload.itemId,
      };
    case 'overdue_reminder': {
      const firstItem = payload.items[0];
      const href = firstItem
        ? `/projects/${payload.projectId}/${firstItem.kind === 'rfi' ? 'rfis' : 'submittals'}/${firstItem.id}`
        : `/projects/${payload.projectId}`;
      return {
        title: `${payload.items.length} overdue ${payload.items.length === 1 ? 'item' : 'items'} need attention`,
        body: `Review overdue RFIs and submittals in ${payload.projectName}.`,
        href,
        projectId: payload.projectId,
        entityType: 'project',
        entityId: payload.projectId,
      };
    }
    case 'team_update': {
      const action = payload.action === 'added'
        ? `was added as ${payload.memberRole.replace(/_/g, ' ')}`
        : payload.action === 'removed'
          ? 'was removed from the project'
          : 'left the project';
      return {
        title: `Team update — ${payload.projectName}`,
        body: `${payload.memberName} ${action}.`,
        href: `/projects/${payload.projectId}/team`,
        projectId: payload.projectId,
        entityType: 'project',
        entityId: payload.projectId,
      };
    }
  }
}

function getDedupeKey(recipientUserId: string, payload: NotificationPayload): string {
  const event = {
    ...payload,
    recipientEmail: undefined,
    recipientName: undefined,
  };
  const dayBucket = new Date().toISOString().slice(0, 10);
  return createHash('sha256')
    .update(`${recipientUserId}:${dayBucket}:${JSON.stringify(event)}`)
    .digest('hex');
}

export async function createInAppNotification(
  recipientUserId: string,
  payload: NotificationPayload,
): Promise<boolean> {
  try {
    if (!recipientUserId) return false;

    const admin = createAdminClient();
    const { data: recipient, error: recipientError } = await admin
      .from('profiles')
      .select('notification_preferences')
      .eq('id', recipientUserId)
      .maybeSingle();

    if (recipientError || !recipient) {
      console.warn('[in-app-notifications] Recipient profile not found');
      return false;
    }

    const preferences = normalizeNotificationPreferences(
      recipient.notification_preferences,
    );
    if (!preferences[payload.type]) return false;

    const content = buildContent(payload);
    const { data, error } = await admin
      .from('user_notifications')
      .upsert({
        recipient_id: recipientUserId,
        project_id: content.projectId,
        type: payload.type,
        title: content.title.slice(0, 200),
        body: content.body.slice(0, 2000),
        href: content.href,
        entity_type: content.entityType,
        entity_id: content.entityId,
        dedupe_key: getDedupeKey(recipientUserId, payload),
      }, {
        onConflict: 'recipient_id,dedupe_key',
        ignoreDuplicates: true,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[in-app-notifications] Insert failed:', error.message);
      return false;
    }

    return Boolean(data?.id);
  } catch (error) {
    console.error(
      '[in-app-notifications] Unexpected failure:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export async function createInAppNotificationToUser(
  recipientUserId: string,
  buildPayload: (recipient: { email: string; name: string }) => NotificationPayload,
): Promise<boolean> {
  return createInAppNotification(
    recipientUserId,
    buildPayload({ email: '', name: '' }),
  );
}
