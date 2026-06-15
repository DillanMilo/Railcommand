import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const DEMO_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const ONBOARDED_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

type DemoLogin = {
  email: string;
  password: string;
};

async function getDemoLogin(slug: string, email: string): Promise<DemoLogin | null> {
  const admin = createAdminClient();

  const { data: demo, error } = await admin
    .from('demo_accounts')
    .select('id, demo_user_id, demo_password, is_active, expires_at')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !demo) return null;
  if (demo.expires_at && new Date(demo.expires_at) < new Date()) return null;

  if (demo.demo_user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', demo.demo_user_id)
      .single();

    if (profile?.email?.toLowerCase() === email) {
      return { email: profile.email, password: demo.demo_password };
    }
  }

  const { data: teamLogin } = await admin
    .from('demo_team_logins')
    .select('email, demo_password')
    .eq('demo_account_id', demo.id)
    .eq('email', email)
    .maybeSingle();

  if (!teamLogin) return null;
  return { email: teamLogin.email, password: teamLogin.demo_password };
}

/**
 * POST /api/admin/demo/session
 * Public route used by /demo/[slug]. It reads demo credentials server-side,
 * signs in with Supabase, and sets the same cookies the client previously set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { slug?: string; email?: string };
    const slug = body.slug?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!slug || !email) {
      return NextResponse.json({ error: 'Missing slug or email' }, { status: 400 });
    }

    const login = await getDemoLogin(slug, email);
    if (!login) {
      return NextResponse.json({ error: 'Demo login not found' }, { status: 404 });
    }

    const supabase = await createClient();
    await supabase.auth.signOut();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: login.email,
      password: login.password,
    });

    if (signInError) {
      console.error('[api/admin/demo/session] Sign-in failed:', signInError);
      return NextResponse.json({ error: 'Demo login failed' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set('rc-remember', 'true', {
      path: '/',
      maxAge: DEMO_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    response.cookies.set('rc-onboarded', 'true', {
      path: '/',
      maxAge: ONBOARDED_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    response.cookies.set('rc-demo-slug', slug, {
      path: '/',
      maxAge: DEMO_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });

    return response;
  } catch (err) {
    console.error('[api/admin/demo/session] Error:', err);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
