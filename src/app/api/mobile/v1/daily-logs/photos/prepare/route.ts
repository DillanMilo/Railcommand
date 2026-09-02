import type { MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { authorizeMobilePhotoOperation } from '@/lib/mobile-api/photo-sync';
import { mobileQueryFailureStatus } from '@/lib/mobile-api/query-failure';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  if (Number(request.headers.get('content-length') ?? 0) > 64 * 1024) {
    return mobileJson({ error: 'Payload too large' }, 413);
  }

  const operation = await request.json().catch(() => null) as MobileDailyLogPhotoSyncOperation | null;
  if (!operation) return mobileJson({ error: 'Invalid photo synchronization operation' }, 400);
  const authorized = await authorizeMobilePhotoOperation(context, operation);
  if (!authorized.ok) {
    return mobileJson({ error: authorized.error, retryable: authorized.retryable }, authorized.status);
  }

  const upload = await context.supabase.storage
    .from(authorized.bucket)
    .createSignedUploadUrl(authorized.path, { upsert: true })
    .catch(() => null);
  if (!upload) {
    return mobileJson({ error: 'Could not authorize the photo upload', retryable: true }, 503);
  }
  const { data, error } = upload;
  if (error) {
    const status = mobileQueryFailureStatus([{ status: error.status ?? 0, error: { code: error.statusCode } }]);
    if (status === 401 || status === 403) {
      return mobileJson({ error: status === 401 ? 'Not authenticated' : 'Permission denied', retryable: false }, status);
    }
    return mobileJson({ error: 'Could not authorize the photo upload', retryable: true }, 503);
  }
  if (typeof data?.token !== 'string' || !data.token) {
    return mobileJson({ error: 'Could not authorize the photo upload', retryable: true }, 503);
  }
  return mobileJson({ bucket: authorized.bucket, path: authorized.path, token: data.token });
}
