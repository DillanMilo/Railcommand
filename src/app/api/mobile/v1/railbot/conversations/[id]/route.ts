import { NextRequest } from 'next/server';
import { railbotAccess } from '@/lib/mobile-api/railbot';
import { mobileJson } from '@/lib/mobile-api/auth';
async function owned(request: NextRequest, id: string) {
  const access = await railbotAccess(request, request.nextUrl.searchParams.get('projectId'));
  if (access.response) return access;
  const { data } = await access.auth.supabase.from('conversations').select('id').eq('id', id)
    .eq('project_id', access.projectId).eq('user_id', access.auth.user.id).maybeSingle();
  return data ? access : { response: mobileJson({ error: 'Conversation unavailable.' }, 404) } as const;
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await owned(request, id);
  if (access.response) return access.response;
  const { data, error } = await access.auth.supabase.from('messages').select('id,role,content,tool_calls,created_at')
    .eq('conversation_id', id).order('created_at', { ascending: true }).limit(500);
  return error ? mobileJson({ error: 'Unable to load messages.' }, 500) : mobileJson(data ?? []);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await owned(request, id);
  if (access.response) return access.response;
  const { error } = await access.auth.supabase.from('conversations').delete().eq('id', id).eq('user_id', access.auth.user.id);
  return error ? mobileJson({ error: 'Unable to delete conversation.' }, 500) : mobileJson({ success: true });
}
