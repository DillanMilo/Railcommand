export const MAX_FIELD_PHOTO_BYTES = 25 * 1024 * 1024;

export const PHOTO_TOO_LARGE_MESSAGE =
  'Photo is larger than 25 MB. The draft remains saved; choose a smaller photo.';

export const PHOTO_STORAGE_MESSAGE =
  'Photo could not be saved on this device. Free storage and try again. The draft remains saved.';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'image/tiff': 'tif',
  'image/x-tiff': 'tif',
  'image/dng': 'dng',
  'image/x-adobe-dng': 'dng',
};

const SAFE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'tif', 'tiff', 'dng']);

export function safePhotoExtension(
  fileName: string | null | undefined,
  mimeType: string | null | undefined,
) {
  const mimeExtension = mimeType ? MIME_EXTENSIONS[mimeType.toLowerCase()] : undefined;
  if (mimeExtension) return mimeExtension;

  const leaf = (fileName ?? '').split(/[\\/]/).pop() ?? '';
  const candidate = leaf.includes('.') ? leaf.split('.').pop()?.toLowerCase() : undefined;
  if (candidate && SAFE_EXTENSIONS.has(candidate)) {
    return candidate === 'jpeg' ? 'jpg' : candidate === 'tiff' ? 'tif' : candidate;
  }

  return 'jpg';
}

export function safePhotoFileName(
  fileName: string | null | undefined,
  photoId: string,
  extension: string,
) {
  const leaf = (fileName ?? '').split(/[\\/]/).pop() ?? '';
  const lastDot = leaf.lastIndexOf('.');
  const untrustedBase = lastDot > 0 ? leaf.slice(0, lastDot) : leaf;
  const safeBase = untrustedBase
    .replace(/[^a-zA-Z0-9 _-]/g, '_')
    .replace(/^[._ -]+|[._ -]+$/g, '')
    .slice(0, 120)
    .replace(/[ _-]+$/g, '');

  return `${safeBase || `field-photo-${photoId}`}.${extension}`;
}

export function assertFieldPhotoSize(size: number | null | undefined) {
  if (typeof size === 'number' && size > MAX_FIELD_PHOTO_BYTES) {
    throw new Error(PHOTO_TOO_LARGE_MESSAGE);
  }
}
