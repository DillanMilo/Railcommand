'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { seedDemo } from './seeder';
import { DEMO_PRESETS } from './types';
import type { DemoAccount } from './types';

/**
 * Completely reset a demo account: wipe all data, re-seed from scratch.
 * Preserves the demo slug and credentials structure.
 */
export async function resetDemo(slug: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  // 1. Find the demo account
  const { data: demo, error: findErr } = await admin
    .from('demo_accounts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (findErr || !demo) {
    return { success: false, error: `Demo "${slug}" not found` };
  }

  const demoAccount = demo as DemoAccount;

  // 2. Delete all project data (cascade handles most of it)
  if (demoAccount.project_id) {
    // Delete entities that reference the project
    const tables = [
      'submittals', 'rfis', 'daily_logs', 'punch_list_items',
      'safety_incidents', 'change_orders', 'qcqa_reports',
      'project_documents', 'weekly_reports', 'modifications',
      'milestones', 'attachments', 'activity_log',
      'project_members', 'project_invitations',
    ];

    for (const table of tables) {
      await admin.from(table).delete().eq('project_id', demoAccount.project_id);
    }

    // Delete the project itself
    await admin.from('projects').delete().eq('id', demoAccount.project_id);
  }

  // 3. Delete team login records
  await admin.from('demo_team_logins').delete().eq('demo_account_id', demoAccount.id);

  // 4. Delete auth users associated with this demo
  // Get all profiles in this org
  if (demoAccount.organization_id) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', demoAccount.organization_id);

    if (profiles) {
      for (const p of profiles) {
        await admin.auth.admin.deleteUser(p.id);
      }
    }

    // Delete the organization (cascade deletes profiles)
    await admin.from('organizations').delete().eq('id', demoAccount.organization_id);
  }

  // 5. Delete the demo_accounts record
  await admin.from('demo_accounts').delete().eq('id', demoAccount.id);

  // 6. Re-seed using the preset (if one exists) or return success
  const preset = DEMO_PRESETS[slug];
  if (preset) {
    const result = await seedDemo(preset);
    if (result.error) {
      return { success: false, error: `Wipe succeeded but re-seed failed: ${result.error}` };
    }
  }

  return { success: true };
}

/**
 * Deactivate a demo without deleting data.
 */
export async function deactivateDemo(slug: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('demo_accounts')
    .update({ is_active: false })
    .eq('slug', slug);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Reactivate a previously deactivated demo.
 */
export async function reactivateDemo(slug: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('demo_accounts')
    .update({ is_active: true })
    .eq('slug', slug);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Delete a demo permanently (wipe data + remove account record).
 */
export async function deleteDemo(slug: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: demo } = await admin
    .from('demo_accounts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!demo) return { success: false, error: `Demo "${slug}" not found` };

  const demoAccount = demo as DemoAccount;

  // Delete team logins
  await admin.from('demo_team_logins').delete().eq('demo_account_id', demoAccount.id);

  // Delete project data
  if (demoAccount.project_id) {
    await admin.from('projects').delete().eq('id', demoAccount.project_id);
  }

  // Delete auth users and org
  if (demoAccount.organization_id) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', demoAccount.organization_id);

    if (profiles) {
      for (const p of profiles) {
        await admin.auth.admin.deleteUser(p.id);
      }
    }

    await admin.from('organizations').delete().eq('id', demoAccount.organization_id);
  }

  // Delete the demo account record
  await admin.from('demo_accounts').delete().eq('id', demoAccount.id);

  return { success: true };
}
