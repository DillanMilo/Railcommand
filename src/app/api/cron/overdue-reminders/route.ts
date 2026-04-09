// src/app/api/cron/overdue-reminders/route.ts
//
// Cron-callable endpoint that checks for overdue RFIs and submittals
// and sends reminder emails to the responsible users.
// Intended to be called daily via Vercel Cron or an external scheduler.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/notifications';
import type { OverdueReminderPayload } from '@/lib/notifications';

export const maxDuration = 60; // allow up to 60s for this cron

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];

    // Find overdue RFIs (open/in_progress with due_date < today)
    const { data: overdueRfis } = await supabase
      .from('rfis')
      .select('id, rfi_number, subject, due_date, assigned_to, project_id, projects(name)')
      .in('status', ['open', 'in_progress'])
      .lt('due_date', today)
      .not('assigned_to', 'is', null);

    // Find overdue submittals (pending/under_review with due_date < today)
    const { data: overdueSubmittals } = await supabase
      .from('submittals')
      .select('id, submittal_number, title, due_date, submitted_by, project_id, projects(name)')
      .in('status', ['pending', 'under_review'])
      .lt('due_date', today)
      .not('submitted_by', 'is', null);

    // Group overdue items by user+project
    const userProjectMap = new Map<string, {
      userId: string;
      projectId: string;
      projectName: string;
      items: OverdueReminderPayload['items'];
    }>();

    const todayDate = new Date(today);

    for (const rfi of overdueRfis ?? []) {
      const key = `${rfi.assigned_to}:${rfi.project_id}`;
      const dueDate = new Date(rfi.due_date);
      const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const projectData = rfi.projects as unknown as { name: string } | null;

      if (!userProjectMap.has(key)) {
        userProjectMap.set(key, {
          userId: rfi.assigned_to,
          projectId: rfi.project_id,
          projectName: projectData?.name ?? 'Unknown Project',
          items: [],
        });
      }
      userProjectMap.get(key)!.items.push({
        kind: 'rfi',
        number: rfi.rfi_number,
        title: rfi.subject,
        dueDate: rfi.due_date,
        daysOverdue,
        id: rfi.id,
      });
    }

    for (const sub of overdueSubmittals ?? []) {
      const key = `${sub.submitted_by}:${sub.project_id}`;
      const dueDate = new Date(sub.due_date);
      const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const projectData = sub.projects as unknown as { name: string } | null;

      if (!userProjectMap.has(key)) {
        userProjectMap.set(key, {
          userId: sub.submitted_by,
          projectId: sub.project_id,
          projectName: projectData?.name ?? 'Unknown Project',
          items: [],
        });
      }
      userProjectMap.get(key)!.items.push({
        kind: 'submittal',
        number: sub.submittal_number,
        title: sub.title,
        dueDate: sub.due_date,
        daysOverdue,
        id: sub.id,
      });
    }

    // Send a single digest email per user per project
    let sent = 0;
    for (const [, entry] of userProjectMap) {
      // Look up user profile for email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', entry.userId)
        .single();

      if (!profile?.email) continue;

      const payload: OverdueReminderPayload = {
        type: 'overdue_reminder',
        recipientEmail: profile.email,
        recipientName: profile.full_name ?? 'Team Member',
        items: entry.items,
        projectName: entry.projectName,
        projectId: entry.projectId,
      };

      await sendNotification(entry.userId, payload);
      sent++;
    }

    return NextResponse.json({
      success: true,
      overdueRfis: overdueRfis?.length ?? 0,
      overdueSubmittals: overdueSubmittals?.length ?? 0,
      emailsSent: sent,
    });
  } catch (err) {
    console.error('[cron/overdue-reminders] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
