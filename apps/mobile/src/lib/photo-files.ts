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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function isOwnedFieldPhotoUri(
  documentUri: string,
  userId: string,
  projectId: string,
  photoId: string,
  uri: string,
) {
  if (![userId, projectId, photoId].every((value) => UUID_PATTERN.test(value))) return false;
  try {
    const documentRoot = new URL(documentUri.endsWith('/') ? documentUri : `${documentUri}/`);
    const candidate = new URL(uri);
    if (documentRoot.protocol !== 'file:' || candidate.protocol !== 'file:') return false;
    if (candidate.search || candidate.hash) return false;

    const expectedDirectory = new URL(`railcommand/${userId}/${projectId}/photos/`, documentRoot);
    const encodedLeaf = candidate.pathname.split('/').pop() ?? '';
    const leaf = decodeURIComponent(encodedLeaf);
    const match = leaf.match(new RegExp(`^${photoId}\\.(jpg|png|heic|heif|webp|tif|dng)$`, 'i'));
    if (!match) return false;

    return candidate.href === new URL(leaf, expectedDirectory).href;
  } catch {
    return false;
  }
}
