import type { Attachment } from '@/lib/types';

export interface DailyLogPdfPhoto {
  source: string;
  caption: string;
}

export function getDailyLogPhotoAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.filter((attachment) =>
    ((attachment.file_type ?? '').toLowerCase().startsWith('image/') || attachment.photo_category === 'thermal')
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read photo'));
    reader.readAsDataURL(blob);
  });
}

export async function loadDailyLogPdfPhotos(attachments: Attachment[]): Promise<DailyLogPdfPhoto[]> {
  const photos = getDailyLogPhotoAttachments(attachments);
  const loaded = await Promise.all(photos.map(async (photo) => {
    try {
      const source = photo.signed_url ?? photo.file_url;
      if (photo.signed_url_error || !source) throw new Error('Photo is unavailable');
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(photo.file_type.toLowerCase())) throw new Error('This photo format needs conversion before PDF export.');
      if (source.startsWith('data:')) {
        return { source, caption: photo.file_name } satisfies DailyLogPdfPhoto;
      }

      const response = await fetch(
        source,
        source.startsWith('http:') || source.startsWith('https:') ? { cache: 'no-store' } : undefined
      );
      if (!response.ok) throw new Error('Photo download failed');
      return {
        source: await blobToDataUrl(await response.blob()),
        caption: photo.file_name,
      } satisfies DailyLogPdfPhoto;
    } catch {
      throw new Error(`Could not include "${photo.file_name}" in the PDF. Refresh photos and retry. If its format is not JPEG or PNG, add a JPEG/PNG copy. The saved original is unchanged.`);
    }
  }));

  return loaded;
}
