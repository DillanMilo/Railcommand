import { railbotAccess } from '@/lib/mobile-api/railbot';
import { mobileJson } from '@/lib/mobile-api/auth';
import { confirmRailbotProposal } from '@/lib/mobile-api/railbot-confirm';
export async function POST(request: Request) {
  try {
    const { projectId, conversationId, toolId, confirmed } = await request.json();
    if (confirmed !== true || typeof conversationId !== 'string' || typeof toolId !== 'string') return mobileJson({ error: 'Explicit confirmation required.' }, 400);
    const access = await railbotAccess(request, projectId);
    if (access.response) return access.response;
    return await confirmRailbotProposal(access.auth, projectId, conversationId, toolId);
  } catch { return mobileJson({ error: 'Unable to confirm. Your proposal is retained; check history before retrying.' }, 500); }
}
