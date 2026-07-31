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
): Promise<Uint8Array<ArrayBuffer>> {
  if (files.length === 0) {
    throw new Error('None of the selected documents have uploaded files.');
  }

  const paths = buildArchivePaths(files);
  const entries: AsyncZippable = {};

  await Promise.all(
    files.map(async (file, index) => {
      const dataUrlBytes = readDataUrl(file.download_url);
      if (dataUrlBytes) {
        entries[paths[index]] = dataUrlBytes;
        return;
      }

      const response = await fetchFile(file.download_url);
      if (!response.ok) {
        throw new Error(`Could not download ${file.file_name}. Please try again.`);
      }

      entries[paths[index]] = new Uint8Array(await response.arrayBuffer());
    }),
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
