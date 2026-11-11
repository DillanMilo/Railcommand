import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { mobileReleaseForUser } from '@/lib/mobile-api/app-release';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function GET(request: Request) {
  try {
    const context = await authenticateMobileRequest(request);
    if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
    return mobileJson(mobileReleaseForUser(context.user.id));
  } catch {
    return mobileJson({ error: 'Update check unavailable' }, 503);
  }
}
