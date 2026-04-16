import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { seedDemo } from '@/lib/demo/seeder';
import { DEMO_PRESETS } from '@/lib/demo/types';
import type { DemoPreset } from '@/lib/demo/types';

/**
 * POST /api/admin/demo/create
 * Create a new demo account. Requires admin role.
 * Body: { preset: string } (key from DEMO_PRESETS) or { custom: DemoPreset }
 */
export async function POST(request: NextRequest) {
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
  let preset: DemoPreset;

  if (body.preset && DEMO_PRESETS[body.preset]) {
    preset = DEMO_PRESETS[body.preset];
  } else if (body.custom) {
    preset = body.custom as DemoPreset;
  } else {
    return NextResponse.json({ error: 'Provide a preset name or custom preset config' }, { status: 400 });
  }

  // Check if slug already exists
  const { data: existing } = await admin
    .from('demo_accounts')
    .select('id')
    .eq('slug', preset.slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: `Demo with slug "${preset.slug}" already exists` }, { status: 409 });
  }

  // Seed the demo
  const result = await seedDemo(preset);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ id: result.id, slug: preset.slug }, { status: 201 });
}
