export interface MaterializedPhoto {
  blob: Blob;
  fileName: string;
  fileType: string;
  size: number;
}

export async function materializeCapturedPhoto(file: File): Promise<MaterializedPhoto> {
  const bytes = await file.arrayBuffer();
  const fileType = file.type || 'image/jpeg';
  const blob = new Blob([bytes], { type: fileType });

  if (blob.size <= 0) {
    throw new Error('The captured photo contained no image data');
  }

  return {
    blob,
    fileName: file.name || `railcommand-photo-${Date.now()}.jpg`,
    fileType,
    size: blob.size,
  };
}
