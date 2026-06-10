export type PhotoGeoSource = 'exif' | 'device';

export interface PhotoGeoTag {
  lat: number;
  lng: number;
  source: PhotoGeoSource;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // Exif\0\0
const TYPE_BYTE_SIZE: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

export async function extractExifGps(file: File): Promise<PhotoGeoTag | null> {
  if (!isPotentialExifImage(file)) return null;

  try {
    return readExifGpsFromArrayBuffer(await file.arrayBuffer());
  } catch {
    return null;
  }
}

export async function captureDeviceGeo(): Promise<PhotoGeoTag | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            source: 'device',
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    } catch {
      resolve(null);
    }
  });
}

export async function resolvePhotoGeo(
  file: File,
  options: { allowDeviceGeo?: boolean } = {}
): Promise<PhotoGeoTag | null> {
  const exifGeo = await extractExifGps(file);
  if (exifGeo) return exifGeo;

  if (options.allowDeviceGeo === false) return null;
  return captureDeviceGeo();
}

export async function resolvePhotoGeoBatch(
  files: File[],
  options: { allowDeviceGeo?: boolean } = {}
): Promise<Array<PhotoGeoTag | null>> {
  const exifGeos = await Promise.all(files.map((file) => extractExifGps(file)));

  if (options.allowDeviceGeo === false || exifGeos.every(Boolean)) {
    return exifGeos;
  }

  const deviceGeo = await captureDeviceGeo();
  return exifGeos.map((geo) => geo ?? deviceGeo);
}

export function readExifGpsFromArrayBuffer(buffer: ArrayBuffer): PhotoGeoTag | null {
  const view = new DataView(buffer);
  if (view.byteLength < 8) return null;

  if (view.getUint16(0, false) === 0xffd8) {
    return readJpegExifGps(view);
  }

  return readTiffGps(view, 0, view.byteLength);
}

function isPotentialExifImage(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/tiff' ||
    /\.(jpe?g|tiff?)$/.test(name)
  );
}

function readJpegExifGps(view: DataView): PhotoGeoTag | null {
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < view.byteLength && view.getUint8(offset) === 0xff) {
      offset += 1;
    }

    if (offset >= view.byteLength) break;

    const marker = view.getUint8(offset);
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > view.byteLength) break;

    const segmentLength = view.getUint16(offset, false);
    const segmentStart = offset + 2;
    const segmentEnd = segmentStart + segmentLength - 2;

    if (segmentLength < 2 || segmentEnd > view.byteLength) break;

    if (marker === 0xe1 && hasExifHeader(view, segmentStart)) {
      return readTiffGps(view, segmentStart + EXIF_HEADER.length, segmentEnd);
    }

    offset = segmentEnd;
  }

  return null;
}

function hasExifHeader(view: DataView, offset: number): boolean {
  if (offset + EXIF_HEADER.length > view.byteLength) return false;
  return EXIF_HEADER.every((byte, index) => view.getUint8(offset + index) === byte);
}

function readTiffGps(view: DataView, tiffStart: number, limit: number): PhotoGeoTag | null {
  if (tiffStart + 8 > limit) return null;

  const endian = view.getUint16(tiffStart, false);
  const littleEndian = endian === 0x4949;
  if (!littleEndian && endian !== 0x4d4d) return null;

  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const gpsIfdOffset = readGpsIfdOffset(
    view,
    tiffStart + firstIfdOffset,
    tiffStart,
    limit,
    littleEndian
  );
  if (gpsIfdOffset === null) return null;

  return readGpsIfd(view, tiffStart + gpsIfdOffset, tiffStart, limit, littleEndian);
}

function readGpsIfdOffset(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  limit: number,
  littleEndian: boolean
): number | null {
  const entries = readIfdEntries(view, ifdStart, limit, littleEndian);
  if (!entries) return null;

  for (const entry of entries) {
    if (entry.tag === 0x8825 && entry.type === 4 && entry.count === 1) {
      const offset = view.getUint32(entry.valueOffset, littleEndian);
      if (tiffStart + offset < limit) return offset;
    }
  }

  return null;
}

function readGpsIfd(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  limit: number,
  littleEndian: boolean
): PhotoGeoTag | null {
  const entries = readIfdEntries(view, ifdStart, limit, littleEndian);
  if (!entries) return null;

  let latRef: string | null = null;
  let lngRef: string | null = null;
  let latDms: number[] | null = null;
  let lngDms: number[] | null = null;

  for (const entry of entries) {
    if (entry.tag === 0x0001) {
      latRef = readAsciiEntry(view, entry, tiffStart, limit, littleEndian);
    } else if (entry.tag === 0x0002) {
      latDms = readRationalArrayEntry(view, entry, tiffStart, limit, littleEndian);
    } else if (entry.tag === 0x0003) {
      lngRef = readAsciiEntry(view, entry, tiffStart, limit, littleEndian);
    } else if (entry.tag === 0x0004) {
      lngDms = readRationalArrayEntry(view, entry, tiffStart, limit, littleEndian);
    }
  }

  if (!latRef || !lngRef || !latDms || !lngDms) return null;

  const lat = dmsToDecimal(latDms, latRef);
  const lng = dmsToDecimal(lngDms, lngRef);

  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng, source: 'exif' };
}

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
}

function readIfdEntries(
  view: DataView,
  ifdStart: number,
  limit: number,
  littleEndian: boolean
): IfdEntry[] | null {
  if (ifdStart < 0 || ifdStart + 2 > limit) return null;

  const count = view.getUint16(ifdStart, littleEndian);
  const entriesStart = ifdStart + 2;
  const entriesEnd = entriesStart + count * 12;
  if (entriesEnd > limit) return null;

  const entries: IfdEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = entriesStart + index * 12;
    entries.push({
      tag: view.getUint16(offset, littleEndian),
      type: view.getUint16(offset + 2, littleEndian),
      count: view.getUint32(offset + 4, littleEndian),
      valueOffset: offset + 8,
    });
  }

  return entries;
}

function readAsciiEntry(
  view: DataView,
  entry: IfdEntry,
  tiffStart: number,
  limit: number,
  littleEndian: boolean
): string | null {
  const range = getEntryValueRange(view, entry, tiffStart, limit, littleEndian);
  if (!range) return null;

  const chars: string[] = [];
  for (let index = 0; index < range.byteCount; index += 1) {
    const code = view.getUint8(range.offset + index);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }

  return chars.join('').trim().toUpperCase() || null;
}

function readRationalArrayEntry(
  view: DataView,
  entry: IfdEntry,
  tiffStart: number,
  limit: number,
  littleEndian: boolean
): number[] | null {
  if (entry.type !== 5 || entry.count < 3) return null;

  const range = getEntryValueRange(view, entry, tiffStart, limit, littleEndian);
  if (!range || range.byteCount < 24) return null;

  const values: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const offset = range.offset + index * 8;
    const numerator = view.getUint32(offset, littleEndian);
    const denominator = view.getUint32(offset + 4, littleEndian);
    if (denominator === 0) return null;
    values.push(numerator / denominator);
  }

  return values;
}

function getEntryValueRange(
  view: DataView,
  entry: IfdEntry,
  tiffStart: number,
  limit: number,
  littleEndian: boolean
): { offset: number; byteCount: number } | null {
  const typeSize = TYPE_BYTE_SIZE[entry.type];
  if (!typeSize) return null;

  const byteCount = typeSize * entry.count;
  if (!Number.isSafeInteger(byteCount) || byteCount <= 0) return null;

  const offset =
    byteCount <= 4
      ? entry.valueOffset
      : tiffStart + view.getUint32(entry.valueOffset, littleEndian);

  if (offset < 0 || offset + byteCount > limit || offset + byteCount > view.byteLength) {
    return null;
  }

  return { offset, byteCount };
}

function dmsToDecimal(dms: number[], ref: string): number | null {
  if (dms.length < 3 || dms.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const direction = ref[0];
  if (!['N', 'S', 'E', 'W'].includes(direction)) return null;

  const decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return direction === 'S' || direction === 'W' ? decimal * -1 : decimal;
}
