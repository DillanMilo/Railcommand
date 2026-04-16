import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/admin/demo/track?slug=xxx
 * Tracks demo access (bumps counter + last_accessed_at).
 */
export async function POST(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get current access count
  const { data: demo } = await admin
    .from('demo_accounts')
    .select('id, access_count')
    .eq('slug', slug)
    .single();

  if (!demo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Update
  await admin
    .from('demo_accounts')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (demo.access_count ?? 0) + 1,
    })
    .eq('id', demo.id);

  return NextResponse.json({ ok: true });
}
