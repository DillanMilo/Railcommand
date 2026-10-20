import { isPhotoCursor, type ProjectPhotoPage, type ProjectPhotoPageOptions } from './project-photo-page';

export class PhotoPageRequestError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

export async function readProjectPhotoPage(projectId: string, options: ProjectPhotoPageOptions, signal: AbortSignal): Promise<ProjectPhotoPage> {
  const params = new URLSearchParams({ page: 'cursor', category: options.category });
  if (options.cursor) params.set('cursor', JSON.stringify(options.cursor));
  const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/photos?${params}`, {
    credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
  });
  const result = await response.json();
  if (!response.ok) throw new PhotoPageRequestError(typeof result?.error === 'string' ? result.error : 'Could not load photos. Please retry.', response.status);
  if (!Array.isArray(result?.data) || !(result.nextCursor === null || isPhotoCursor(result.nextCursor))) {
    throw new PhotoPageRequestError('Could not read this photo page. Please refresh and retry.');
  }
  return { data: result.data, nextCursor: result.nextCursor };
}
