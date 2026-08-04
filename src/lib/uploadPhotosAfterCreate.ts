import { recordAttachment } from '@/lib/actions/attachments';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getBucket, buildStoragePath } from '@/lib/attachments-shared';
import { compressImage } from '@/lib/compressImage';
import type { PhotoFile } from '@/components/shared/PhotoUpload';
import type { Attachment, PhotoCategory } from '@/lib/types';

export interface UploadResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface UploadedPhotoAttachment {
  attachment: Attachment;
  file: File;
}

export async function uploadPhotoAttachment(input: {
  file: File;
  category: PhotoCategory;
  entityType: string;
  entityId: string;
  projectId: string;
  geoLat?: number | null;
  geoLng?: number | null;
}): Promise<{ success?: boolean; data?: UploadedPhotoAttachment; error?: string }> {
  const supabase = createSupabaseBrowserClient();
  const compressed = await compressImage(input.file, input.category);
  const bucket = getBucket(input.category);
  const storagePath = buildStoragePath(input.projectId, input.entityType, input.entityId, compressed.name);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, compressed, { contentType: compressed.type, upsert: false });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const recordResult = await recordAttachment({
    entityType: input.entityType,
    entityId: input.entityId,
    projectId: input.projectId,
    storagePath,
    bucket,
    fileName: compressed.name,
    fileType: compressed.type,
    fileSize: compressed.size,
    photoCategory: input.category,
    geoLat: input.geoLat ?? null,
    geoLng: input.geoLng ?? null,
  });

  if (recordResult.error || !recordResult.data) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return { error: recordResult.error ?? 'Failed to record attachment' };
  }

  return { success: true, data: { attachment: recordResult.data, file: compressed } };
}

/**
 * Uploads photos to Supabase storage after an entity (daily log, punch list item, etc.)
 * has been created. This bridges the gap where PhotoUpload can't auto-upload during
 * creation because no entity ID exists yet.
 *
 * Returns a result object with success/failure counts so callers can inform the user.
 */
export async function uploadPhotosAfterCreate(
  photos: PhotoFile[],
  entityType: string,
  entityId: string,
  projectId: string
): Promise<UploadResult> {
  const result: UploadResult = { total: photos.length, succeeded: 0, failed: 0, errors: [] };

  // Upload all photos concurrently. Each browser upload goes straight to
  // Supabase Storage, then records a small metadata row through a server action.
  const uploadPromises = photos.map(async (photo) => {
    try {
      const uploadResult = await uploadPhotoAttachment({
        file: photo.file,
        category: photo.category,
        entityType,
        entityId,
        projectId,
        geoLat: photo.geo_lat,
        geoLng: photo.geo_lng,
      });
      if (uploadResult.error) {
        return { success: false, name: photo.file.name, error: uploadResult.error };
      }
      return { success: true, name: photo.file.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, name: photo.file.name, error: msg };
    }
  });

  const outcomes = await Promise.allSettled(uploadPromises);

  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled') {
      if (outcome.value.success) {
        result.succeeded++;
      } else {
        result.failed++;
        result.errors.push(`${outcome.value.name}: ${outcome.value.error}`);
        console.error(`Failed to upload ${outcome.value.name}:`, outcome.value.error);
      }
    } else {
      result.failed++;
      result.errors.push(`Upload failed: ${outcome.reason}`);
      console.error('Upload promise rejected:', outcome.reason);
    }
  }

  return result;
}

/**
 * Uploads generic File objects (non-PhotoFile) as attachments.
 * Used by submittals which use a plain file input instead of PhotoUpload.
 *
 * Returns a result object with success/failure counts so callers can inform the user.
 */
export async function uploadFilesAfterCreate(
  files: File[],
  entityType: string,
  entityId: string,
  projectId: string
): Promise<UploadResult> {
  const result: UploadResult = { total: files.length, succeeded: 0, failed: 0, errors: [] };

  const supabase = createSupabaseBrowserClient();
  const bucket = getBucket('document');

  const uploadPromises = files.map(async (file) => {
    try {
      const storagePath = buildStoragePath(projectId, entityType, entityId, file.name);

      // 1. Direct upload to Supabase Storage — bypasses Vercel body limits.
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        return { success: false, name: file.name, error: uploadError.message };
      }

      // 2. Tiny server action to record the attachment row.
      const recordResult = await recordAttachment({
        entityType,
        entityId,
        projectId,
        storagePath,
        bucket,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        photoCategory: 'document',
      });

      if (recordResult.error) {
        await supabase.storage.from(bucket).remove([storagePath]);
        return { success: false, name: file.name, error: recordResult.error };
      }

      return { success: true, name: file.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, name: file.name, error: msg };
    }
  });

  const outcomes = await Promise.allSettled(uploadPromises);

  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled') {
      if (outcome.value.success) {
        result.succeeded++;
      } else {
        result.failed++;
        result.errors.push(`${outcome.value.name}: ${outcome.value.error}`);
        console.error(`Failed to upload ${outcome.value.name}:`, outcome.value.error);
      }
    } else {
      result.failed++;
      result.errors.push(`Upload failed: ${outcome.reason}`);
      console.error('Upload promise rejected:', outcome.reason);
    }
  }

  return result;
}
