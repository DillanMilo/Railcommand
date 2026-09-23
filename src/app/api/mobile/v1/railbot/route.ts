import { NextRequest } from 'next/server';
import { handleRailBotChat } from '@/lib/railbot/chat-handler';
import { railbotAccess } from '@/lib/mobile-api/railbot';
import { mobileJson } from '@/lib/mobile-api/auth';
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json();
    const access = await railbotAccess(request, body.projectId);
    if (access.response) return access.response;
    const response = await handleRailBotChat(request, access.auth);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Vary', 'Authorization');
    return response;
  } catch { return mobileJson({ error: 'Invalid chat request.' }, 400); }
}
