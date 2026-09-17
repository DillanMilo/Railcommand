import { cancelAccountDeletion } from '@/lib/account-deletion';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const body = await request.json().catch(() => null) as { requestId?: string } | null;
  if (!body?.requestId || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    return mobileJson({ error: 'Invalid deletion request identifier' }, 400);
  }
  try {
    return mobileJson(await cancelAccountDeletion(context.supabase, body.requestId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not cancel the account deletion request';
    return mobileJson({ error: message }, message.includes('password') ? 401 : 409);
  }
}
