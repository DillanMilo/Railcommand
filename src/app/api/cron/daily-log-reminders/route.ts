// src/app/api/cron/daily-log-reminders/route.ts
//
// Cron-callable endpoint that sends daily log filing reminders
// to project members who haven't filed a log today.
// Intended to be called once per day (late afternoon) via Vercel Cron.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoProjectIds, sendNotification, shouldSuppressNotificationEmail } from '@/lib/notifications';
import type { DailyLogReminderPayload } from '@/lib/notifications';

export const maxDuration = 60;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
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

    const demoProjectIds = await getDemoProjectIds(
      supabase,
      projects.map((project) => project.id)
    );
    const eligibleProjects = projects.filter((project) => !demoProjectIds.has(project.id));

    const reminders: {
      userId: string;
      projectId: string;
      projectName: string;
    }[] = [];

    for (const project of eligibleProjects) {
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
        reminders.push({
          userId,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }

    const userIds = Array.from(new Set(reminders.map((entry) => entry.userId)));
    const { data: profiles } = userIds.length
      ? await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
      : { data: [] };

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    let suppressedRecipients = 0;
    const tasks = reminders.flatMap((entry) => {
      const profile = profileById.get(entry.userId);
      if (!profile?.email) return [];
      if (shouldSuppressNotificationEmail(profile.email)) {
        suppressedRecipients += 1;
        return [];
      }

      const payload: DailyLogReminderPayload = {
        type: 'daily_log_reminder',
        recipientEmail: profile.email,
        recipientName: profile.full_name ?? 'Team Member',
        date: todayFormatted,
        projectName: entry.projectName,
        projectId: entry.projectId,
      };

      return [async () => {
        await sendNotification(entry.userId, payload);
        return 1;
      }];
    });

    let sent = 0;
    for (const batch of chunk(tasks, 10)) {
      const results = await Promise.all(batch.map((task) => task()));
      sent += results.reduce((sum, value) => sum + value, 0);
    }

    return NextResponse.json({
      success: true,
      emailsSent: sent,
      skippedDemoProjects: demoProjectIds.size,
      suppressedRecipients,
    });
  } catch (err) {
    console.error('[cron/daily-log-reminders] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
