// Shared helpers for attachment upload paths.
// Safe to import from both client components and server actions — no
// 'use server' or 'use client' directives here.

const BUCKET_MAP: Record<string, string> = {
  standard: 'project-photos',
  thermal: 'thermal-photos',
  document: 'project-documents',
};

export function getBucket(category: string): string {
  return BUCKET_MAP[category] ?? 'project-photos';
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildStoragePath(
  projectId: string,
  entityType: string,
  entityId: string,
  fileName: string,
): string {
  return `${projectId}/${entityType}/${entityId}/${Date.now()}-${sanitizeFilename(fileName)}`;
}
