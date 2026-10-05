import { railbotWrites, railbotCreationId, checkPermission } from './railbot';
import { mobileJson, type MobileAuthenticatedContext } from './auth';
import { canPerform } from '@/lib/permissions';
import { executeTool } from '@/lib/railbot/tool-executor';
export async function confirmRailbotProposal(auth: MobileAuthenticatedContext, projectId: string, conversationId: string, toolId: string) {
    const { supabase, user } = auth;
    const { data: conversation } = await supabase.from('conversations').select('id')
      .eq('id', conversationId).eq('project_id', projectId).eq('user_id', user.id).maybeSingle();
    if (!conversation) return mobileJson({ error: 'Conversation unavailable.' }, 403);
    const { data: messages } = await supabase.from('messages').select('tool_calls').eq('conversation_id', conversationId)
      .eq('role', 'assistant').order('created_at', { ascending: false }).limit(50);
    const proposal = messages?.flatMap(m => Array.isArray(m.tool_calls) ? m.tool_calls : []).find(t => t.id === toolId && t.mobile_proposal === true);
    const name = proposal?.function?.name as keyof typeof railbotWrites;
    if (!Object.hasOwn(railbotWrites, name)) return mobileJson({ error: 'Saved proposal not found.' }, 400);
    const spec = railbotWrites[name];
    const permission = await checkPermission(supabase, user.id, projectId, spec.action);
    if (!permission.allowed || (permission.orgRole !== 'admin' && (!permission.canEdit || !canPerform(permission.projectRole, spec.action)))) return mobileJson({ error: 'You cannot create this record in this project.' }, 403);
    const args = JSON.parse(proposal.function.arguments);
    if (!args || typeof args !== 'object' || Array.isArray(args)) return mobileJson({ error: 'Invalid saved proposal.' }, 400);
    if (args.assigned_to && args.assigned_to !== user.id) {
      const { data: assignee } = await supabase.from('project_members').select('id').eq('project_id', projectId).eq('profile_id', args.assigned_to).maybeSingle();
      if (!assignee) return mobileJson({ error: 'The proposed assignee is not a current project member.' }, 400);
    }
    const id = railbotCreationId(conversationId, toolId);
    const existing = async () => supabase.from(spec.table).select('id').eq('id', id).eq('project_id', projectId).eq(spec.owner, user.id).maybeSingle();
    if ((await existing()).data) return mobileJson({ success: true, id });
    const result = await executeTool(name, args, permission.orgRole === 'admin' ? 'manager' : permission.projectRole!, projectId, user.id, supabase, id);
    // A concurrent retry can lose the primary-key race; read the original receipt.
    if (!result.success && !(await existing()).data) return mobileJson({ error: result.error ?? 'Record creation failed.' }, 400);
    return mobileJson({ success: true, id });
}
