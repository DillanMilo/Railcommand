// src/lib/notifications/types.ts

export type NotificationType =
  | 'submittal_status_changed'
  | 'rfi_assigned'
  | 'rfi_response_received'
  | 'punch_list_assigned'
  | 'punch_list_status_changed'
  | 'overdue_reminder'
  | 'daily_log_reminder'
  | 'team_update';

export interface NotificationPreferences {
  submittal_status_changed: boolean;
  rfi_assigned: boolean;
  rfi_response_received: boolean;
  punch_list_assigned: boolean;
  punch_list_status_changed: boolean;
  overdue_reminder: boolean;
  daily_log_reminder: boolean;
  team_update: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  submittal_status_changed: true,
  rfi_assigned: true,
  rfi_response_received: true,
  punch_list_assigned: true,
  punch_list_status_changed: true,
  overdue_reminder: true,
  daily_log_reminder: true,
  team_update: true,
};

// Payload types for each notification
export interface SubmittalStatusChangedPayload {
  type: 'submittal_status_changed';
  recipientEmail: string;
  recipientName: string;
  submittalNumber: string;
  submittalTitle: string;
  newStatus: string;
  reviewNotes?: string;
  reviewerName: string;
  projectName: string;
  projectId: string;
  submittalId: string;
}

export interface RFIAssignedPayload {
  type: 'rfi_assigned';
  recipientEmail: string;
  recipientName: string;
  rfiNumber: string;
  rfiSubject: string;
  rfiQuestion: string;
  priority: string;
  dueDate: string;
  submitterName: string;
  projectName: string;
  projectId: string;
  rfiId: string;
}

export interface RFIResponseReceivedPayload {
  type: 'rfi_response_received';
  recipientEmail: string;
  recipientName: string;
  rfiNumber: string;
  rfiSubject: string;
  responseContent: string;
  isOfficial: boolean;
  responderName: string;
  projectName: string;
  projectId: string;
  rfiId: string;
}

export interface PunchListAssignedPayload {
  type: 'punch_list_assigned';
  recipientEmail: string;
  recipientName: string;
  itemNumber: string;
  itemTitle: string;
  itemDescription: string;
  location: string;
  priority: string;
  dueDate: string;
  creatorName: string;
  projectName: string;
  projectId: string;
  itemId: string;
}

export interface PunchListStatusChangedPayload {
  type: 'punch_list_status_changed';
  recipientEmail: string;
  recipientName: string;
  itemNumber: string;
  itemTitle: string;
  newStatus: string;
  resolutionNotes?: string;
  changedByName: string;
  projectName: string;
  projectId: string;
  itemId: string;
}

export interface OverdueReminderPayload {
  type: 'overdue_reminder';
  recipientEmail: string;
  recipientName: string;
  items: {
    kind: 'rfi' | 'submittal';
    number: string;
    title: string;
    dueDate: string;
    daysOverdue: number;
    id: string;
  }[];
  projectName: string;
  projectId: string;
}

export interface DailyLogReminderPayload {
  type: 'daily_log_reminder';
  recipientEmail: string;
  recipientName: string;
  date: string;
  projectName: string;
  projectId: string;
}

export interface TeamUpdatePayload {
  type: 'team_update';
  recipientEmail: string;
  recipientName: string;
  action: 'added' | 'removed';
  memberName: string;
  memberRole: string;
  changedByName: string;
  projectName: string;
  projectId: string;
}

export type NotificationPayload =
  | SubmittalStatusChangedPayload
  | RFIAssignedPayload
  | RFIResponseReceivedPayload
  | PunchListAssignedPayload
  | PunchListStatusChangedPayload
  | OverdueReminderPayload
  | DailyLogReminderPayload
  | TeamUpdatePayload;
