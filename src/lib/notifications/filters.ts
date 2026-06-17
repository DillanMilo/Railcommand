import type { SupabaseClient } from '@supabase/supabase-js';

const SUPPRESSED_NOTIFICATION_DOMAINS = new Set([
  'railcommand.app',
  'demo.railcommand.app',
  'demo.railcommand.io',
]);

export function shouldSuppressNotificationEmail(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return true;

  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex === -1) return true;

  const domain = normalizedEmail.slice(atIndex + 1);
  return SUPPRESSED_NOTIFICATION_DOMAINS.has(domain);
}

export async function getDemoProjectIds(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Set<string>> {
  if (!projectIds.length) return new Set();

  const { data, error } = await supabase
    .from('demo_accounts')
    .select('project_id')
    .in('project_id', projectIds);

  if (error) {
    console.error('[notifications] Failed to load demo project filters:', error);
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((demo) => demo.project_id)
      .filter((projectId): projectId is string => Boolean(projectId))
  );
}
