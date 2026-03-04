/**
 * Compresses an image File using a canvas element.
 * - Standard photos: max 1920px on longest side, JPEG quality 0.75
 * - Thermal photos: returned unchanged (preserve radiometric data)
 * - Non-image files (HEIC, .is2, .seq, .csq): returned unchanged
 */
export async function compressImage(
  file: File,
  category: 'standard' | 'thermal' | string,
  options?: { maxPx?: number; quality?: number }
): Promise<File> {
  // Don't compress thermal/radiometric files — data integrity is critical
  if (category === 'thermal') return file;

  // Only compress browser-renderable images
  const compressibleTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  if (!compressibleTypes.includes(file.type)) return file;

  // Skip if already small (under 200KB — not worth the CPU cost)
  if (file.size < 200 * 1024) return file;

  const maxPx = options?.maxPx ?? 1920;
  const quality = options?.quality ?? 0.75;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if larger than maxPx
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          // Only use compressed version if it's actually smaller
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
