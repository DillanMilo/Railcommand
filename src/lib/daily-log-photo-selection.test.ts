import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  getAvailablePhotosForDailyLog,
  getPhotoLocalDate,
  getPhotosForDailyLogDate,
} from './daily-log-photo-selection';
import type { Attachment } from './types';

function photo(id: string, capturedAt: string | null, createdAt = '2026-08-17T15:00:00-05:00'): Attachment {
  return {
    id,
    entity_type: 'project_photo',
    entity_id: 'project-1',
    project_id: 'project-1',
    file_name: `${id}.jpg`,
    file_url: `https://example.com/${id}.jpg`,
    file_type: 'image/jpeg',
    file_size: 100,
    photo_category: 'standard',
    uploaded_by: 'user-1',
    geo_lat: null,
    geo_lng: null,
    captured_at: capturedAt,
    created_at: createdAt,
  };
}

describe('daily-log photo selection', () => {
  it('uses captured_at and falls back to created_at', () => {
    assert.equal(getPhotoLocalDate(photo('captured', '2026-08-17T09:30:00-05:00')), '2026-08-17');
    assert.equal(getPhotoLocalDate(photo('created', null)), '2026-08-17');
  });

  it('returns same-day photos and excludes ones already attached', () => {
    const photos = [
      photo('first', '2026-08-17T09:30:00-05:00'),
      photo('second', '2026-08-17T13:30:00-05:00'),
      photo('other-day', '2026-08-16T13:30:00-05:00'),
    ];
    assert.deepEqual(
      getPhotosForDailyLogDate(photos, '2026-08-17', new Set(['second'])).map((item) => item.id),
      ['first']
    );
  });

  it('keeps other recent photos available while placing report-date photos first', () => {
    const photos = [
      photo('older', '2026-08-15T09:30:00-05:00'),
      photo('same-day', '2026-08-17T09:30:00-05:00'),
      photo('newer', '2026-08-18T09:30:00-05:00'),
    ];

    assert.deepEqual(
      getAvailablePhotosForDailyLog(photos, '2026-08-17', new Set(['newer'])).map((item) => item.id),
      ['same-day', 'older']
    );
  });
});
