import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { availableMobileRelease } from '@/lib/mobile-api/app-release';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function GET(request: Request) {
  try {
    if (!await authenticateMobileRequest(request)) return mobileJson({ error: 'Not authenticated' }, 401);
    return mobileJson(availableMobileRelease);
  } catch {
    return mobileJson({ error: 'Update check unavailable' }, 503);
  }
}
