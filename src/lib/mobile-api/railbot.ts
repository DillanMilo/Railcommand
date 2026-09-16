import { createHash } from 'node:crypto';
import { authenticateMobileRequest, mobileJson } from './auth';
import { checkProjectMembership, checkPermission } from '@/lib/actions/permissions-helper';
import { ACTIONS } from '@/lib/permissions';

export const railbotWrites = {
  create_rfi: { action: ACTIONS.RFI_CREATE, table: 'rfis', owner: 'submitted_by' },
  create_punch_list_item: { action: ACTIONS.PUNCH_LIST_CREATE, table: 'punch_list_items', owner: 'created_by' },
  create_daily_log: { action: ACTIONS.DAILY_LOG_CREATE, table: 'daily_logs', owner: 'created_by' },
} as const;
export function railbotCreationId(conversationId: string, toolId: string): string {
  const h = createHash('sha256').update(`railbot:${conversationId}:${toolId}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export async function railbotAccess(request: Request, projectId: string | null) {
  const auth = await authenticateMobileRequest(request);
  if (!auth) return { response: mobileJson({ error: 'Not authenticated' }, 401) } as const;
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return { response: mobileJson({ error: 'Choose a project.' }, 400) } as const;
  const access = await checkProjectMembership(auth.supabase, auth.user.id, projectId);
  if (!access.isMember) return { response: mobileJson({ error: 'Project access denied.' }, 403) } as const;
  // RLS also verifies the project remains visible, including organization scope.
  const { data } = await auth.supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
  if (!data) return { response: mobileJson({ error: 'Project access denied.' }, 403) } as const;
  return { auth, projectId } as const;
}
export { checkPermission };
