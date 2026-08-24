import type {
  MobileDailyLogPhotoPrepareResult,
  MobileDailyLogPhotoSyncOperation,
} from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import {
  authorizeMobilePhotoOperation,
  isRetryablePhotoDatabaseError,
} from '@/lib/mobile-api/photo-sync';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

type FinalizeBody = {
  operation: MobileDailyLogPhotoSyncOperation;
  storage: Pick<MobileDailyLogPhotoPrepareResult, 'bucket' | 'path'>;
};

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  if (Number(request.headers.get('content-length') ?? 0) > 64 * 1024) {
    return mobileJson({ error: 'Payload too large' }, 413);
  }

  const body = await request.json().catch(() => null) as FinalizeBody | null;
  if (!body?.operation || !body.storage?.bucket || !body.storage.path) {
    return mobileJson({ error: 'Invalid photo finalization request' }, 400);
  }
  const authorized = await authorizeMobilePhotoOperation(context, body.operation);
  if (!authorized.ok) {
    return mobileJson({ error: authorized.error, retryable: authorized.retryable }, authorized.status);
  }
  if (body.storage.bucket !== authorized.bucket || body.storage.path !== authorized.path) {
    return mobileJson({ error: 'Invalid photo storage destination', retryable: false }, 400);
  }

  const operation = body.operation;
  const { data, error } = await context.supabase.rpc('sync_daily_log_photo_attachment', {
    p_attachment_id: operation.operationId,
    p_project_id: operation.projectId,
    p_daily_log_id: operation.parentEntityId,
    p_idempotency_key: operation.idempotencyKey,
    p_bucket: body.storage.bucket,
    p_storage_path: body.storage.path,
    p_file_name: operation.payload.fileName,
    p_file_type: operation.payload.fileType,
    p_file_size: operation.payload.fileSize,
    p_photo_category: operation.payload.photoCategory,
    p_geo_lat: operation.payload.geoLat,
    p_geo_lng: operation.payload.geoLng,
    p_captured_at: operation.payload.capturedAt,
  });
  if (error) {
    const retryable = isRetryablePhotoDatabaseError(error.code);
    return mobileJson({ error: error.message, retryable }, retryable ? 503 : 400);
  }
  return mobileJson(data);
}
