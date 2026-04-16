import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/demo/lookup?slug=xxx
 * Public route — returns demo info needed for the /demo/[slug] entry page.
 * Does NOT return sensitive data beyond what's needed for auto-login.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up demo account
  const { data: demo, error } = await admin
    .from('demo_accounts')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !demo) {
    return NextResponse.json({ error: 'Demo not found' }, { status: 404 });
  }

  // Check expiration
  if (demo.expires_at && new Date(demo.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Demo expired' }, { status: 410 });
  }

  // Get primary user email
  let primaryEmail = '';
  if (demo.demo_user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', demo.demo_user_id)
      .single();
    primaryEmail = profile?.email ?? '';
  }

  // Get team logins if team demo
  let teamLogins: any[] = [];
  if (demo.is_team_demo) {
    const { data: logins } = await admin
      .from('demo_team_logins')
      .select('display_name, email, project_role, demo_password')
      .eq('demo_account_id', demo.id)
      .order('created_at');
    teamLogins = logins ?? [];
  }

  return NextResponse.json({
    slug: demo.slug,
    company_name: demo.company_name,
    is_team_demo: demo.is_team_demo,
    project_id: demo.project_id,
    demo_user_email: primaryEmail,
    demo_password: demo.demo_password,
    team_logins: teamLogins,
  });
}
