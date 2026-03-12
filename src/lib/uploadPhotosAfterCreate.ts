import { uploadAttachment } from '@/lib/actions/attachments';
import { compressImage } from '@/lib/compressImage';
import type { PhotoFile } from '@/components/shared/PhotoUpload';

/**
 * Uploads photos to Supabase storage after an entity (daily log, punch list item, etc.)
 * has been created. This bridges the gap where PhotoUpload can't auto-upload during
 * creation because no entity ID exists yet.
 *
 * Errors are logged but don't block the flow — the entity is already saved.
 */
export async function uploadPhotosAfterCreate(
  photos: PhotoFile[],
  entityType: string,
  entityId: string,
  projectId: string
): Promise<void> {
  for (const photo of photos) {
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

      const result = await uploadAttachment(formData);
      if (result.error) {
        console.error(`Failed to upload ${photo.file.name}:`, result.error);
      }
    } catch (err) {
      console.error(`Failed to upload ${photo.file.name}:`, err);
    }
  }
}

/**
 * Uploads generic File objects (non-PhotoFile) as attachments.
 * Used by submittals which use a plain file input instead of PhotoUpload.
 */
export async function uploadFilesAfterCreate(
  files: File[],
  entityType: string,
  entityId: string,
  projectId: string
): Promise<void> {
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      formData.append('project_id', projectId);
      formData.append('photo_category', 'document');

      const result = await uploadAttachment(formData);
      if (result.error) {
        console.error(`Failed to upload ${file.name}:`, result.error);
      }
    } catch (err) {
      console.error(`Failed to upload ${file.name}:`, err);
    }
  }
}
