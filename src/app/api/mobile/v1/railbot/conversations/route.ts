import { NextRequest } from 'next/server';
import { railbotAccess } from '@/lib/mobile-api/railbot';
import { mobileJson } from '@/lib/mobile-api/auth';
export async function GET(request: NextRequest) {
  const access = await railbotAccess(request, request.nextUrl.searchParams.get('projectId'));
  if (access.response) return access.response;
  const { data, error } = await access.auth.supabase.from('conversations')
    .select('id,title,updated_at').eq('project_id', access.projectId).eq('user_id', access.auth.user.id)
    .order('updated_at', { ascending: false }).limit(100);
  return error ? mobileJson({ error: 'Unable to load history.' }, 500) : mobileJson(data ?? []);
}
