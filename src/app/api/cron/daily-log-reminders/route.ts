// src/app/api/cron/daily-log-reminders/route.ts
//
// Cron-callable endpoint that sends daily log filing reminders
// to project members who haven't filed a log today.
// Intended to be called once per day (late afternoon) via Vercel Cron.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/notifications';
import type { DailyLogReminderPayload } from '@/lib/notifications';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];
    const todayFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Get all active projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active');

    if (!projects?.length) {
      return NextResponse.json({ success: true, emailsSent: 0 });
    }

    let sent = 0;

    for (const project of projects) {
      // Get members with edit permissions (typically the ones filing logs)
      const { data: members } = await supabase
        .from('project_members')
        .select('profile_id')
        .eq('project_id', project.id)
        .eq('can_edit', true);

      if (!members?.length) continue;

      const memberIds = members.map((m) => m.profile_id);

      // Check which members already filed a log today
      const { data: existingLogs } = await supabase
        .from('daily_logs')
        .select('created_by')
        .eq('project_id', project.id)
        .eq('log_date', today);

      const filedUserIds = new Set((existingLogs ?? []).map((l) => l.created_by));
      const needsReminder = memberIds.filter((id) => !filedUserIds.has(id));

      for (const userId of needsReminder) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single();

        if (!profile?.email) continue;

        const payload: DailyLogReminderPayload = {
          type: 'daily_log_reminder',
          recipientEmail: profile.email,
          recipientName: profile.full_name ?? 'Team Member',
          date: todayFormatted,
          projectName: project.name,
          projectId: project.id,
        };

        await sendNotification(userId, payload);
        sent++;
      }
    }

    return NextResponse.json({ success: true, emailsSent: sent });
  } catch (err) {
    console.error('[cron/daily-log-reminders] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
