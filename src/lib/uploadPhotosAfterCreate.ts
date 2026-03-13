import { uploadAttachment } from '@/lib/actions/attachments';
import { compressImage } from '@/lib/compressImage';
import type { PhotoFile } from '@/components/shared/PhotoUpload';

export interface UploadResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
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

  // Upload all photos concurrently with Promise.allSettled to avoid race conditions
  const uploadPromises = photos.map(async (photo) => {
    try {
      const compressed = await compressImage(photo.file, photo.category);

      const formData = new FormData();
      formData.append('file', compressed);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      formData.append('project_id', projectId);
      formData.append('photo_category', photo.category);
      if (photo.geo_lat != null) formData.append('geo_lat', String(photo.geo_lat));
      if (photo.geo_lng != null) formData.append('geo_lng', String(photo.geo_lng));

      const uploadResult = await uploadAttachment(formData);
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

  const uploadPromises = files.map(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      formData.append('project_id', projectId);
      formData.append('photo_category', 'document');

      const uploadResult = await uploadAttachment(formData);
      if (uploadResult.error) {
        return { success: false, name: file.name, error: uploadResult.error };
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
