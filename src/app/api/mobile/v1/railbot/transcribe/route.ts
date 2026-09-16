import { railbotAccess } from '@/lib/mobile-api/railbot';
import { mobileJson } from '@/lib/mobile-api/auth';
import { getOpenAIClient } from '@/lib/openai/client';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const access = await railbotAccess(request, new URL(request.url).searchParams.get('projectId'));
    if (access.response) return access.response;
    const data = await request.formData();
    const audio = data.get('audio');
    if (!(audio instanceof File) || audio.size === 0 || audio.size > 25 * 1024 * 1024) return mobileJson({ error: 'Recording must be smaller than 25 MB.' }, 400);
    const text = await getOpenAIClient().audio.transcriptions.create({ file: audio, model: 'whisper-1', response_format: 'text' });
    return mobileJson({ text });
  } catch { return mobileJson({ error: 'Unable to transcribe. Your recording is still on this device.' }, 502); }
}
