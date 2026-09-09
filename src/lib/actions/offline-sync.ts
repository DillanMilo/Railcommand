'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type {
  DailyLogCreateOperation,
  DailyLogPhotoUploadOperation,
} from '@/lib/offline/outbox';
import { getBucket, sanitizeFilename } from '@/lib/attachments-shared';
import { checkPermission, getAuthenticatedUser } from './permissions-helper';

export type DailyLogSyncResult =
  | {
      success: true;
      data: {
        id: string;
        project_id: string;
        created_by: string;
        idempotency_key: string;
        duplicate: boolean;
      };
    }
  | { success?: never; error: string; retryable: boolean };

export type DailyLogPhotoPrepareResult =
  | {
      success: true;
      data: { bucket: string; path: string; token: string };
    }
  | { success?: never; error: string; retryable: boolean };

export type DailyLogPhotoFinalizeResult =
  | { success: true; data: { id: string; duplicate: boolean } }
  | { success?: never; error: string; retryable: boolean };

const NON_RETRYABLE_DATABASE_CODES = new Set(['42501']);

function isRetryableDatabaseCode(code: string | undefined): boolean {
  if (!code) return true;
  // SQLSTATE class 22 is invalid input and class 23 is an integrity violation;
  // neither can heal merely because the network reconnects.
  return !NON_RETRYABLE_DATABASE_CODES.has(code)
    && !code.startsWith('22')
    && !code.startsWith('23');
}

export async function syncOfflineDailyLogOperation(
  operation: DailyLogCreateOperation
): Promise<DailyLogSyncResult> {
  if (
    operation.kind !== 'daily_log_create'
    || !operation.projectId
    || !operation.clientId
    || operation.operationId !== operation.clientId
    || operation.idempotencyKey.length < 16
  ) {
    return { error: 'The queued daily log is invalid.', retryable: false };
  }

  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) {
      // A token refresh can briefly make a valid browser session unavailable.
      // Signed-out users have their whole database cleared, so retaining and
      // retrying here protects work without bypassing authentication.
      return { error: authError ?? 'Not authenticated', retryable: true };
    }

    // This foreground check gives clear application feedback. The transaction
    // repeats authentication and authorization inside Postgres before writing.
    const permission = await checkPermission(
      supabase,
      user.id,
      operation.projectId,
      ACTIONS.DAILY_LOG_CREATE
    );
    if (!permission.allowed) {
      return { error: permission.error, retryable: false };
    }

    const { data, error } = await supabase.rpc('sync_daily_log_create', {
      p_project_id: operation.projectId,
      p_client_id: operation.clientId,
      p_idempotency_key: operation.idempotencyKey,
      p_payload: operation.payload,
    });

    if (error) {
      return {
        error: error.message,
        retryable: isRetryableDatabaseCode(error.code),
      };
    }

    revalidatePath(`/projects/${operation.projectId}/daily-logs`);
    return {
      success: true,
      data: data as {
        id: string;
        project_id: string;
        created_by: string;
        idempotency_key: string;
        duplicate: boolean;
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Synchronization failed',
      retryable: true,
    };
  }
}

function isValidPhotoOperation(operation: DailyLogPhotoUploadOperation): boolean {
  return operation.kind === 'daily_log_photo_upload'
    && Boolean(operation.operationId)
    && operation.operationId === operation.blobId
    && Boolean(operation.parentEntityId)
    && Boolean(operation.projectId)
    && operation.idempotencyKey.length >= 16
    && operation.payload.fileSize > 0
    && operation.payload.fileSize <= 25 * 1024 * 1024
    && ['standard', 'thermal'].includes(operation.payload.photoCategory);
}

async function authorizePhotoOperation(
  operation: DailyLogPhotoUploadOperation
) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return { success: false, error: authError ?? 'Not authenticated', retryable: true } as const;
  }

  const permission = await checkPermission(
    supabase,
    user.id,
    operation.projectId,
    ACTIONS.DAILY_LOG_CREATE
  );
  if (!permission.allowed) {
    return { success: false, error: permission.error, retryable: false } as const;
  }

  const { data: parent, error: parentError } = await supabase
    .from('daily_logs')
    .select('id, project_id, created_by')
    .eq('id', operation.parentEntityId)
    .eq('project_id', operation.projectId)
    .eq('created_by', user.id)
    .maybeSingle();
  if (parentError) {
    return { success: false,
      error: parentError.message,
      retryable: isRetryableDatabaseCode(parentError.code),
    } as const;
  }
  if (!parent) {
    return { success: false, error: 'The parent daily log is not synchronized yet.', retryable: true } as const;
  }

  return { success: true, supabase, user } as const;
}

export async function prepareOfflineDailyLogPhotoUpload(
  operation: DailyLogPhotoUploadOperation
): Promise<DailyLogPhotoPrepareResult> {
  if (!isValidPhotoOperation(operation)) {
    return { error: 'The queued photo is invalid.', retryable: false };
  }

  try {
    const authorized = await authorizePhotoOperation(operation);
    if (!authorized.success) {
      return { error: authorized.error, retryable: authorized.retryable };
    }

    const bucket = getBucket(operation.payload.photoCategory);
    const path = `${operation.projectId}/daily_log/${operation.parentEntityId}/${operation.operationId}-${sanitizeFilename(operation.payload.fileName)}`;
    const { data, error } = await authorized.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !data?.token) {
      return { error: error?.message ?? 'Could not authorize the photo upload.', retryable: true };
    }

    return { success: true, data: { bucket, path, token: data.token } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not prepare the photo upload.',
      retryable: true,
    };
  }
}

export async function finalizeOfflineDailyLogPhotoUpload(
  operation: DailyLogPhotoUploadOperation,
  storage: { bucket: string; path: string }
): Promise<DailyLogPhotoFinalizeResult> {
  if (!isValidPhotoOperation(operation) || !storage.bucket || !storage.path) {
    return { error: 'The queued photo is invalid.', retryable: false };
  }

  try {
    const authorized = await authorizePhotoOperation(operation);
    if (!authorized.success) {
      return { error: authorized.error, retryable: authorized.retryable };
    }
    if (storage.bucket !== getBucket(operation.payload.photoCategory)) {
      return { error: 'The queued photo bucket is invalid.', retryable: false };
    }

    const { data, error } = await authorized.supabase.rpc('sync_daily_log_photo_attachment', {
      p_attachment_id: operation.operationId,
      p_project_id: operation.projectId,
      p_daily_log_id: operation.parentEntityId,
      p_idempotency_key: operation.idempotencyKey,
      p_bucket: storage.bucket,
      p_storage_path: storage.path,
      p_file_name: operation.payload.fileName,
      p_file_type: operation.payload.fileType,
      p_file_size: operation.payload.fileSize,
      p_photo_category: operation.payload.photoCategory,
      p_geo_lat: operation.payload.geoLat,
      p_geo_lng: operation.payload.geoLng,
      p_captured_at: operation.payload.capturedAt,
    });
    if (error) {
      return { error: error.message, retryable: isRetryableDatabaseCode(error.code) };
    }

    revalidatePath(`/projects/${operation.projectId}/daily-logs/${operation.parentEntityId}`);
    revalidatePath(`/projects/${operation.projectId}/photos`);
    return { success: true, data: data as { id: string; duplicate: boolean } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not finalize the photo upload.',
      retryable: true,
    };
  }
}
