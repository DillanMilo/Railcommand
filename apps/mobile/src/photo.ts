export interface MaterializedPhoto {
  blob: Blob;
  fileName: string;
  fileType: string;
  size: number;
}

export async function materializePhotoBlob(
  source: Blob,
  fileName: string,
): Promise<MaterializedPhoto> {
  const bytes = await source.arrayBuffer();
  const fileType = source.type || 'image/jpeg';
  const blob = new Blob([bytes], { type: fileType });

  if (blob.size <= 0) {
    throw new Error('The captured photo contained no image data');
  }

  return {
    blob,
    fileName,
    fileType,
    size: blob.size,
  };
}

export async function materializeCapturedPhoto(file: File): Promise<MaterializedPhoto> {
  return materializePhotoBlob(
    file,
    file.name || `railcommand-photo-${Date.now()}.jpg`,
  );
}
