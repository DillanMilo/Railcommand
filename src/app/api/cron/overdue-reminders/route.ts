import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createInAppNotification, getDemoProjectIds } from '@/lib/notifications';
import type { OverdueReminderPayload } from '@/lib/notifications';

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
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: overdueRfis, error: rfiError }, { data: overdueSubmittals, error: submittalError }] =
      await Promise.all([
        supabase
          .from('rfis')
          .select('id, number, subject, due_date, assigned_to, project_id, projects(name)')
          .in('status', ['open', 'overdue'])
          .lt('due_date', today)
          .not('assigned_to', 'is', null),
        supabase
          .from('submittals')
          .select('id, number, title, due_date, submitted_by, project_id, projects(name)')
          .in('status', ['submitted', 'under_review'])
          .lt('due_date', today)
          .not('submitted_by', 'is', null),
      ]);

    if (rfiError) {
      console.error('[cron/overdue-reminders] RFI query failed:', rfiError);
      return NextResponse.json({ error: 'RFI query failed' }, { status: 500 });
    }
    if (submittalError) {
      console.error('[cron/overdue-reminders] Submittal query failed:', submittalError);
      return NextResponse.json({ error: 'Submittal query failed' }, { status: 500 });
    }

    const projectIds = Array.from(new Set([
      ...(overdueRfis ?? []).map((item) => item.project_id),
      ...(overdueSubmittals ?? []).map((item) => item.project_id),
    ]));
    const demoProjectIds = await getDemoProjectIds(supabase, projectIds);
    const todayDate = new Date(today);
    type OverdueGroup = {
      userId: string;
      projectId: string;
      projectName: string;
      items: OverdueReminderPayload['items'];
    };

    const groups = new Map<string, OverdueGroup>();

    for (const rfi of overdueRfis ?? []) {
      if (demoProjectIds.has(rfi.project_id) || !rfi.assigned_to) continue;
      const key = `${rfi.assigned_to}:${rfi.project_id}`;
      const project = rfi.projects as unknown as { name: string } | null;
      const group: OverdueGroup = groups.get(key) ?? {
        userId: rfi.assigned_to,
        projectId: rfi.project_id,
        projectName: project?.name ?? 'Unknown Project',
        items: [],
      };
      group.items.push({
        kind: 'rfi',
        number: rfi.number,
        title: rfi.subject,
        dueDate: rfi.due_date,
        daysOverdue: Math.floor((todayDate.getTime() - new Date(rfi.due_date).getTime()) / 86_400_000),
        id: rfi.id,
      });
      groups.set(key, group);
    }

    for (const submittal of overdueSubmittals ?? []) {
      if (demoProjectIds.has(submittal.project_id) || !submittal.submitted_by) continue;
      const key = `${submittal.submitted_by}:${submittal.project_id}`;
      const project = submittal.projects as unknown as { name: string } | null;
      const group: OverdueGroup = groups.get(key) ?? {
        userId: submittal.submitted_by,
        projectId: submittal.project_id,
        projectName: project?.name ?? 'Unknown Project',
        items: [],
      };
      group.items.push({
        kind: 'submittal',
        number: submittal.number,
        title: submittal.title,
        dueDate: submittal.due_date,
        daysOverdue: Math.floor((todayDate.getTime() - new Date(submittal.due_date).getTime()) / 86_400_000),
        id: submittal.id,
      });
      groups.set(key, group);
    }

    const tasks = Array.from(groups.values()).map((group) => async () => {
      const payload: OverdueReminderPayload = {
        type: 'overdue_reminder',
        recipientEmail: '',
        recipientName: '',
        items: group.items,
        projectName: group.projectName,
        projectId: group.projectId,
      };
      return createInAppNotification(group.userId, payload);
    });

    let alertsCreated = 0;
    for (const batch of chunk(tasks, 10)) {
      const created = await Promise.all(batch.map((task) => task()));
      alertsCreated += created.filter(Boolean).length;
    }

    return NextResponse.json({
      success: true,
      delivery: 'in_app_only',
      overdueRfis: overdueRfis?.length ?? 0,
      overdueSubmittals: overdueSubmittals?.length ?? 0,
      alertsCreated,
      skippedDemoProjects: demoProjectIds.size,
    });
  } catch (error) {
    console.error('[cron/overdue-reminders] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
