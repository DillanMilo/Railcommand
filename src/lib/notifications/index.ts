// src/lib/notifications/index.ts
// Barrel export for the notifications module

export { getUserProfile, getProjectName } from './send';
export { createInAppNotification, createInAppNotificationToUser } from './in-app';
export { getDemoProjectIds, shouldSuppressNotificationEmail } from './filters';
export { renderNotificationEmail } from './templates';
export type {
  NotificationType,
  NotificationPreferences,
  NotificationPayload,
  SubmittalStatusChangedPayload,
  RFIAssignedPayload,
  RFIResponseReceivedPayload,
  PunchListAssignedPayload,
  PunchListStatusChangedPayload,
  OverdueReminderPayload,
  TeamUpdatePayload,
} from './types';
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_KEYS,
  normalizeNotificationPreferences,
} from './types';
