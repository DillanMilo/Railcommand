import {
  Camera as NativeCamera,
  CameraDirection,
  EncodingType,
  type CameraPlugin,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface MaterializedPhoto {
  blob: Blob;
  fileName: string;
  fileType: string;
  size: number;
}

const CAPTURE_OPTIONS = {
  cameraDirection: CameraDirection.Rear,
  quality: 85,
  targetWidth: 1920,
  targetHeight: 1920,
  correctOrientation: true,
  encodingType: EncodingType.JPEG,
  saveToGallery: false,
  editable: 'no' as const,
  includeMetadata: true,
  webUseInput: true,
};

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

export async function captureNativePhoto(
  camera: Pick<CameraPlugin, 'takePhoto'> = NativeCamera,
  fetchPhoto: typeof fetch = fetch,
  convertFileSrc: (uri: string) => string = Capacitor.convertFileSrc,
): Promise<MaterializedPhoto> {
  const result = await camera.takePhoto(CAPTURE_OPTIONS);
  const photoUrl = result.webPath ?? (result.uri ? convertFileSrc(result.uri) : null);
  if (!photoUrl) throw new Error('The camera returned no readable photo location');

  const response = await fetchPhoto(photoUrl);
  if (!response.ok) throw new Error(`The captured photo could not be read (${response.status})`);

  const format = result.metadata?.format?.toLowerCase() || 'jpg';
  const extension = format === 'jpeg' ? 'jpg' : format;
  return materializePhotoBlob(
    await response.blob(),
    `railcommand-photo-${Date.now()}.${extension}`,
  );
}
