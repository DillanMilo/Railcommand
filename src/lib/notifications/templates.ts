// src/lib/notifications/templates.ts

import type {
  NotificationPayload,
  SubmittalStatusChangedPayload,
  RFIAssignedPayload,
  RFIResponseReceivedPayload,
  PunchListAssignedPayload,
  PunchListStatusChangedPayload,
} from './types';

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------
function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RailCommand Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e293b;padding:20px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.025em;">
                RailCommand
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                This is an automated notification from RailCommand. You can manage your notification preferences in your account settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
function statusBadge(status: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    approved: { bg: '#dcfce7', text: '#166534' },
    rejected: { bg: '#fee2e2', text: '#991b1b' },
    conditional: { bg: '#fef9c3', text: '#854d0e' },
    verified: { bg: '#dcfce7', text: '#166534' },
    resolved: { bg: '#dbeafe', text: '#1e40af' },
    open: { bg: '#fef9c3', text: '#854d0e' },
    in_progress: { bg: '#dbeafe', text: '#1e40af' },
    critical: { bg: '#fee2e2', text: '#991b1b' },
    high: { bg: '#ffedd5', text: '#9a3412' },
    medium: { bg: '#fef9c3', text: '#854d0e' },
    low: { bg: '#f0fdf4', text: '#166534' },
  };
  const c = colors[status] ?? { bg: '#f1f5f9', text: '#475569' };
  const label = status.replace(/_/g, ' ').toUpperCase();
  return `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;background-color:${c.bg};color:${c.text};font-size:12px;font-weight:600;letter-spacing:0.025em;">${label}</span>`;
}

// ---------------------------------------------------------------------------
// Template: Submittal Status Changed
// ---------------------------------------------------------------------------
function submittalStatusChanged(payload: SubmittalStatusChangedPayload): { subject: string; html: string } {
  const subject = `[${payload.submittalNumber}] Status changed to ${payload.newStatus} - ${payload.projectName}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">Submittal Status Updated</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      ${payload.reviewerName} has updated the status of a submittal in <strong>${payload.projectName}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Submittal</p>
          <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;">${payload.submittalNumber}: ${payload.submittalTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">New Status</p>
          <p style="margin:0;">${statusBadge(payload.newStatus)}</p>
        </td>
      </tr>
      ${payload.reviewNotes ? `
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Review Notes</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.reviewNotes}</p>
        </td>
      </tr>` : ''}
    </table>

    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.railcommand.com'}/projects/${payload.projectId}/submittals/${payload.submittalId}"
       style="display:inline-block;padding:10px 20px;background-color:#1e293b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      View Submittal
    </a>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Template: RFI Assigned
// ---------------------------------------------------------------------------
function rfiAssigned(payload: RFIAssignedPayload): { subject: string; html: string } {
  const subject = `[${payload.rfiNumber}] New RFI assigned to you - ${payload.projectName}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">New RFI Assigned</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      ${payload.submitterName} has assigned you an RFI in <strong>${payload.projectName}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">RFI</p>
          <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;">${payload.rfiNumber}: ${payload.rfiSubject}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Question</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.rfiQuestion}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Priority</p>
          <p style="margin:0;">${statusBadge(payload.priority)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Due Date</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.dueDate}</p>
        </td>
      </tr>
    </table>

    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.railcommand.com'}/projects/${payload.projectId}/rfis/${payload.rfiId}"
       style="display:inline-block;padding:10px 20px;background-color:#1e293b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      View RFI
    </a>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Template: RFI Response Received
// ---------------------------------------------------------------------------
function rfiResponseReceived(payload: RFIResponseReceivedPayload): { subject: string; html: string } {
  const prefix = payload.isOfficial ? 'Official response' : 'New response';
  const subject = `[${payload.rfiNumber}] ${prefix} received - ${payload.projectName}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">${prefix} on RFI</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      ${payload.responderName} has responded to an RFI in <strong>${payload.projectName}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">RFI</p>
          <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;">${payload.rfiNumber}: ${payload.rfiSubject}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Response</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.responseContent}</p>
        </td>
      </tr>
      ${payload.isOfficial ? `
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0;">${statusBadge('approved')}</p>
          <p style="margin:4px 0 0;color:#166534;font-size:12px;">This is an official response</p>
        </td>
      </tr>` : ''}
    </table>

    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.railcommand.com'}/projects/${payload.projectId}/rfis/${payload.rfiId}"
       style="display:inline-block;padding:10px 20px;background-color:#1e293b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      View RFI
    </a>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Template: Punch List Item Assigned
// ---------------------------------------------------------------------------
function punchListAssigned(payload: PunchListAssignedPayload): { subject: string; html: string } {
  const subject = `[${payload.itemNumber}] Punch list item assigned to you - ${payload.projectName}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">Punch List Item Assigned</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      ${payload.creatorName} has assigned you a punch list item in <strong>${payload.projectName}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Item</p>
          <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;">${payload.itemNumber}: ${payload.itemTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Description</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.itemDescription}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Location</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.location}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Priority</p>
          <p style="margin:0;">${statusBadge(payload.priority)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Due Date</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.dueDate}</p>
        </td>
      </tr>
    </table>

    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.railcommand.com'}/projects/${payload.projectId}/punch-list/${payload.itemId}"
       style="display:inline-block;padding:10px 20px;background-color:#1e293b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      View Item
    </a>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Template: Punch List Status Changed
// ---------------------------------------------------------------------------
function punchListStatusChanged(payload: PunchListStatusChangedPayload): { subject: string; html: string } {
  const subject = `[${payload.itemNumber}] Status changed to ${payload.newStatus} - ${payload.projectName}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">Punch List Status Updated</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
      ${payload.changedByName} has updated a punch list item in <strong>${payload.projectName}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Item</p>
          <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;">${payload.itemNumber}: ${payload.itemTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">New Status</p>
          <p style="margin:0;">${statusBadge(payload.newStatus)}</p>
        </td>
      </tr>
      ${payload.resolutionNotes ? `
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Notes</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${payload.resolutionNotes}</p>
        </td>
      </tr>` : ''}
    </table>

    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.railcommand.com'}/projects/${payload.projectId}/punch-list/${payload.itemId}"
       style="display:inline-block;padding:10px 20px;background-color:#1e293b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      View Item
    </a>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------
export function renderNotificationEmail(payload: NotificationPayload): { subject: string; html: string } {
  switch (payload.type) {
    case 'submittal_status_changed':
      return submittalStatusChanged(payload);
    case 'rfi_assigned':
      return rfiAssigned(payload);
    case 'rfi_response_received':
      return rfiResponseReceived(payload);
    case 'punch_list_assigned':
      return punchListAssigned(payload);
    case 'punch_list_status_changed':
      return punchListStatusChanged(payload);
    default:
      throw new Error(`Unknown notification type: ${(payload as NotificationPayload).type}`);
  }
}
