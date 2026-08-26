import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  STORE_STORIES,
  STORE_TARGETS,
  expectedFileName,
  validateStoreImage,
} from './store-media.mjs';

const { values } = parseArgs({
  options: { strict: { type: 'boolean', default: false } },
});

const missing = [];
const verified = [];
for (const [target, definition] of Object.entries(STORE_TARGETS)) {
  for (const story of STORE_STORIES) {
    const path = resolve(
      'docs/mobile/store-assets/screenshots',
      definition.directory,
      expectedFileName(target, story),
    );
    if (!existsSync(path)) {
      missing.push({ target, story: story.label, file: path });
      continue;
    }
    const image = validateStoreImage(path, target);
    verified.push({ target, story: story.label, file: path, dimensions: image.dimensions });
  }
}

console.log(JSON.stringify({
  releaseVersion: '1.0.0',
  verifiedCount: verified.length,
  requiredCount: Object.keys(STORE_TARGETS).length * STORE_STORIES.length,
  missingCount: missing.length,
  verified,
  missing,
}, null, 2));

if (values.strict && missing.length > 0) process.exitCode = 1;
