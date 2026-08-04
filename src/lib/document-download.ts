import { zip, type AsyncZippable } from 'fflate';

export interface DocumentDownloadFile {
  id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  file_name: string;
  file_size: number;
  download_url: string;
}

type FetchFile = (url: string) => Promise<Response>;
const DEFAULT_MAX_CONCURRENT_FETCHES = 4;
const DEFAULT_MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;

export interface DocumentArchiveOptions {
  maxConcurrentFetches?: number;
  maxArchiveBytes?: number;
}

function readDataUrl(url: string): Uint8Array<ArrayBuffer> | null {
  if (!url.startsWith('data:')) return null;

  const commaIndex = url.indexOf(',');
  if (commaIndex < 0) throw new Error('Invalid data URL');

  const metadata = url.slice(5, commaIndex).split(';');
  const payload = url.slice(commaIndex + 1);
  if (metadata.includes('base64')) {
    const binary = atob(payload);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  return new TextEncoder().encode(decodeURIComponent(payload));
}

function sanitizeArchiveSegment(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .trim();

  return sanitized || fallback;
}

export function buildArchivePaths(files: DocumentDownloadFile[]): string[] {
  const usedPaths = new Set<string>();

  return files.map((file) => {
    const folder = sanitizeArchiveSegment(
      `${file.document_number} - ${file.document_title}`,
      file.document_id,
    );
    const originalFileName = file.file_name.split(/[\\/]/).pop() ?? '';
    const fileName = sanitizeArchiveSegment(originalFileName, `file-${file.id}`);
    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : '';

    let path = `${folder}/${fileName}`;
    let duplicate = 2;
    while (usedPaths.has(path.toLocaleLowerCase())) {
      path = `${folder}/${baseName} (${duplicate})${extension}`;
      duplicate += 1;
    }

    usedPaths.add(path.toLocaleLowerCase());
    return path;
  });
}

export async function createDocumentArchive(
  files: DocumentDownloadFile[],
  fetchFile: FetchFile = fetch,
  options: DocumentArchiveOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (files.length === 0) {
    throw new Error('None of the selected documents have uploaded files.');
  }

  const totalBytes = files.reduce((sum, file) => sum + Math.max(0, file.file_size), 0);
  const maxArchiveBytes = options.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
  if (totalBytes > maxArchiveBytes) {
    throw new Error(
      `Selected files total ${formatBytes(totalBytes)}. Please select ${formatBytes(maxArchiveBytes)} or less at a time.`,
    );
  }

  const paths = buildArchivePaths(files);
  const entries: AsyncZippable = {};
  const maxConcurrentFetches = Math.max(
    1,
    Math.floor(options.maxConcurrentFetches ?? DEFAULT_MAX_CONCURRENT_FETCHES),
  );
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = files[index];
      const dataUrlBytes = readDataUrl(file.download_url);
      if (dataUrlBytes) {
        entries[paths[index]] = dataUrlBytes;
        continue;
      }

      const response = await fetchFile(file.download_url);
      if (!response.ok) {
        throw new Error(`Could not download ${file.file_name}. Please try again.`);
      }

      entries[paths[index]] = new Uint8Array(await response.arrayBuffer());
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrentFetches, files.length) }, () => worker()),
  );

  return new Promise((resolve, reject) => {
    // Uploaded documents are commonly already compressed (PDF, DWG, Office files).
    // Storing them without recompression keeps batch downloads responsive.
    zip(entries, { level: 0 }, (error, archive) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(archive);
    });
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${Math.ceil(bytes / (1024 * 1024))} MB`;
}

export function saveDocumentArchive(archive: Uint8Array<ArrayBuffer>, fileName: string): void {
  const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
