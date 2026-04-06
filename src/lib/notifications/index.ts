// src/lib/notifications/index.ts
// Barrel export for the notifications module

export { sendNotification, sendNotificationToUser, getUserProfile, getProjectName } from './send';
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
  DailyLogReminderPayload,
  TeamUpdatePayload,
} from './types';
export { DEFAULT_NOTIFICATION_PREFERENCES } from './types';
