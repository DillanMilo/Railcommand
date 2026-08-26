import { readFileSync } from 'node:fs';

export const STORE_STORIES = [
  { order: '01', slug: 'field-dashboard', label: 'Field dashboard' },
  { order: '02', slug: 'daily-log-draft', label: 'Daily log draft' },
  { order: '03', slug: 'offline-protection', label: 'Offline protection' },
  { order: '04', slug: 'sync-center', label: 'Sync Center' },
  { order: '05', slug: 'synchronized-history', label: 'Synchronized history' },
  { order: '06', slug: 'privacy-controls', label: 'Privacy controls' },
];

export const STORE_TARGETS = {
  'apple-iphone': {
    directory: 'apple/iphone-6.9',
    extension: 'png',
    dimensions: new Set(['1320x2868', '1290x2796', '1260x2736']),
  },
  'apple-ipad': {
    directory: 'apple/ipad-13',
    extension: 'png',
    dimensions: new Set(['2064x2752', '2048x2732']),
  },
  'google-phone': {
    directory: 'google/phone',
    extension: 'jpg',
    dimensions: new Set(['1080x1920']),
  },
  'google-tablet': {
    directory: 'google/tablet',
    extension: 'jpg',
    dimensions: new Set(['1080x1920', '1920x1080']),
  },
};

export function expectedFileName(target, story) {
  const definition = STORE_TARGETS[target];
  if (!definition) throw new Error(`Unknown store target: ${target}`);
  return `${story.order}-${story.slug}.${definition.extension}`;
}

export function readImageDimensions(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 24) throw new Error(`${path} is not a valid image`);

  if (bytes.toString('ascii', 1, 4) === 'PNG') {
    return {
      format: 'png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      hasAlpha: [4, 6].includes(bytes[25]),
    };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          format: 'jpg',
          width: bytes.readUInt16BE(offset + 7),
          height: bytes.readUInt16BE(offset + 5),
          hasAlpha: false,
        };
      }
      offset += length + 2;
    }
  }

  throw new Error(`${path} must be a PNG or JPEG image`);
}

export function validateStoreImage(path, target) {
  const definition = STORE_TARGETS[target];
  if (!definition) throw new Error(`Unknown store target: ${target}`);
  const image = readImageDimensions(path);
  const dimensions = `${image.width}x${image.height}`;
  if (image.format !== definition.extension) {
    throw new Error(`${path} must use ${definition.extension.toUpperCase()} format`);
  }
  if (!definition.dimensions.has(dimensions)) {
    throw new Error(`${path} has unsupported ${dimensions} dimensions for ${target}`);
  }
  if (target.startsWith('google-') && image.hasAlpha) {
    throw new Error(`${path} must not include an alpha channel for Google Play`);
  }
  return { ...image, dimensions };
}
