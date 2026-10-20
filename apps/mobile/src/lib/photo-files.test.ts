import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  assertFieldPhotoSize,
  MAX_FIELD_PHOTO_BYTES,
  PHOTO_TOO_LARGE_MESSAGE,
  isOwnedFieldPhotoUri,
  safePhotoExtension,
  safePhotoFileName,
} from './photo-files';

describe('field photo file boundary', () => {
  it('uses a safe default for path-like or extensionless provider names', () => {
    assert.equal(safePhotoExtension('../../secret', null), 'jpg');
    assert.equal(safePhotoFileName('../../secret', 'photo-id', 'jpg'), 'secret.jpg');
    assert.equal(safePhotoFileName('..\\..\\', 'photo-id', 'jpg'), 'field-photo-photo-id.jpg');
  });

  it('prefers the image MIME type over an unsafe provider extension', () => {
    assert.equal(safePhotoExtension('payload.exe', 'image/jpeg'), 'jpg');
    assert.equal(safePhotoFileName('payload.exe', 'photo-id', 'jpg'), 'payload.jpg');
  });

  it('normalizes supported filename extensions when MIME metadata is absent', () => {
    assert.equal(safePhotoExtension('FIELD.TIFF', null), 'tif');
    assert.equal(safePhotoExtension('FIELD.JPEG', null), 'jpg');
  });

  it('removes path separators, control characters, Unicode, and hidden-name prefixes', () => {
    assert.equal(safePhotoFileName('/tmp/.\u0000résumé photo.png', 'photo-id', 'png'), 'r_sum_ photo.png');
  });

  it('caps the display filename while keeping the safe extension', () => {
    const fileName = safePhotoFileName(`${'a'.repeat(300)}.jpg`, 'photo-id', 'jpg');
    assert.equal(fileName, `${'a'.repeat(120)}.jpg`);
    assert.equal(fileName.length, 124);
  });

  it('matches the server 25 MB boundary before a file enters the outbox', () => {
    assert.doesNotThrow(() => assertFieldPhotoSize(MAX_FIELD_PHOTO_BYTES));
    assert.throws(
      () => assertFieldPhotoSize(MAX_FIELD_PHOTO_BYTES + 1),
      (error: unknown) => error instanceof Error && error.message === PHOTO_TOO_LARGE_MESSAGE,
    );
  });

  it('allows deletion only for the exact user/project/photo file under app Documents', () => {
    const documentUri = 'file:///app/Documents/';
    const userId = '11111111-1111-4111-8111-111111111111';
    const projectId = '22222222-2222-4222-8222-222222222222';
    const photoId = '33333333-3333-4333-8333-333333333333';
    const exact = `${documentUri}railcommand/${userId}/${projectId}/photos/${photoId}.jpg`;

    assert.equal(isOwnedFieldPhotoUri(documentUri, userId, projectId, photoId, exact), true);
    assert.equal(isOwnedFieldPhotoUri(documentUri, userId, projectId, photoId, `${exact}?replace=1`), false);
    assert.equal(isOwnedFieldPhotoUri(documentUri, userId, projectId, photoId, exact.replace(userId, '44444444-4444-4444-8444-444444444444')), false);
    assert.equal(isOwnedFieldPhotoUri(documentUri, userId, projectId, photoId, exact.replace(photoId, '55555555-5555-4555-8555-555555555555')), false);
    assert.equal(isOwnedFieldPhotoUri(documentUri, userId, projectId, photoId, 'file:///app/Documents/railcommand/../private.jpg'), false);
    assert.equal(isOwnedFieldPhotoUri(documentUri, userId, projectId, photoId, 'https://example.com/photo.jpg'), false);
  });
});
