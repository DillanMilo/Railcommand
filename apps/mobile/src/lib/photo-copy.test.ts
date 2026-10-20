import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import * as photoFiles from './photo-files';

const userId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const photoId = '33333333-3333-4333-8333-333333333333';
const parentClientId = '44444444-4444-4444-8444-444444444444';

function harness() {
  const files = new Map<string, number>();
  let finishCopy!: () => void;
  let failCopy!: (error: Error) => void;
  let sizeReads = 0;
  let deletes = 0;
  let copying = false;
  const pending = new Promise<void>((resolve, reject) => {
    finishCopy = resolve;
    failCopy = reject;
  });
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map(part => typeof part === 'string' ? part : part.uri).join('/');
    }
    create() { /* Fixture directory exists. */ }
  }
  class File extends Directory {
    async copy(destination: File) {
      copying = true;
      await pending;
      files.set(destination.uri, 297180);
    }
    get size() {
      sizeReads++;
      const value = files.get(this.uri);
      if (value === undefined) throw new Error('ENOENT: copy has not completed');
      return value;
    }
    get exists() { return files.has(this.uri); }
    delete() { deletes++; files.delete(this.uri); }
  }
  const dependencies: Record<string, unknown> = {
    'expo-crypto': { randomUUID: () => photoId },
    'expo-file-system': { Directory, File, Paths: { document: 'file:///app/Documents' } },
    'expo-image-picker': {
      requestCameraPermissionsAsync: async () => ({ granted: true }),
      launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///camera/photo.jpg', fileName: 'test.jpg', mimeType: 'image/jpeg', fileSize: 297180 }] }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///picker/photo.jpg', fileName: 'test.jpg', mimeType: 'image/jpeg', fileSize: 297180 }] }),
    },
    'expo-haptics': {}, 'expo-location': {}, 'expo-notifications': {}, 'expo-device': {},
    'react-native': {}, './config': { mobileConfig: {} }, './photo-files': photoFiles,
  };
  const module = { exports: {} };
  const source = readFileSync(new URL('./device.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, {
    module, exports: module.exports, URL,
    require(name: string) {
      if (!(name in dependencies)) throw new Error(`Unexpected native dependency: ${name}`);
      return dependencies[name];
    },
  });
  return { device: module.exports as typeof import('./device'), files,
    finishCopy, failCopy, copying: () => copying, sizeReads: () => sizeReads, deletes: () => deletes };
}

async function advanceToCopy(h: ReturnType<typeof harness>) {
  for (let turn = 0; turn < 8 && !h.copying(); turn++) await Promise.resolve();
  assert.equal(h.copying(), true);
  await Promise.resolve();
}

describe('native photo copy completion', () => {
  for (const source of ['camera', 'library'] as const) {
    it(`waits for the ${source} file before validating size or returning attachment metadata`, async () => {
      const h = harness();
      let settled = false;
      const operation = source === 'camera'
        ? h.device.captureFieldPhoto(userId, projectId, parentClientId, null)
        : h.device.importFieldPhoto(userId, projectId, parentClientId, null);
      void operation.then(() => { settled = true; }, () => { settled = true; });
      await advanceToCopy(h);
      assert.equal(settled, false, 'must not report a storage error while a native copy is still running');
      assert.equal(h.sizeReads(), 0, 'destination does not exist until native copy completes');
      assert.equal(h.deletes(), 0, 'must not race cleanup against a running copy');
      h.finishCopy();
      const photo = await operation;
      assert.ok(photo);
      assert.equal(photo.photoId, photoId);
      assert.equal(photo.parentClientId, parentClientId);
      assert.equal(photo.projectId, projectId);
      assert.equal(photo.size, 297180);
      assert.equal(h.files.get(photo.uri), photo.size);
      assert.equal(photo.status, 'pending');
      assert.equal(h.deletes(), 0);
    });
  }

  it('handles an asynchronous copy rejection without returning metadata or leaving a late orphan', async () => {
    const h = harness();
    const operation = h.device.captureFieldPhoto(userId, projectId, parentClientId, null);
    const rejection = assert.rejects(operation, { message: photoFiles.PHOTO_STORAGE_MESSAGE });
    await advanceToCopy(h);
    assert.equal(h.deletes(), 0);
    h.failCopy(new Error('Synthetic native copy failure'));
    await rejection;
    assert.equal(h.sizeReads(), 0);
    assert.equal(h.files.size, 0);
    assert.equal(h.deletes(), 1);
  });
});
