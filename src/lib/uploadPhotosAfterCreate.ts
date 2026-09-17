import { uploadFileWithReceipt } from '@/lib/attachment-upload-retry';
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
  return uploadFileWithReceipt(input);
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

  const uploadPromises = files.map(async (file) => {
    try {
      const uploadResult = await uploadFileWithReceipt({ file, category: 'document', entityType, entityId, projectId });
      if (uploadResult.error) return { success: false, name: file.name, error: uploadResult.error };

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
