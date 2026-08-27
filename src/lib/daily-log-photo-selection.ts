import type { Attachment } from '@/lib/types';

export function getPhotoLocalDate(photo: Attachment): string {
  const timestamp = photo.captured_at ?? photo.created_at;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPhotosForDailyLogDate(
  photos: Attachment[],
  logDate: string,
  excludedAttachmentIds: ReadonlySet<string> = new Set()
): Attachment[] {
  if (!logDate) return [];
  return photos.filter(
    (photo) =>
      !excludedAttachmentIds.has(photo.id) &&
      getPhotoLocalDate(photo) === logDate
  );
}

export function getAvailablePhotosForDailyLog(
  photos: Attachment[],
  logDate: string,
  excludedAttachmentIds: ReadonlySet<string> = new Set()
): Attachment[] {
  return photos
    .filter((photo) => !excludedAttachmentIds.has(photo.id))
    .sort((a, b) => {
      const aMatches = getPhotoLocalDate(a) === logDate;
      const bMatches = getPhotoLocalDate(b) === logDate;
      if (aMatches !== bMatches) return aMatches ? -1 : 1;

      const aTime = new Date(a.captured_at ?? a.created_at).getTime();
      const bTime = new Date(b.captured_at ?? b.created_at).getTime();
      return bTime - aTime;
    });
}
