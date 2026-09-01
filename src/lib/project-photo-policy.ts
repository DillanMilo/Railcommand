// These limits apply to standalone Photos & Media uploads, including the camera.
// Daily-log and thermal workflows keep their existing policies.
export const PROJECT_PHOTO_MAX_BYTES = 500 * 1024;
export const PROJECT_PHOTO_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const PROJECT_PHOTO_PAGE_SIZE = 12;
export const PROJECT_PHOTO_MAX_PENDING = 20;

export function validateProjectPhoto(file: Pick<Blob, 'size' | 'type'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'This photo format cannot be optimized here. Save a JPEG, PNG, or WebP copy and try again.';
  }
  if (file.size <= 0 || file.size > PROJECT_PHOTO_MAX_BYTES) {
    return 'The optimized photo must be 500 KB or smaller. Choose a smaller photo or export a JPEG copy.';
  }
  return null;
}
