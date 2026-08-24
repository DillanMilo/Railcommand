import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { captureNativePhoto, chooseNativePhoto, materializeCapturedPhoto } from './photo';

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

  it('invokes the native camera and materializes its returned file URI', async () => {
    let takePhotoCalls = 0;
    let convertedUri = '';
    const camera = {
      takePhoto: async () => {
        takePhotoCalls += 1;
        return {
          type: 0,
          uri: 'file:///temporary/camera.jpg',
          saved: false,
          metadata: { format: 'jpeg' },
        };
      },
    };
    const result = await captureNativePhoto(
      camera,
      async (url) => new Response(new Blob([new Uint8Array([5, 6, 7])], { type: 'image/jpeg' }), {
        status: url === 'capacitor://camera.jpg' ? 200 : 404,
      }),
      (uri) => {
        convertedUri = uri;
        return 'capacitor://camera.jpg';
      },
    );

    assert.equal(takePhotoCalls, 1);
    assert.equal(convertedUri, 'file:///temporary/camera.jpg');
    assert.equal(result.fileType, 'image/jpeg');
    assert.equal(result.size, 3);
    assert.match(result.fileName, /\.jpg$/);
  });

  it('materializes one photo selected through the native library adapter', async () => {
    const result = await chooseNativePhoto(
      {
        chooseFromGallery: async () => ({
          results: [{
            type: 0,
            saved: false,
            webPath: 'capacitor://library/photo.jpg',
            metadata: { format: 'jpg' },
          }],
        }),
      },
      async () => new Response(new Blob([new Uint8Array([8, 9])], { type: 'image/jpeg' }), { status: 200 }),
    );
    assert.equal(result.size, 2);
    assert.match(result.fileName, /railcommand-library-.*\.jpg$/);
  });
});
