import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resetDemo, deleteDemo, deactivateDemo, reactivateDemo } from '@/lib/demo/reset';

/**
 * POST /api/admin/demo/reset/[slug]
 * Reset, delete, deactivate, or reactivate a demo. Requires admin role.
 * Body: { action: 'reset' | 'delete' | 'deactivate' | 'reactivate' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action ?? 'reset';

  let result: { success: boolean; error?: string };

  switch (action) {
    case 'reset':
      result = await resetDemo(slug);
      break;
    case 'delete':
      result = await deleteDemo(slug);
      break;
    case 'deactivate':
      result = await deactivateDemo(slug);
      break;
    case 'reactivate':
      result = await reactivateDemo(slug);
      break;
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action });
}
