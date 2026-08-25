import type { MobilePushRegistration } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

function validRegistration(value: unknown): value is MobilePushRegistration {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MobilePushRegistration>;
  return typeof item.expoPushToken === 'string'
    && item.expoPushToken.startsWith('ExponentPushToken[')
    && (item.platform === 'ios' || item.platform === 'android')
    && ['development', 'staging', 'production'].includes(item.appProfile ?? '')
    && (item.deviceName === null || typeof item.deviceName === 'string');
}

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const body: unknown = await request.json().catch(() => null);
  if (!validRegistration(body)) return mobileJson({ error: 'Invalid mobile device registration' }, 400);

  const { error } = await context.supabase.from('mobile_device_registrations').upsert({
    profile_id: context.user.id,
    expo_push_token: body.expoPushToken,
    platform: body.platform,
    app_profile: body.appProfile,
    device_name: body.deviceName?.slice(0, 120) || null,
    updated_at: new Date().toISOString(),
    disabled_at: null,
  }, { onConflict: 'profile_id,expo_push_token,app_profile' });
  if (error) return mobileJson({ error: 'Could not register this device for notifications' }, 500);
  return mobileJson({ registered: true });
}
