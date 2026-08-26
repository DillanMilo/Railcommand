import { cancelAccountDeletion } from '@/lib/account-deletion';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await request.json().catch(() => null) as { requestId?: string } | null;
  if (!body?.requestId || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    return Response.json({ error: 'Invalid deletion request identifier' }, { status: 400 });
  }
  try {
    return Response.json(await cancelAccountDeletion(supabase, body.requestId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not cancel the account deletion request';
    return Response.json({ error: message }, { status: message.includes('password') ? 401 : 409 });
  }
}
