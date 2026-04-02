import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/chat/conversations?projectId=...
 * List conversations for the current user in a project.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // Demo mode or unauthenticated — return empty array
    return NextResponse.json({ conversations: [] });
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Conversations GET]', error);
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

/**
 * POST /api/chat/conversations
 * Create a new conversation.
 * Body: { projectId: string, title?: string }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, title, isDemo } = body as {
    projectId: string;
    title?: string;
    isDemo?: boolean;
  };

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  // Demo mode: return a fake conversation
  if (isDemo) {
    return NextResponse.json({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: 'demo',
      title: title ?? 'New Chat',
      model: null,
      message_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      project_id: projectId,
      user_id: user.id,
      title: title ?? 'New Chat',
      message_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[Conversations POST]', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }

  return NextResponse.json(data);
}
