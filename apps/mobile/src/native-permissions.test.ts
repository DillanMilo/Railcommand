import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const infoPlist = readFileSync(
  new URL('../ios/App/App/Info.plist', import.meta.url),
  'utf8',
);

describe('native privacy declarations', () => {
  it('declares camera and photo-library usage before exposing photo capture', () => {
    assert.match(
      infoPlist,
      /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]+<\/string>/,
    );
    assert.match(
      infoPlist,
      /<key>NSPhotoLibraryUsageDescription<\/key>\s*<string>[^<]+<\/string>/,
    );
  });
});
