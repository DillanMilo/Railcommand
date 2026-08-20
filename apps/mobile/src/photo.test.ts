import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { materializeCapturedPhoto } from './photo';

describe('captured photo materialization', () => {
  it('copies temporary camera-backed bytes into an owned Blob', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const file = {
      name: 'field-photo.heic',
      type: 'image/heic',
      arrayBuffer: async () => bytes.buffer,
    } as File;

    const result = await materializeCapturedPhoto(file);

    assert.equal(result.fileName, 'field-photo.heic');
    assert.equal(result.fileType, 'image/heic');
    assert.equal(result.size, 4);
    assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
  });

  it('rejects an empty camera result instead of reporting a false save', async () => {
    const file = {
      name: '',
      type: '',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as File;

    await assert.rejects(materializeCapturedPhoto(file), /contained no image data/);
  });
});
