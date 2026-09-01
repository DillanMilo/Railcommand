import { compressImage } from './compressImage';
import { PROJECT_PHOTO_MAX_BYTES, PROJECT_PHOTO_MAX_SOURCE_BYTES, validateProjectPhoto } from './project-photo-policy';

export async function prepareProjectPhoto(file: File): Promise<File> {
  if (!file.size || file.size > PROJECT_PHOTO_MAX_SOURCE_BYTES) {
    throw new Error('Choose a photo smaller than 25 MB. Nothing has been uploaded.');
  }
  let prepared = file;
  for (const options of [
    { maxPx: 1600, quality: 0.72 },
    { maxPx: 1280, quality: 0.65 },
    { maxPx: 1024, quality: 0.6 },
  ]) {
    prepared = await compressImage(file, 'standard', options);
    if (prepared.size <= PROJECT_PHOTO_MAX_BYTES) break;
  }
  const error = validateProjectPhoto(prepared);
  if (error) throw new Error(error);
  // Canvas output is JPEG, so do not keep a misleading HEIC/PNG extension.
  const name = prepared.type === 'image/jpeg'
    ? file.name.replace(/\.[^.]+$/, '') + '.jpeg'
    : file.name;
  return new File([prepared], name, { type: prepared.type, lastModified: file.lastModified });
}
